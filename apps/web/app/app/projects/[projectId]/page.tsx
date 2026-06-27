import { ensureUserWorkspace } from "@veriflow/api";
import { requireWebSession } from "../../../server-auth";
import { ProjectDetailClient } from "./project-detail-client";

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await requireWebSession();
  const { projectId } = await params;
  const workspace = await ensureUserWorkspace({
    user: session.user,
    session: session.session
  });

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <section className="mx-auto max-w-6xl space-y-8">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-400">
          {workspace.activeOrganization.name}
        </p>
        <ProjectDetailClient projectId={projectId} />
      </section>
    </main>
  );
}
