import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  fetchPullRequestSnapshot,
  parseGitHubPullRequestUrl,
  type GitHubPullRequestSnapshot
} from "@veriflow/github";
import {
  auditLogs,
  db,
  featureRequests,
  prSnapshots,
  projects,
  pullRequests,
  repositories,
  type ChangedFile,
  type GitHubCheckSnapshot,
  type GitHubCommitSnapshot,
  type JsonObject
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

type SnapshotSummary = {
  snapshotId: string;
  commitSha: string;
  changedFilesCount: number;
  diffTextLength: number;
  ciStatus: string;
  createdAt: Date;
};

function toBootstrapInput(ctx: ProtectedContext) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

async function getScopedFeatureRequestOrThrow(
  featureRequestId: string,
  organizationId: string
) {
  const [row] = await db
    .select({
      featureRequest: featureRequests,
      project: projects
    })
    .from(featureRequests)
    .innerJoin(projects, eq(featureRequests.projectId, projects.id))
    .where(
      and(
        eq(featureRequests.id, featureRequestId),
        eq(featureRequests.organizationId, organizationId),
        eq(projects.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Feature request not found."
    });
  }

  return row;
}

async function writeAuditLog(input: {
  organizationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: JsonObject;
}) {
  await db.insert(auditLogs).values({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {}
  });
}

function mapSnapshotSummary(snapshot: typeof prSnapshots.$inferSelect): SnapshotSummary {
  return {
    snapshotId: snapshot.id,
    commitSha: snapshot.commitSha,
    changedFilesCount: snapshot.changedFiles.length,
    diffTextLength: snapshot.diffText?.length ?? 0,
    ciStatus: snapshot.ciStatus,
    createdAt: snapshot.createdAt
  };
}

function mapChangedFiles(
  snapshot: GitHubPullRequestSnapshot
): ChangedFile[] {
  return snapshot.changedFiles.map((file) => ({
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: file.patch
  }));
}

function mapCommits(
  snapshot: GitHubPullRequestSnapshot
): GitHubCommitSnapshot[] {
  return snapshot.commits.map((commit) => ({
    sha: commit.sha,
    message: commit.message,
    authorName: commit.authorLogin ?? commit.authorName,
    authoredAt: commit.date
  }));
}

function mapChecks(
  snapshot: GitHubPullRequestSnapshot
): GitHubCheckSnapshot[] {
  return snapshot.checks.map((check) => ({
    name: check.name,
    status: check.status,
    conclusion: check.conclusion,
    url: check.url,
    completedAt: check.completedAt
  }));
}

async function upsertRepository(input: {
  organizationId: string;
  snapshot: GitHubPullRequestSnapshot;
}) {
  const metadata = input.snapshot.metadata;
  const [repository] = await db
    .insert(repositories)
    .values({
      organizationId: input.organizationId,
      githubRepoId: String(metadata.githubRepoId),
      owner: metadata.repositoryOwner,
      name: metadata.repositoryName,
      fullName: metadata.repositoryFullName,
      defaultBranch: metadata.repositoryDefaultBranch,
      isPrivate: metadata.repositoryPrivate
    })
    .onConflictDoUpdate({
      target: [repositories.organizationId, repositories.fullName],
      set: {
        githubRepoId: String(metadata.githubRepoId),
        owner: metadata.repositoryOwner,
        name: metadata.repositoryName,
        defaultBranch: metadata.repositoryDefaultBranch,
        isPrivate: metadata.repositoryPrivate
      }
    })
    .returning();

  if (!repository) {
    throw new Error("Unable to upsert GitHub repository.");
  }

  return repository;
}

async function upsertPullRequest(input: {
  organizationId: string;
  projectId: string;
  featureRequestId: string;
  repositoryId: string;
  snapshot: GitHubPullRequestSnapshot;
}) {
  const metadata = input.snapshot.metadata;
  const [pullRequest] = await db
    .insert(pullRequests)
    .values({
      organizationId: input.organizationId,
      projectId: input.projectId,
      featureRequestId: input.featureRequestId,
      repositoryId: input.repositoryId,
      githubPrNumber: Number(new URL(metadata.htmlUrl).pathname.split("/").at(-1)),
      title: metadata.title,
      author: metadata.author,
      branch: metadata.headBranch,
      baseBranch: metadata.baseBranch,
      state: metadata.state,
      mergeStatus: metadata.mergeStatus,
      latestCommitSha: metadata.latestCommitSha,
      htmlUrl: metadata.htmlUrl,
      openedAt: toDate(metadata.openedAt),
      mergedAt: toDate(metadata.mergedAt),
      closedAt: toDate(metadata.closedAt),
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [pullRequests.repositoryId, pullRequests.githubPrNumber],
      set: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        featureRequestId: input.featureRequestId,
        title: metadata.title,
        author: metadata.author,
        branch: metadata.headBranch,
        baseBranch: metadata.baseBranch,
        state: metadata.state,
        mergeStatus: metadata.mergeStatus,
        latestCommitSha: metadata.latestCommitSha,
        htmlUrl: metadata.htmlUrl,
        openedAt: toDate(metadata.openedAt),
        mergedAt: toDate(metadata.mergedAt),
        closedAt: toDate(metadata.closedAt),
        updatedAt: new Date()
      }
    })
    .returning();

  if (!pullRequest) {
    throw new Error("Unable to upsert GitHub pull request.");
  }

  return pullRequest;
}

