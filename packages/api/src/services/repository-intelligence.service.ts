import { Buffer } from "node:buffer";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  generateRepositoryIntelligence,
  type RepositoryContext
} from "@veriflow/ai";
import { getGitHubClient, hasFallbackGitHubToken } from "@veriflow/github";
import {
  db,
  githubAppInstallations,
  projectGithubRepositories,
  projects,
  repositories,
  repositoryAnalyses,
  type JsonObject,
  type RepositoryAnalysisFileIndexItem,
  type RepositoryAnalysisImportantFile
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

type TreeItem = {
  path?: string;
  type?: string;
  sha?: string;
  size?: number;
};

const MAX_TREE_FILES = 5_000;
const MAX_FILES_INDEXED = 2_500;
const MAX_FILES_READ = 28;
const MAX_FILE_SIZE_BYTES = 80_000;
const MAX_TOTAL_SNIPPET_CHARS = 45_000;
const MAX_SNIPPET_CHARS = 5_000;

const SKIP_PATH_PARTS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".git",
  ".cache",
  "out",
  "generated"
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".pdf",
  ".zip",
  ".gz",
  ".mp4",
  ".mov",
  ".avi",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".lock"
]);

function toBootstrapInput(ctx: ProtectedContext) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

async function getScopedProjectRepository(input: {
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
      and(
        eq(repositories.githubAppInstallationId, githubAppInstallations.installationId),
        eq(githubAppInstallations.organizationId, input.organizationId)
      )
    )
    .where(
      and(
        eq(projectGithubRepositories.organizationId, input.organizationId),
        eq(projectGithubRepositories.projectId, input.projectId)
      )
    )
    .limit(1);

  if (!connected) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Repository not connected. Connect a synced GitHub repository before analyzing."
    });
  }

  if (!connected.repository.githubAppSelected) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Repository access denied. Sync repositories or select this repository in the GitHub App installation."
    });
  }

  return {
    project,
    ...connected
  };
}

export async function getLatestRepositoryAnalysisByProject(
  ctx: ProtectedContext,
  input: { projectId: string }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  await assertProjectInWorkspace({
    organizationId: workspace.activeOrganization.id,
    projectId: input.projectId
  });

  return getLatestAnalysisForProject({
    organizationId: workspace.activeOrganization.id,
    projectId: input.projectId
  });
}

export async function listRepositoryAnalysesByProject(
  ctx: ProtectedContext,
  input: { projectId: string }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  await assertProjectInWorkspace({
    organizationId: workspace.activeOrganization.id,
    projectId: input.projectId
  });

  return db
    .select()
    .from(repositoryAnalyses)
    .where(
      and(
        eq(repositoryAnalyses.organizationId, workspace.activeOrganization.id),
        eq(repositoryAnalyses.projectId, input.projectId)
      )
    )
    .orderBy(desc(repositoryAnalyses.createdAt))
    .limit(20);
}

export async function getRepositoryAnalysis(
  ctx: ProtectedContext,
  input: { analysisId: string }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  const [analysis] = await db
    .select()
    .from(repositoryAnalyses)
    .where(
      and(
        eq(repositoryAnalyses.id, input.analysisId),
        eq(repositoryAnalyses.organizationId, workspace.activeOrganization.id)
      )
    )
    .limit(1);

  if (!analysis) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Repository analysis not found."
    });
  }

  return analysis;
}

