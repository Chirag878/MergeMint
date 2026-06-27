import { getGitHubClient } from "./client";

const MAX_DIFF_TEXT_LENGTH = 120_000;
const TRUNCATION_MARKER = "\n[TRUNCATED: diff exceeded maximum snapshot size]";

export type GitHubPullRequestInput = {
  owner: string;
  repo: string;
  pullNumber: number;
  installationId?: number | null;
};

export type GitHubPullRequestDetails = {
  githubPrId: number;
  githubRepoId: number;
  repositoryOwner: string;
  repositoryName: string;
  repositoryFullName: string;
  repositoryDefaultBranch: string;
  repositoryPrivate: boolean;
  title: string;
  author: string | null;
  headBranch: string;
  baseBranch: string;
  state: "open" | "closed" | "merged";
  mergeStatus: string | null;
  htmlUrl: string;
  latestCommitSha: string | null;
  openedAt: string | null;
  mergedAt: string | null;
  closedAt: string | null;
};

export type GitHubChangedFile = {
  filename: string;
  status?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  patch?: string;
  previousFilename?: string;
};

export type GitHubCommit = {
  sha: string;
  message?: string;
  authorName?: string;
  authorLogin?: string;
  date?: string;
  url?: string;
};

export type GitHubPullRequestSnapshot = {
  metadata: GitHubPullRequestDetails;
  changedFiles: GitHubChangedFile[];
  commits: GitHubCommit[];
  checks: Array<{
    name: string;
    status?: string;
    conclusion?: string;
    url?: string;
    completedAt?: string;
  }>;
  diffText: string;
  ciStatus: "pending" | "success" | "failure" | "skipped" | "cancelled" | "unknown";
};

export type GitHubPullRequestListItem = {
  number: number;
  title: string;
  state: "open" | "closed";
  draft: boolean;
  authorLogin: string | null;
  headBranch: string;
  baseBranch: string;
  createdAt: string | null;
  updatedAt: string | null;
  htmlUrl: string;
  changedFiles: number | null;
  additions: number | null;
  deletions: number | null;
};

export async function listPullRequestsForRepository(input: {
  owner: string;
  repo: string;
  installationId?: number | null;
  state?: "open" | "closed" | "all";
  limit?: number;
}): Promise<GitHubPullRequestListItem[]> {
  const octokit = await getGitHubClient({
    installationId: input.installationId
  });

  try {
    const { data } = await octokit.pulls.list({
      owner: input.owner,
      repo: input.repo,
      state: input.state ?? "open",
      sort: "updated",
      direction: "desc",
      per_page: Math.min(Math.max(input.limit ?? 30, 1), 100)
    });

    return data.map((pullRequest) => {
      const metrics = pullRequest as typeof pullRequest & {
        changed_files?: number;
        additions?: number;
        deletions?: number;
      };

      return {
        number: pullRequest.number,
        title: pullRequest.title,
        state: pullRequest.state === "closed" ? "closed" : "open",
        draft: Boolean(pullRequest.draft),
        authorLogin: pullRequest.user?.login ?? null,
        headBranch: pullRequest.head.ref,
        baseBranch: pullRequest.base.ref,
        createdAt: pullRequest.created_at ?? null,
        updatedAt: pullRequest.updated_at ?? null,
        htmlUrl: pullRequest.html_url,
        changedFiles: metrics.changed_files ?? null,
        additions: metrics.additions ?? null,
        deletions: metrics.deletions ?? null
      };
    });
  } catch (error) {
    throw toGitHubError(error);
  }
}

export async function fetchPullRequestDetails(
  input: GitHubPullRequestInput
): Promise<GitHubPullRequestDetails> {
  const octokit = await getGitHubClient({
    installationId: input.installationId
  });

  try {
    const { data } = await octokit.pulls.get({
      owner: input.owner,
      repo: input.repo,
      pull_number: input.pullNumber
    });

    return {
      githubPrId: data.id,
      githubRepoId: data.base.repo.id,
      repositoryOwner: data.base.repo.owner.login,
      repositoryName: data.base.repo.name,
      repositoryFullName: data.base.repo.full_name,
      repositoryDefaultBranch: data.base.repo.default_branch ?? data.base.ref,
      repositoryPrivate: data.base.repo.private,
      title: data.title,
      author: data.user?.login ?? null,
      headBranch: data.head.ref,
      baseBranch: data.base.ref,
      state: data.merged ? "merged" : data.state === "open" ? "open" : "closed",
      mergeStatus: data.mergeable_state ?? null,
      htmlUrl: data.html_url,
      latestCommitSha: data.head.sha ?? null,
      openedAt: data.created_at ?? null,
      mergedAt: data.merged_at ?? null,
      closedAt: data.closed_at ?? null
    };
  } catch (error) {
    throw toGitHubError(error);
  }
}

