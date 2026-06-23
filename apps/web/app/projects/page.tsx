import { requireWebSession } from "../server-auth";

export default async function ProjectsPage() {
  await requireWebSession();

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <section className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
      </section>
    </main>
  );
}