export async function analyzeProjectRepository(
  ctx: ProtectedContext,
  input: { projectId: string }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:write");
  const organizationId = workspace.activeOrganization.id;
  const connected = await getScopedProjectRepository({
    organizationId,
    projectId: input.projectId
  });
  const repository = connected.repository;
  const installationId = repository.githubAppInstallationId ?? null;

  if (installationId && !connected.installation) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "GitHub App not installed for this workspace. Reconnect GitHub in workspace settings."
    });
  }

  if (!installationId && !hasFallbackGitHubToken()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "GitHub token missing. Install the GitHub App or configure GITHUB_TOKEN."
    });
  }

  const [analysis] = await db
    .insert(repositoryAnalyses)
    .values({
      organizationId,
      projectId: connected.project.id,
      repositoryId: repository.id,
      githubRepositoryId: Number(repository.githubRepoId),
      installationId,
      owner: repository.owner,
      name: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      status: "running",
      updatedAt: new Date()
    })
    .returning();

  if (!analysis) {
    throw new Error("Unable to create repository analysis.");
  }

  try {
    const snapshot = await buildRepositorySnapshot({
      owner: repository.owner,
      name: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      installationId
    });
    const aiResult = await generateRepositoryIntelligence({
      repository: {
        fullName: repository.fullName,
        owner: repository.owner,
        name: repository.name,
        defaultBranch: snapshot.defaultBranch,
        analyzedCommitSha: snapshot.analyzedCommitSha
      },
      fileIndex: snapshot.fileIndex.map((file) => ({
        path: file.path,
        size: file.size,
        category: file.category
      })),
      files: snapshot.files
    });
    const data = aiResult.data;
    const [updated] = await db
      .update(repositoryAnalyses)
      .set({
        defaultBranch: snapshot.defaultBranch,
        analyzedCommitSha: snapshot.analyzedCommitSha,
        status: "completed",
        techStack: data.techStack,
        appStructure: {
          ...data.appStructure,
          packageManager: data.packageManager,
          appType: data.appType,
          monorepo: data.monorepo
        },
        importantFiles: data.importantFiles.map((file) => ({
          path: file.path,
          summary: file.summary,
          signals: file.signals
        })),
        routes: data.routes,
        apiEndpoints: data.apiEndpoints,
        databaseModels: data.databaseModels,
        authSummary: data.authSummary,
        testingSummary: data.testingSummary,
        deploymentSummary: data.deploymentSummary,
        riskAreas: data.riskAreas,
        suggestedFeatureAreas: data.suggestedFeatureAreas,
        summary: data.summary,
        rawFileIndex: snapshot.fileIndex,
        analysisData: toJsonObject({
          packageManager: data.packageManager,
          appType: data.appType,
          monorepo: data.monorepo,
          likelyChangeAreas: data.likelyChangeAreas,
          model: aiResult.model,
          mock: aiResult.mock,
          limits: snapshot.limits
        }),
        errorMessage: null,
        updatedAt: new Date()
      })
      .where(eq(repositoryAnalyses.id, analysis.id))
      .returning();

    return updated ?? analysis;
  } catch (error) {
    const message = toSafeErrorMessage(error);
    const [failed] = await db
      .update(repositoryAnalyses)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date()
      })
      .where(eq(repositoryAnalyses.id, analysis.id))
      .returning();

    throw new TRPCError({
      code: error instanceof TRPCError ? error.code : "BAD_REQUEST",
      message,
      cause: failed
    });
  }
}

export async function getLatestRepositoryContextForProject(input: {
  organizationId: string;
  projectId: string | null;
}): Promise<RepositoryContext | null> {
  if (!input.projectId) {
    return null;
  }

  const analysis = await getLatestAnalysisForProject({
    organizationId: input.organizationId,
    projectId: input.projectId
  });

  return analysis ? toRepositoryContext(analysis) : null;
}

export function toRepositoryContext(
  analysis: typeof repositoryAnalyses.$inferSelect
): RepositoryContext | null {
  if (analysis.status !== "completed") {
    return null;
  }

  return {
    repository: analysis.fullName,
    defaultBranch: analysis.defaultBranch,
    analyzedCommitSha: analysis.analyzedCommitSha,
    analyzedAt: analysis.updatedAt.toISOString(),
    summary: analysis.summary,
    techStack: analysis.techStack ?? [],
    appStructure: analysis.appStructure ?? null,
    importantFiles: (analysis.importantFiles ?? []).slice(0, 12),
    routes: (analysis.routes ?? []).slice(0, 20),
    apiEndpoints: (analysis.apiEndpoints ?? []).slice(0, 20),
    databaseModels: (analysis.databaseModels ?? []).slice(0, 20),
    authSummary: analysis.authSummary,
    testingSummary: analysis.testingSummary,
    deploymentSummary: analysis.deploymentSummary,
    riskAreas: (analysis.riskAreas ?? []).slice(0, 12),
    suggestedFeatureAreas: (analysis.suggestedFeatureAreas ?? []).slice(0, 16)
  };
}