async function createSnapshotIfNeeded(input: {
  pullRequestId: string;
  snapshot: GitHubPullRequestSnapshot;
}) {
  const commitSha = input.snapshot.metadata.latestCommitSha;

  if (!commitSha) {
    throw new Error("GitHub pull request has no latest commit SHA.");
  }

  const [existing] = await db
    .select()
    .from(prSnapshots)
    .where(
      and(
        eq(prSnapshots.pullRequestId, input.pullRequestId),
        eq(prSnapshots.commitSha, commitSha)
      )
    )
    .limit(1);

  if (existing) {
    return {
      snapshot: existing,
      created: false
    };
  }

  const [created] = await db
    .insert(prSnapshots)
    .values({
      pullRequestId: input.pullRequestId,
      commitSha,
      diffText: input.snapshot.diffText,
      changedFiles: mapChangedFiles(input.snapshot),
      commits: mapCommits(input.snapshot),
      checks: mapChecks(input.snapshot),
      ciStatus: input.snapshot.ciStatus
    })
    .returning();

  if (!created) {
    throw new Error("Unable to create GitHub PR snapshot.");
  }

  return {
    snapshot: created,
    created: true
  };
}

export async function linkPullRequestToFeatureRequest(
  ctx: ProtectedContext,
  input: {
    featureRequestId: string;
    prUrl: string;
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "create_feature_request");

  const { featureRequest } = await getScopedFeatureRequestOrThrow(
    input.featureRequestId,
    workspace.activeOrganization.id
  );
  const parsed = parseGitHubPullRequestUrl(input.prUrl);
  const snapshot = await fetchPullRequestSnapshot(parsed);

  const repository = await upsertRepository({
    organizationId: workspace.activeOrganization.id,
    snapshot
  });
  const pullRequest = await upsertPullRequest({
    organizationId: workspace.activeOrganization.id,
    projectId: featureRequest.projectId,
    featureRequestId: featureRequest.id,
    repositoryId: repository.id,
    snapshot
  });
  const snapshotResult = await createSnapshotIfNeeded({
    pullRequestId: pullRequest.id,
    snapshot
  });

  await db
    .update(featureRequests)
    .set({
      status: "pr_linked",
      updatedAt: new Date()
    })
    .where(eq(featureRequests.id, featureRequest.id));

  await writeAuditLog({
    organizationId: workspace.activeOrganization.id,
    actorId: workspace.appUser.id,
    action: "github_pr_linked",
    entityType: "feature_request",
    entityId: featureRequest.id,
    metadata: toJsonObject({
      pullRequestId: pullRequest.id,
      repositoryId: repository.id,
      normalizedUrl: parsed.normalizedUrl
    })
  });

  if (snapshotResult.created) {
    await writeAuditLog({
      organizationId: workspace.activeOrganization.id,
      actorId: workspace.appUser.id,
      action: "github_pr_snapshot_created",
      entityType: "pull_request",
      entityId: pullRequest.id,
      metadata: toJsonObject({
        snapshotId: snapshotResult.snapshot.id,
        commitSha: snapshotResult.snapshot.commitSha
      })
    });
  }

  return {
    pullRequest,
    repository,
    snapshot: mapSnapshotSummary(snapshotResult.snapshot)
  };
}

