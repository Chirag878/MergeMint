import { ensureUserWorkspace } from "@veriflow/api";
import { ProjectsClient } from "./projects-client";
import { requireWebSession } from "../../server-auth";

export default async function AppProjectsPage({
  searchParams
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await requireWebSession();
  const { projectId } = await searchParams;
  const workspace = await ensureUserWorkspace({
    user: session.user,
    session: session.session
  });

  return (
    <main className="vf-app-page min-h-screen px-5 py-8 text-neutral-100 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl space-y-8">
        <p className="vf-page-eyebrow">
          {workspace.activeOrganization.name}
        </p>
        <ProjectsClient initialProjectId={projectId} />
      </section>
    </main>
  );
}