export async function fetchPullRequestFiles(
  input: GitHubPullRequestInput
): Promise<GitHubChangedFile[]> {
  const octokit = await getGitHubClient({
    installationId: input.installationId
  });

  try {
    const files = await octokit.paginate(octokit.pulls.listFiles, {
      owner: input.owner,
      repo: input.repo,
      pull_number: input.pullNumber,
      per_page: 100
    });

    return files.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch,
      previousFilename: file.previous_filename
    }));
  } catch (error) {
    throw toGitHubError(error);
  }
}

export async function fetchPullRequestCommits(
  input: GitHubPullRequestInput
): Promise<GitHubCommit[]> {
  const octokit = await getGitHubClient({
    installationId: input.installationId
  });

  try {
    const commits = await octokit.paginate(octokit.pulls.listCommits, {
      owner: input.owner,
      repo: input.repo,
      pull_number: input.pullNumber,
      per_page: 100
    });

    return commits.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      authorName: commit.commit.author?.name ?? commit.commit.committer?.name,
      authorLogin: commit.author?.login ?? commit.committer?.login,
      date: commit.commit.author?.date ?? commit.commit.committer?.date,
      url: commit.html_url
    }));
  } catch (error) {
    throw toGitHubError(error);
  }
}

export async function fetchPullRequestSnapshot(
  input: GitHubPullRequestInput
): Promise<GitHubPullRequestSnapshot> {
  const metadata = await fetchPullRequestDetails(input);
  const [changedFiles, commits] = await Promise.all([
    fetchPullRequestFiles(input),
    fetchPullRequestCommits(input)
  ]);

  const checks = await fetchChecks(input, metadata.latestCommitSha);

  return {
    metadata,
    changedFiles,
    commits,
    checks: checks.checks,
    diffText: buildDiffText(changedFiles),
    ciStatus: checks.ciStatus
  };
}

function buildDiffText(changedFiles: GitHubChangedFile[]) {
  let diffText = "";

  for (const file of changedFiles) {
    if (!file.patch) {
      continue;
    }

    const nextChunk = `--- ${file.previousFilename ?? file.filename}\n+++ ${file.filename}\n${file.patch}\n`;

    if (diffText.length + nextChunk.length > MAX_DIFF_TEXT_LENGTH) {
      const remainingLength = Math.max(
        0,
        MAX_DIFF_TEXT_LENGTH - diffText.length - TRUNCATION_MARKER.length
      );
      diffText += nextChunk.slice(0, remainingLength);
      diffText += TRUNCATION_MARKER;
      break;
    }

    diffText += nextChunk;
  }

  return diffText;
}

async function fetchChecks(
  input: GitHubPullRequestInput,
  ref: string | null
): Promise<Pick<GitHubPullRequestSnapshot, "checks" | "ciStatus">> {
  if (!ref) {
    return {
      checks: [],
      ciStatus: "unknown"
    };
  }

  const octokit = await getGitHubClient({
    installationId: input.installationId
  });

  try {
    const { data } = await octokit.repos.getCombinedStatusForRef({
      owner: input.owner,
      repo: input.repo,
      ref
    });

    return {
      checks: data.statuses.map((status) => ({
        name: status.context,
        status: status.state,
        conclusion: status.state,
        url: status.target_url ?? undefined,
        completedAt: status.updated_at ?? undefined
      })),
      ciStatus: mapCombinedStatus(data.state)
    };
  } catch {
    return {
      checks: [],
      ciStatus: "unknown"
    };
  }
}

function mapCombinedStatus(
  status: string
): GitHubPullRequestSnapshot["ciStatus"] {
  if (status === "success") {
    return "success";
  }

  if (status === "failure" || status === "error") {
    return "failure";
  }

  if (status === "pending") {
    return "pending";
  }

  return "unknown";
}

function toGitHubError(error: unknown) {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);

  if (status === 404) {
    if (message.toLowerCase().includes("not found")) {
      return new Error("GitHub pull request not found.");
    }

    return new Error(
      "This PR may be private or inaccessible. Add GITHUB_TOKEN or connect GitHub App later."
    );
  }

  if (status === 403 || status === 401) {
    if (message.toLowerCase().includes("rate limit")) {
      return new Error("GitHub rate limit reached. Add GITHUB_TOKEN or try again later.");
    }

    return new Error(
      "This PR may be private or inaccessible. Add GITHUB_TOKEN or connect GitHub App later."
    );
  }

  return new Error("Unable to fetch GitHub pull request details.");
}

function getErrorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
