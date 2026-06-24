import { ensureUserWorkspace } from "@veriflow/api";
import { ClientLedgerClient } from "./client-ledger-client";
import { requireWebSession } from "../../../server-auth";

export default async function ClientLedgerPage({
  params
}: {
  params: Promise<{ clientId: string }>;
}) {
  const session = await requireWebSession();
  const workspace = await ensureUserWorkspace({
    user: session.user,
    session: session.session
  });
  const { clientId } = await params;

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <section className="mx-auto max-w-7xl space-y-8">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-400">
          {workspace.activeOrganization.name}
        </p>
        <ClientLedgerClient clientId={clientId} />
      </section>
    </main>
  );
}