export async function getLatestRepositoryReportContext(input: {
  organizationId: string;
  projectId: string | null;
}) {
  const context = await getLatestRepositoryContextForProject(input);

  if (!context) {
    return {
      analyzed: false,
      repository: null,
      analyzedCommitSha: null,
      analyzedAt: null,
      summary: null
    };
  }

  return {
    analyzed: true,
    repository: context.repository,
    analyzedCommitSha: context.analyzedCommitSha ?? null,
    analyzedAt: context.analyzedAt ?? null,
    summary: context.summary ?? null
  };
}

async function assertProjectInWorkspace(input: {
  organizationId: string;
  projectId: string;
}) {
  const [project] = await db
    .select({ id: projects.id })
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
}

async function getLatestAnalysisForProject(input: {
  organizationId: string;
  projectId: string;
}) {
  const [analysis] = await db
    .select()
    .from(repositoryAnalyses)
    .where(
      and(
        eq(repositoryAnalyses.organizationId, input.organizationId),
        eq(repositoryAnalyses.projectId, input.projectId)
      )
    )
    .orderBy(desc(repositoryAnalyses.createdAt))
    .limit(1);

  return analysis ?? null;
}

async function buildRepositorySnapshot(input: {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  installationId: number | null;
}) {
  const octokit = await getGitHubClient({
    installationId: input.installationId
  });
  const repository = await octokit.repos
    .get({
      owner: input.owner,
      repo: input.name
    })
    .catch((error) => {
      throw toGitHubTRPCError(error);
    });
  const defaultBranch = repository.data.default_branch ?? input.defaultBranch;
  const branch = await octokit.repos
    .getBranch({
      owner: input.owner,
      repo: input.name,
      branch: defaultBranch
    })
    .catch((error) => {
      throw toGitHubTRPCError(error);
    });
  const analyzedCommitSha = branch.data.commit.sha;
  const tree = await octokit.git
    .getTree({
      owner: input.owner,
      repo: input.name,
      tree_sha: analyzedCommitSha,
      recursive: "true"
    })
    .catch((error) => {
      throw toGitHubTRPCError(error);
    });
  const files = (tree.data.tree as TreeItem[]).filter(
    (item) => item.type === "blob" && item.path && isSafeIndexPath(item.path)
  );

  if (files.length > MAX_TREE_FILES || tree.data.truncated) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Repo too large. Narrow GitHub App access or contact support for a larger scan limit."
    });
  }

  const fileIndex = files
    .slice(0, MAX_FILES_INDEXED)
    .map((file) => ({
      path: file.path ?? "",
      size: file.size,
      type: file.type,
      category: categorizePath(file.path ?? "")
    }))
    .filter((file) => file.path) satisfies RepositoryAnalysisFileIndexItem[];
  const candidates = pickFilesToRead(files);
  const readFiles = [];
  let totalChars = 0;

  for (const file of candidates) {
    if (!file.path || !file.sha || (file.size ?? 0) > MAX_FILE_SIZE_BYTES) {
      continue;
    }

    const blob = await octokit.git
      .getBlob({
        owner: input.owner,
        repo: input.name,
        file_sha: file.sha
      })
      .catch(() => null);

    if (!blob?.data.content) {
      continue;
    }

    const content = decodeBlob(blob.data.content, blob.data.encoding);
    if (looksBinary(content)) {
      continue;
    }

    const snippet = sanitizeSnippet(content).slice(0, MAX_SNIPPET_CHARS);
    if (!snippet.trim()) {
      continue;
    }

    if (totalChars + snippet.length > MAX_TOTAL_SNIPPET_CHARS) {
      break;
    }

    readFiles.push({
      path: file.path,
      size: file.size,
      snippet
    });
    totalChars += snippet.length;
  }

  return {
    defaultBranch,
    analyzedCommitSha,
    fileIndex,
    files: readFiles,
    limits: {
      maxTreeFiles: MAX_TREE_FILES,
      indexedFiles: fileIndex.length,
      readFiles: readFiles.length,
      totalSnippetChars: totalChars
    }
  };
}

function pickFilesToRead(files: TreeItem[]) {
  return files
    .filter((file) => file.path && isUsefulReadPath(file.path))
    .sort((left, right) => scorePath(right.path ?? "") - scorePath(left.path ?? ""))
    .slice(0, MAX_FILES_READ);
}

