import { Octokit } from "@octokit/rest";
import { env } from "@veriflow/env";

let octokitClient: Octokit | null = null;

export function getGitHubClient() {
  octokitClient ??= new Octokit(
    env.GITHUB_TOKEN
      ? {
          auth: env.GITHUB_TOKEN
        }
      : {}
  );

  return octokitClient;
}
