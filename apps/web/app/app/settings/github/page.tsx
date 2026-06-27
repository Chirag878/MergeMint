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
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <section className="mx-auto max-w-5xl space-y-8">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-400">
          {workspace.activeOrganization.name}
        </p>
        <div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            GitHub settings
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Manage workspace GitHub access, sync repositories, and confirm
            webhook readiness.
          </p>
        </div>
        <GitHubSettingsClient />
      </section>
    </main>
  );
}
