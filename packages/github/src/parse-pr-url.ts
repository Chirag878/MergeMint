export type ParsedGitHubPullRequestUrl = {
  owner: string;
  repo: string;
  pullNumber: number;
  normalizedUrl: string;
};

export function parseGitHubPullRequestUrl(
  url: string
): ParsedGitHubPullRequestUrl {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Invalid GitHub pull request URL.");
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("Invalid GitHub pull request URL.");
  }

  if (parsedUrl.hostname.toLowerCase() !== "github.com") {
    throw new Error("Only github.com pull request URLs are supported.");
  }

  const [owner, repo, resource, pullNumberText, ...rest] = parsedUrl.pathname
    .split("/")
    .filter(Boolean);

  if (!owner || !repo || resource !== "pull" || !pullNumberText || rest.length > 0) {
    throw new Error("Expected a GitHub pull request URL like https://github.com/owner/repo/pull/123.");
  }

  const pullNumber = Number(pullNumberText);

  if (!Number.isInteger(pullNumber) || pullNumber <= 0) {
    throw new Error("GitHub pull request number must be a positive integer.");
  }

  return {
    owner,
    repo,
    pullNumber,
    normalizedUrl: `https://github.com/${owner}/${repo}/pull/${pullNumber}`
  };
}
