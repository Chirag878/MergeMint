import Link from "next/link";

export default function PrivateAppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-900 bg-neutral-950/95 px-6 py-4">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <Link href="/app" className="text-sm font-semibold tracking-tight">
            Veriflow
          </Link>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/app/projects"
              className="rounded-md border border-neutral-800 px-3 py-2 text-neutral-300 transition hover:border-neutral-600 hover:text-neutral-100"
            >
              Projects
            </Link>
            <Link
              href="/app/clients"
              className="rounded-md border border-neutral-800 px-3 py-2 text-neutral-300 transition hover:border-neutral-600 hover:text-neutral-100"
            >
              Clients
            </Link>
            <Link
              href="/app/features"
              className="rounded-md border border-neutral-800 px-3 py-2 text-neutral-300 transition hover:border-neutral-600 hover:text-neutral-100"
            >
              Features
            </Link>
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}
