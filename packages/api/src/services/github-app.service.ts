import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import {
  fetchGitHubAppInstallation,
  fetchInstallationRepositories,
  getGitHubAppInstallUrl,
  hasGitHubAppConfig
} from "@veriflow/github";
import {
  db,
  githubAppInstallations,
  projectGithubRepositories,
  projects,
  repositories,
  type JsonObject
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

type WorkspaceInput = {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

function toBootstrapInput(input: WorkspaceInput) {
  return {
    user: input.user,
    session: input.session
  };
}

function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function getAccountMetadata(account: unknown) {
  if (typeof account !== "object" || account === null) {
    return {
      login: "unknown",
      id: null,
      type: null
    };
  }

  const record = account as {
    login?: unknown;
    id?: unknown;
    type?: unknown;
  };

  return {
    login: typeof record.login === "string" ? record.login : "unknown",
    id: typeof record.id === "number" ? record.id : null,
    type: typeof record.type === "string" ? record.type : null
  };
}

async function getScopedProjectOrThrow(input: {
  organizationId: string;
  projectId: string;
}) {
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.id, input.projectId),
        eq(projects.organizationId, input.organizationId)
      )
    )
    .limit(1);

  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found."
    });
  }

  return project;
}

async function getScopedInstallationOrThrow(input: {
  organizationId: string;
  installationId: number;
}) {
  const [installation] = await db
    .select()
    .from(githubAppInstallations)
    .where(
      and(
        eq(githubAppInstallations.organizationId, input.organizationId),
        eq(githubAppInstallations.installationId, input.installationId)
      )
    )
    .limit(1);

  if (!installation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "GitHub App installation not found for this workspace."
    });
  }

  return installation;
}

export async function getGitHubAppInstallLink(ctx: ProtectedContext) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:write");

  return {
    configured: hasGitHubAppConfig(),
    installUrl: getGitHubAppInstallUrl()
  };
}

export async function completeGitHubAppInstallation(
  input: WorkspaceInput & {
    installationId: number;
    setupAction?: string | null;
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(input));
  assertRoleCan(workspace.membership.role, "project:write");

  if (!hasGitHubAppConfig()) {
    throw new Error("GitHub App credentials are not configured.");
  }

  const installation = await fetchGitHubAppInstallation(input.installationId);
  const account = getAccountMetadata(installation.account);
  const [stored] = await db
    .insert(githubAppInstallations)
    .values({
      organizationId: workspace.activeOrganization.id,
      installationId: input.installationId,
      accountLogin: account.login,
      accountId: account.id,
      accountType: account.type,
      repositorySelection: installation.repository_selection ?? null,
      permissions: toJsonObject(installation.permissions ?? {}),
      events: toJsonObject(installation.events ?? []),
      installedByUserId: workspace.appUser.id,
      suspendedAt: installation.suspended_at
        ? new Date(installation.suspended_at)
        : null,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: githubAppInstallations.installationId,
      set: {
        organizationId: workspace.activeOrganization.id,
        accountLogin: account.login,
        accountId: account.id,
        accountType: account.type,
        repositorySelection: installation.repository_selection ?? null,
        permissions: toJsonObject(installation.permissions ?? {}),
        events: toJsonObject(installation.events ?? []),
        installedByUserId: workspace.appUser.id,
        suspendedAt: installation.suspended_at
          ? new Date(installation.suspended_at)
          : null,
        updatedAt: new Date()
      }
    })
    .returning();

  const syncedRepositories = await syncInstallationRepositoriesForOrganization({
    organizationId: workspace.activeOrganization.id,
    installationId: input.installationId
  });

  return {
    installation: stored,
    syncedRepositories,
    setupAction: input.setupAction ?? null
  };
}

export async function getGitHubAppInstallations(ctx: ProtectedContext) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  return db
    .select()
    .from(githubAppInstallations)
    .where(eq(githubAppInstallations.organizationId, workspace.activeOrganization.id))
    .orderBy(githubAppInstallations.createdAt);
}

