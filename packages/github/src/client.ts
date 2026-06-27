import { createSign } from "node:crypto";
import { Octokit } from "@octokit/rest";
import { env } from "@veriflow/env";

const INSTALLATION_TOKEN_CACHE_TTL_MS = 55 * 60 * 1000;

type InstallationTokenCacheEntry = {
  token: string;
  expiresAt: number;
};

let fallbackOctokitClient: Octokit | null = null;
const installationTokenCache = new Map<number, InstallationTokenCacheEntry>();

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getGitHubAppPrivateKey() {
  if (env.GITHUB_APP_PRIVATE_KEY_BASE64) {
    return Buffer.from(env.GITHUB_APP_PRIVATE_KEY_BASE64, "base64").toString(
      "utf8"
    );
  }

  return env.GITHUB_APP_PRIVATE_KEY;
}

export function hasGitHubAppConfig() {
  return Boolean(env.GITHUB_APP_ID && getGitHubAppPrivateKey());
}

export function hasFallbackGitHubToken() {
  return Boolean(env.GITHUB_TOKEN);
}

export function getGitHubAppInstallUrl() {
  if (!env.GITHUB_APP_SLUG) {
    return null;
  }

  return `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`;
}

export function createGitHubAppJwt(now = Math.floor(Date.now() / 1000)) {
  const privateKey = getGitHubAppPrivateKey();

  if (!env.GITHUB_APP_ID || !privateKey) {
    throw new Error("GitHub App credentials are not configured.");
  }

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 540,
      iss: env.GITHUB_APP_ID
    })
  );
  const unsignedToken = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256")
    .update(unsignedToken)
    .end()
    .sign(privateKey);

  return `${unsignedToken}.${base64Url(signature)}`;
}

export function getGitHubAppClient() {
  return new Octokit({
    auth: createGitHubAppJwt()
  });
}

async function createInstallationAccessToken(installationId: number) {
  const cached = installationTokenCache.get(installationId);

  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const appClient = getGitHubAppClient();
  const { data } = await appClient.apps.createInstallationAccessToken({
    installation_id: installationId
  });
  const expiresAt = data.expires_at
    ? new Date(data.expires_at).getTime()
    : Date.now() + INSTALLATION_TOKEN_CACHE_TTL_MS;
  const safeExpiresAt = Math.min(
    expiresAt,
    Date.now() + INSTALLATION_TOKEN_CACHE_TTL_MS
  );

  installationTokenCache.set(installationId, {
    token: data.token,
    expiresAt: safeExpiresAt
  });

  return data.token;
}

function getFallbackGitHubClient() {
  fallbackOctokitClient ??= new Octokit(
    env.GITHUB_TOKEN
      ? {
          auth: env.GITHUB_TOKEN
        }
      : {}
  );

  return fallbackOctokitClient;
}

export async function getGitHubClient(input?: { installationId?: number | null }) {
  if (input?.installationId) {
    const installationToken = await createInstallationAccessToken(
      input.installationId
    );

    return new Octokit({
      auth: installationToken
    });
  }

  return getFallbackGitHubClient();
}

export async function fetchGitHubAppInstallation(installationId: number) {
  const appClient = getGitHubAppClient();
  const { data } = await appClient.apps.getInstallation({
    installation_id: installationId
  });

  return data;
}

export async function fetchInstallationRepositories(installationId: number) {
  const installationClient = await getGitHubClient({ installationId });
  const repositories = await installationClient.paginate(
    installationClient.apps.listReposAccessibleToInstallation,
    {
      per_page: 100
    }
  );

  return repositories;
}
