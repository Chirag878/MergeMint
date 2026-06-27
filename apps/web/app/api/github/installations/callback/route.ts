import { completeGitHubAppInstallation } from "@veriflow/api";
import { getSessionFromHeaders } from "@veriflow/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(path: string, request: Request) {
  return Response.redirect(new URL(path, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const installationIdText = url.searchParams.get("installation_id");
  const setupAction = url.searchParams.get("setup_action");
  const installationId = installationIdText ? Number(installationIdText) : NaN;

  if (!Number.isInteger(installationId) || installationId <= 0) {
    return redirectTo("/app/settings/github?githubInstallation=missing", request);
  }

  const authSession = await getSessionFromHeaders(request.headers);

  if (!authSession?.user || !authSession.session) {
    const callbackPath = new URL("/api/github/installations/callback", request.url);
    callbackPath.searchParams.set("installation_id", String(installationId));
    if (setupAction) {
      callbackPath.searchParams.set("setup_action", setupAction);
    }

    const next = encodeURIComponent(
      `${callbackPath.pathname}${callbackPath.search}`
    );
    return redirectTo(`/login?next=${next}`, request);
  }

  try {
    const result = await completeGitHubAppInstallation({
      user: authSession.user,
      session: authSession.session,
      installationId,
      setupAction
    });

    const redirectPath = new URL("/app/settings/github", request.url);
    redirectPath.searchParams.set("githubInstallation", "connected");
    redirectPath.searchParams.set(
      "repositoriesSynced",
      String(result.syncedRepositories.length)
    );
    if (setupAction) {
      redirectPath.searchParams.set("setupAction", setupAction);
    }

    return redirectTo(`${redirectPath.pathname}${redirectPath.search}`, request);
  } catch (error) {
    console.error("[github-app] installation_callback_failed", {
      message: error instanceof Error ? error.message : "unknown",
      installationId
    });

    return redirectTo("/app/settings/github?githubInstallation=failed", request);
  }
}