export async function syncGitHubAppInstallationRepositories(
  ctx: ProtectedContext,
  input: {
    installationId: number;
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:write");

  await getScopedInstallationOrThrow({
    organizationId: workspace.activeOrganization.id,
    installationId: input.installationId
  });

  return syncInstallationRepositoriesForOrganization({
    organizationId: workspace.activeOrganization.id,
    installationId: input.installationId
  });
}

async function syncInstallationRepositoriesForOrganization(input: {
  organizationId: string;
  installationId: number;
}) {
  const githubRepositories = await fetchInstallationRepositories(input.installationId);
  const now = new Date();

  await db
    .update(repositories)
    .set({
      githubAppSelected: false,
      githubAppSyncedAt: now
    })
    .where(
      and(
        eq(repositories.organizationId, input.organizationId),
        eq(repositories.githubAppInstallationId, input.installationId)
      )
    );

  const synced = [];
  for (const repository of githubRepositories) {
    const [stored] = await db
      .insert(repositories)
      .values({
        organizationId: input.organizationId,
        githubRepoId: String(repository.id),
        githubAppInstallationId: input.installationId,
        owner: repository.owner.login,
        name: repository.name,
        fullName: repository.full_name,
        defaultBranch: repository.default_branch ?? "main",
        isPrivate: repository.private,
        githubAppSelected: true,
        githubAppSyncedAt: now
      })
      .onConflictDoUpdate({
        target: [repositories.organizationId, repositories.fullName],
        set: {
          githubRepoId: String(repository.id),
          githubAppInstallationId: input.installationId,
          owner: repository.owner.login,
          name: repository.name,
          defaultBranch: repository.default_branch ?? "main",
          isPrivate: repository.private,
          githubAppSelected: true,
          githubAppSyncedAt: now
        }
      })
      .returning();

    if (stored) {
      synced.push(stored);
    }
  }

  return synced;
}

export async function listGitHubAppInstallationRepositories(
  ctx: ProtectedContext,
  input: {
    installationId: number;
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  await getScopedInstallationOrThrow({
    organizationId: workspace.activeOrganization.id,
    installationId: input.installationId
  });

  return db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.organizationId, workspace.activeOrganization.id),
        eq(repositories.githubAppInstallationId, input.installationId),
        eq(repositories.githubAppSelected, true)
      )
    )
    .orderBy(repositories.fullName);
}

export async function getProjectGitHubIntegration(
  ctx: ProtectedContext,
  input: {
    projectId: string;
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  await getScopedProjectOrThrow({
    organizationId: workspace.activeOrganization.id,
    projectId: input.projectId
  });

  const [connected] = await db
    .select({
      projectRepository: projectGithubRepositories,
      repository: repositories,
      installation: githubAppInstallations
    })
    .from(projectGithubRepositories)
    .innerJoin(
      repositories,
      eq(projectGithubRepositories.repositoryId, repositories.id)
    )
    .leftJoin(
      githubAppInstallations,
      eq(repositories.githubAppInstallationId, githubAppInstallations.installationId)
    )
    .where(
      and(
        eq(projectGithubRepositories.organizationId, workspace.activeOrganization.id),
        eq(projectGithubRepositories.projectId, input.projectId)
      )
    )
    .limit(1);

  return connected ?? null;
}

export async function connectGitHubRepositoryToProject(
  ctx: ProtectedContext,
  input: {
    projectId: string;
    repositoryId: string;
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:write");

  await getScopedProjectOrThrow({
    organizationId: workspace.activeOrganization.id,
    projectId: input.projectId
  });

  const [repository] = await db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.id, input.repositoryId),
        eq(repositories.organizationId, workspace.activeOrganization.id),
        eq(repositories.githubAppSelected, true)
      )
    )
    .limit(1);

  if (!repository?.githubAppInstallationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose a repository from an installed GitHub App installation."
    });
  }

  const [connected] = await db
    .insert(projectGithubRepositories)
    .values({
      organizationId: workspace.activeOrganization.id,
      projectId: input.projectId,
      repositoryId: input.repositoryId,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: projectGithubRepositories.projectId,
      set: {
        repositoryId: input.repositoryId,
        updatedAt: new Date()
      }
    })
    .returning();

  return connected;
}

export async function disconnectGitHubRepositoryFromProject(
  ctx: ProtectedContext,
  input: {
    projectId: string;
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:write");

  await getScopedProjectOrThrow({
    organizationId: workspace.activeOrganization.id,
    projectId: input.projectId
  });

  await db
    .delete(projectGithubRepositories)
    .where(
      and(
        eq(projectGithubRepositories.organizationId, workspace.activeOrganization.id),
        eq(projectGithubRepositories.projectId, input.projectId)
      )
    );

  return {
    ok: true
  };
}
