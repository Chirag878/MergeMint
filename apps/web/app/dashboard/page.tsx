import { requireWebSession } from "../server-auth";

export default async function DashboardPage() {
  const session = await requireWebSession();

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <section className="mx-auto max-w-4xl">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-400">
          Dashboard
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          Welcome to Veriflow
        </h1>
        <p className="mt-4 text-neutral-400">
          Signed in as {session.user.name || session.user.email}.
        </p>
      </section>
    </main>
  );
}