export async function getPullRequestForFeatureRequest(
  ctx: ProtectedContext,
  featureRequestId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  await getScopedFeatureRequestOrThrow(
    featureRequestId,
    workspace.activeOrganization.id
  );

  const [pullRequest] = await db
    .select()
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.featureRequestId, featureRequestId),
        eq(pullRequests.organizationId, workspace.activeOrganization.id)
      )
    )
    .orderBy(desc(pullRequests.updatedAt))
    .limit(1);

  if (!pullRequest) {
    return null;
  }

  const [repository] = await db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.id, pullRequest.repositoryId),
        eq(repositories.organizationId, workspace.activeOrganization.id)
      )
    )
    .limit(1);

  const [latestSnapshot] = await db
    .select()
    .from(prSnapshots)
    .where(eq(prSnapshots.pullRequestId, pullRequest.id))
    .orderBy(desc(prSnapshots.createdAt))
    .limit(1);

  return {
    pullRequest,
    repository: repository ?? null,
    latestSnapshot: latestSnapshot ?? null,
    changedFilesCount: latestSnapshot?.changedFiles.length ?? 0,
    diffTextLength: latestSnapshot?.diffText?.length ?? 0
  };
}

export async function refreshPullRequestSnapshot(
  ctx: ProtectedContext,
  pullRequestId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "create_feature_request");

  const [row] = await db
    .select({
      pullRequest: pullRequests,
      repository: repositories,
      featureRequest: featureRequests
    })
    .from(pullRequests)
    .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
    .innerJoin(
      featureRequests,
      eq(pullRequests.featureRequestId, featureRequests.id)
    )
    .where(
      and(
        eq(pullRequests.id, pullRequestId),
        eq(pullRequests.organizationId, workspace.activeOrganization.id),
        eq(repositories.organizationId, workspace.activeOrganization.id),
        eq(featureRequests.organizationId, workspace.activeOrganization.id)
      )
    )
    .limit(1);

  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Linked pull request not found."
    });
  }

  const snapshot = await fetchPullRequestSnapshot({
    owner: row.repository.owner,
    repo: row.repository.name,
    pullNumber: row.pullRequest.githubPrNumber
  });

  const pullRequest = await upsertPullRequest({
    organizationId: workspace.activeOrganization.id,
    projectId: row.pullRequest.projectId,
    featureRequestId: row.pullRequest.featureRequestId,
    repositoryId: row.repository.id,
    snapshot
  });
  const snapshotResult = await createSnapshotIfNeeded({
    pullRequestId: pullRequest.id,
    snapshot
  });

  await writeAuditLog({
    organizationId: workspace.activeOrganization.id,
    actorId: workspace.appUser.id,
    action: snapshotResult.created
      ? "github_pr_snapshot_created"
      : "github_pr_snapshot_refreshed",
    entityType: "pull_request",
    entityId: pullRequest.id,
    metadata: toJsonObject({
      snapshotId: snapshotResult.snapshot.id,
      commitSha: snapshotResult.snapshot.commitSha,
      created: snapshotResult.created
    })
  });

  return {
    pullRequest,
    latestSnapshot: mapSnapshotSummary(snapshotResult.snapshot),
    newSnapshotCreated: snapshotResult.created
  };
}
