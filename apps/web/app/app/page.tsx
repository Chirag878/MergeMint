import Link from "next/link";
import { ensureUserWorkspace } from "@veriflow/api";
import { AppHomeProjectState } from "./project-state";
import { requireWebSession } from "../server-auth";

export default async function AppPage() {
  const session = await requireWebSession();
  const workspace = await ensureUserWorkspace({
    user: session.user,
    session: session.session
  });

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <section className="mx-auto max-w-4xl space-y-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-400">
            {workspace.activeOrganization.name}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Welcome to Veriflow
          </h1>
          <p className="mt-3 text-neutral-400">
            Signed in as {session.user.name || session.user.email}.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">Workspace</p>
            <p className="mt-2 font-medium">{workspace.activeOrganization.name}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">Role</p>
            <p className="mt-2 font-medium">{workspace.membership.role}</p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">Plan</p>
            <p className="mt-2 font-medium">{workspace.subscription.plan}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/app/projects"
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
          >
            Create Project
          </Link>
          <Link
            href="/app/projects"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500"
          >
            View Projects
          </Link>
          <Link
            href="/app/features"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500"
          >
            Create Feature Request
          </Link>
          <Link
            href="/app/features"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500"
          >
            View Features
          </Link>
        </div>

        <AppHomeProjectState />
      </section>
    </main>
  );
}
