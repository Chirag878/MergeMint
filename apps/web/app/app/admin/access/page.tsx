import { requireWebSession } from "../../../server-auth";
import { AdminAccessClient } from "./admin-access-client";

function isAdminEmail(email?: string | null) {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(email && admins.includes(email.toLowerCase()));
}

export default async function AdminAccessPage() {
  const session = await requireWebSession();

  if (!isAdminEmail(session.user.email)) {
    return (
      <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)]">
        <section className="mx-auto max-w-3xl rounded-lg border border-red-900/60 bg-red-950/30 p-6 text-red-100">
          <h1 className="text-2xl font-semibold">Billing admin access denied</h1>
          <p className="mt-3 text-sm leading-6">
            Your signed-in email is not listed in ADMIN_EMAILS.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)]">
      <section className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-[var(--mint)]">
            Owner tools
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Manual billing access
          </h1>
          <p className="mt-3 max-w-2xl text-[var(--text-muted)]">
            Search a customer by email and grant one-off PR review credits for
            manual pilots, demo accounts, or support cases.
          </p>
        </div>
        <AdminAccessClient />
      </section>
    </main>
  );
}
