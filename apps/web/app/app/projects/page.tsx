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
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <section className="mx-auto max-w-5xl space-y-8">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-400">
          {workspace.activeOrganization.name}
        </p>
        <div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Organize client or product work before drafting feature requests.
          </p>
        </div>
        <ProjectsClient initialProjectId={projectId} />
      </section>
    </main>
  );
}
