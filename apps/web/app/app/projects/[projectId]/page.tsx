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
    <main className="vf-app-page min-h-screen px-5 py-8 text-neutral-100 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-8">
        <p className="vf-page-eyebrow">
          {workspace.activeOrganization.name}
        </p>
        <ProjectDetailClient projectId={projectId} />
      </section>
    </main>
  );
}