function isSafeIndexPath(path: string) {
  const normalized = path.toLowerCase();
  const parts = normalized.split("/");

  if (parts.some((part) => SKIP_PATH_PARTS.has(part))) {
    return false;
  }

  if (parts.some((part) => part.startsWith(".env"))) {
    return false;
  }

  if (/secret|private[-_]?key|credential|token|cert|pem/i.test(path)) {
    return false;
  }

  return !hasBinaryExtension(path);
}

function isUsefulReadPath(path: string) {
  if (!isSafeIndexPath(path)) {
    return false;
  }

  const lower = path.toLowerCase();
  return (
    /(^|\/)readme\.md$/.test(lower) ||
    /(^|\/)package\.json$/.test(lower) ||
    /(^|\/)(pnpm-workspace\.yaml|turbo\.json|tsconfig\.json)$/.test(lower) ||
    /(^|\/)(next\.config|vite\.config|vitest\.config|playwright\.config|jest\.config)/.test(
      lower
    ) ||
    /(^|\/)(dockerfile|docker-compose\.ya?ml)$/.test(lower) ||
    lower.startsWith(".github/workflows/") ||
    /(^|\/)(app|pages|src|packages|apps)\//.test(lower) ||
    /schema|drizzle|prisma|auth|session|route|router|api|test|spec/i.test(path)
  );
}

function scorePath(path: string) {
  const lower = path.toLowerCase();
  let score = 0;

  if (lower.endsWith("package.json")) score += 80;
  if (lower.endsWith("readme.md")) score += 70;
  if (lower.includes("schema") || lower.includes("drizzle") || lower.includes("prisma")) {
    score += 60;
  }
  if (lower.includes("auth") || lower.includes("session")) score += 55;
  if (lower.includes("/api/") || lower.includes("route.") || lower.includes("router.")) {
    score += 50;
  }
  if (lower.includes("app/") || lower.includes("pages/")) score += 35;
  if (lower.includes("test") || lower.includes("spec")) score += 20;

  return score;
}

function categorizePath(path: string) {
  if (/schema|drizzle|prisma|migration/i.test(path)) return "database";
  if (/auth|session/i.test(path)) return "auth";
  if (/\/api\/|route\.|router\./i.test(path)) return "api";
  if (/test|spec|vitest|playwright|jest/i.test(path)) return "test";
  if (/docker|vercel|workflow|deploy|turbo/i.test(path)) return "deployment";
  if (/app\/|pages\/|components?\//i.test(path)) return "frontend";
  return "source";
}

function hasBinaryExtension(path: string) {
  const lower = path.toLowerCase();
  return Array.from(BINARY_EXTENSIONS).some((extension) =>
    lower.endsWith(extension)
  );
}

function decodeBlob(content: string, encoding?: string) {
  if (encoding === "base64") {
    return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
  }

  return Buffer.from(content, "utf8").toString("utf8");
}

function looksBinary(content: string) {
  return content.includes("\u0000");
}

function sanitizeSnippet(content: string) {
  return content
    .replace(/[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)[A-Z0-9_]*\s*[:=]\s*["']?[^"'\n]+/gi, "$1=[REDACTED]")
    .replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]")
    .slice(0, MAX_SNIPPET_CHARS);
}

function toGitHubTRPCError(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status)
      : null;

  if (status === 401 || status === 403) {
    return new TRPCError({
      code: "FORBIDDEN",
      message: "Repository access denied. Confirm the GitHub App can read this selected repository."
    });
  }

  if (status === 404) {
    return new TRPCError({
      code: "NOT_FOUND",
      message: "Repository access denied. The repository was not found for the current GitHub installation."
    });
  }

  return new TRPCError({
    code: "BAD_REQUEST",
    message: "Unable to fetch repository metadata from GitHub.",
    cause: error
  });
}

function toSafeErrorMessage(error: unknown) {
  if (error instanceof TRPCError) {
    return error.message;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("bad credentials") || message.includes("requires authentication")) {
    return "GitHub token missing. Install the GitHub App or configure GITHUB_TOKEN.";
  }

  if (message.includes("private key") || message.includes("jwt") || message.includes("pem")) {
    return "GitHub App not installed. Check the GitHub App credentials in workspace settings.";
  }

  if (message.includes("rate limit")) {
    return "Analysis failed. GitHub rate limit reached; try again later.";
  }

  return "Analysis failed. Try again after confirming repository access.";
}
