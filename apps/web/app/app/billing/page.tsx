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
    <main className="vf-app-page min-h-screen px-5 py-8 text-[var(--text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-8">
        <div className="vf-page-hero">
          <p className="vf-page-eyebrow">
            {workspace.activeOrganization.name}
          </p>
          <div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Billing</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
              Manage verified PR review credits. Only AI QA Review consumes
              credits; the rest of the workflow remains open.
            </p>
          </div>
        </div>
        <BillingClient selectedPlanKey={checkoutPlan} />
      </section>
    </main>
  );
}
