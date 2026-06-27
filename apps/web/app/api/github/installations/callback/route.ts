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
  const installationId = installationIdText ? Number(installationIdText) : NaN;

  if (!Number.isInteger(installationId) || installationId <= 0) {
    return redirectTo("/app/projects?githubInstallation=missing", request);
  }

  const authSession = await getSessionFromHeaders(request.headers);

  if (!authSession?.user || !authSession.session) {
    const next = encodeURIComponent(
      `/api/github/installations/callback?installation_id=${installationId}`
    );
    return redirectTo(`/login?next=${next}`, request);
  }

  try {
    await completeGitHubAppInstallation({
      user: authSession.user,
      session: authSession.session,
      installationId
    });

    return redirectTo("/app/projects?githubInstallation=connected", request);
  } catch (error) {
    console.error("[github-app] installation_callback_failed", {
      message: error instanceof Error ? error.message : "unknown",
      installationId
    });

    return redirectTo("/app/projects?githubInstallation=failed", request);
  }
}
