import { ensureUserWorkspace } from "@veriflow/api";
import { requireWebSession } from "../../server-auth";
import { ReleaseBoardClient } from "./release-board-client";

export default async function ReleaseBoardPage() {
  const session = await requireWebSession();
  const workspace = await ensureUserWorkspace({
    user: session.user,
    session: session.session
  });

  return (
    <main className="vf-app-page min-h-screen px-5 py-8 text-neutral-100 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-8">
        <div className="vf-page-hero">
          <p className="vf-page-eyebrow">
            {workspace.activeOrganization.name}
          </p>
          <div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Release Board
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base">
              Track feature releases from requirement capture through PR evidence,
              QA, approval, and shipped proof.
            </p>
          </div>
        </div>
        <ReleaseBoardClient />
      </section>
    </main>
  );
}
