import { ensureUserWorkspace } from "@veriflow/api";
import { requireWebSession } from "../../server-auth";

export default async function AppProjectsPage() {
  const session = await requireWebSession();
  const workspace = await ensureUserWorkspace({
    user: session.user,
    session: session.session
  });

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <section className="mx-auto max-w-4xl">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-400">
          {workspace.activeOrganization.name}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-3 max-w-2xl text-neutral-400">
          Create projects through the `projects.create` tRPC procedure. The UI
          form can stay thin on top of that protected API.
        </p>
      </section>
    </main>
  );
}
