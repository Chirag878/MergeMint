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
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <section className="mx-auto max-w-6xl space-y-8">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-400">
          {workspace.activeOrganization.name}
        </p>
        <div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Feature Requests
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Capture release intent, acceptance criteria, and AI-ready product
            context.
          </p>
        </div>
        <FeaturesClient initialProjectId={projectId} />
      </section>
    </main>
  );
}
