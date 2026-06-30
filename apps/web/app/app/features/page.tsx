import { ensureUserWorkspace } from "@veriflow/api";
import { FeaturesClient } from "./features-client";
import { requireWebSession } from "../../server-auth";

export default async function AppFeaturesPage({
  searchParams
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await requireWebSession();
  const workspace = await ensureUserWorkspace({
    user: session.user,
    session: session.session
  });
  const { projectId } = await searchParams;

  return (
    <main className="vf-app-page min-h-screen px-5 py-8 text-neutral-100 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl space-y-8">
        <div className="vf-page-hero">
          <p className="vf-page-eyebrow">
            {workspace.activeOrganization.name}
          </p>
          <div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Feature Requests
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base">
              Capture release intent, acceptance criteria, and AI-ready product
              context.
            </p>
          </div>
        </div>
        <FeaturesClient initialProjectId={projectId} />
      </section>
    </main>
  );
}
