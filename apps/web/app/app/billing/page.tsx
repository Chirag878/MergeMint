import { ensureUserWorkspace } from "@veriflow/api";
import { requireWebSession } from "../../server-auth";
import { BillingClient } from "./billing-client";

export default async function AppBillingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params: Record<string, string | string[] | undefined> =
    await Promise.resolve(searchParams ?? {});
  const checkoutPlan =
    typeof params.checkoutPlan === "string" ? params.checkoutPlan : undefined;
  const callbackURL = checkoutPlan
    ? `/app/billing?checkoutPlan=${encodeURIComponent(checkoutPlan)}`
    : "/app/billing";
  const session = await requireWebSession(callbackURL);
  const workspace = await ensureUserWorkspace({
    user: session.user,
    session: session.session
  });

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)]">
      <section className="mx-auto max-w-7xl space-y-8">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-[var(--mint)]">
          {workspace.activeOrganization.name}
        </p>
        <div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Billing</h1>
          <p className="mt-3 max-w-2xl text-[var(--text-muted)]">
            Manage verified PR review credits. Only AI QA Review consumes
            credits; the rest of the workflow remains open.
          </p>
        </div>
        <BillingClient selectedPlanKey={checkoutPlan} />
      </section>
    </main>
  );
}
