import { ensureUserWorkspace } from "@veriflow/api";
import { requireWebSession } from "../../../server-auth";
import { GitHubSettingsClient } from "./github-settings-client";

export default async function GitHubSettingsPage() {
  const session = await requireWebSession();
  const workspace = await ensureUserWorkspace({
    user: session.user,
    session: session.session
  });

  return (
    <main className="vf-app-page min-h-screen px-5 py-8 text-neutral-100 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl space-y-8">
        <div className="vf-page-hero">
          <p className="vf-page-eyebrow">
            {workspace.activeOrganization.name}
          </p>
          <div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              GitHub settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base">
              Manage workspace GitHub access, sync repositories, and confirm
              webhook readiness.
            </p>
          </div>
        </div>
        <GitHubSettingsClient />
      </section>
    </main>
  );
}
