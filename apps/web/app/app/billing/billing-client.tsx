"use client";

import Link from "next/link";
import { BILLING_PLANS, PAID_BILLING_PLAN_KEYS } from "@veriflow/shared";
import { trpc } from "@/trpc/react";
import { ProtectedCheckoutButton } from "./protected-checkout-button";

function formatDate(value?: Date | string | null) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount / 100);
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function BillingClient({ selectedPlanKey }: { selectedPlanKey?: string }) {
  const entitlement = trpc.billing.getCurrentEntitlement.useQuery();
  const paymentHistory = trpc.billing.getPaymentHistory.useQuery();
  const creditEvents = trpc.billing.getCreditEvents.useQuery();
  const paidPlans = PAID_BILLING_PLAN_KEYS.map((key) => BILLING_PLANS[key]);
  const selectedPlan = PAID_BILLING_PLAN_KEYS.includes(
    selectedPlanKey as (typeof PAID_BILLING_PLAN_KEYS)[number]
  )
    ? BILLING_PLANS[selectedPlanKey as (typeof PAID_BILLING_PLAN_KEYS)[number]]
    : null;
  const currentPlan = entitlement.data
    ? BILLING_PLANS[entitlement.data.planKey as keyof typeof BILLING_PLANS]
    : null;
  const latestPaidPayment = paymentHistory.data?.find(
    (payment) => payment.status === "paid"
  );
  const activationPending =
    Boolean(latestPaidPayment) && entitlement.data?.source !== "razorpay";

  if (entitlement.isLoading) {
    return (
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
        Loading billing state...
      </section>
    );
  }

  if (entitlement.error) {
    return (
      <section className="rounded-lg border border-red-900/60 bg-red-950/30 p-6 text-sm text-red-200">
        {entitlement.error.message}
      </section>
    );
  }

  const data = entitlement.data;

  return (
    <div className="space-y-8">
      {selectedPlan ? (
        <section className="rounded-lg border border-[var(--mint)]/35 bg-[var(--mint)]/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[var(--text)]">
              You selected{" "}
              <span className="font-semibold text-[var(--mint)]">
                {selectedPlan.displayName}
              </span>
              . Continue checkout to activate your plan.
            </p>
            <ProtectedCheckoutButton
              plan={selectedPlan}
              className="rounded-md bg-[var(--mint)] px-4 py-2 text-sm font-semibold text-[#070A09] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue checkout
            </ProtectedCheckoutButton>
          </div>
        </section>
      ) : null}

      {activationPending ? (
        <section className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4 text-sm text-[var(--warning)]">
          Payment received. Activation pending manual verification. Please do
          not pay again. We will activate your plan within 24 hours.
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--mint)]">
                Current plan
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                {currentPlan?.displayName ?? data?.planKey ?? "Free"}
              </h2>
              <p className="mt-2 text-sm capitalize text-[var(--text-muted)]">
                Status: {formatLabel(data?.status ?? "unknown")}
              </p>
            </div>
            {data?.upgradeRequired ? (
              <Link
                href="/pricing"
                className="rounded-md bg-[var(--mint)] px-4 py-2 text-sm font-semibold text-[#070A09]"
              >
                Upgrade
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Metric label="Used" value={data?.prUsed ?? 0} />
            <Metric label="Remaining" value={data?.remainingCredits ?? 0} />
            <Metric label="Limit" value={data?.prLimit ?? 0} />
          </div>

          <p className="mt-5 rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 text-sm text-[var(--text-muted)]">
            Valid until:{" "}
            <span className="font-semibold text-[var(--text)]">
              {formatDate(data?.currentPeriodEnd)}
            </span>
          </p>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold">Credit rule</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            A credit is consumed only after a successful AI QA Review for a
            feature and linked GitHub PR. Project setup, repo analysis, PRDs,
            engineering tasks, PR linking, approvals, and reports remain open.
          </p>
          {data?.planKey === "free" ? (
            <p className="mt-4 rounded-md border border-[var(--mint)]/30 bg-[var(--mint)]/10 p-3 text-sm text-[var(--mint)]">
              Free workspaces include 1 free PR review.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold">Upgrade options</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {paidPlans.map((plan) => (
            <article
              key={plan.key}
              className={`rounded-lg border bg-[var(--bg)] p-4 ${
                plan.recommended
                  ? "border-[var(--mint)]"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{plan.displayName}</h3>
                {plan.recommended ? (
                  <span className="rounded-full bg-[var(--mint)] px-2 py-0.5 text-[10px] font-bold text-[#070A09]">
                    Recommended
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-2xl font-bold">{plan.displayPrice}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {plan.credits} PR reviews / {plan.validityDays} days
              </p>
              <ProtectedCheckoutButton
                plan={plan}
                className="mt-4 w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-semibold transition hover:border-[var(--mint)]/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Choose {plan.displayName}
              </ProtectedCheckoutButton>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <HistoryPanel title="Payment history" loading={paymentHistory.isLoading}>
          {paymentHistory.data?.length ? (
            paymentHistory.data.map((payment) => (
              <article
                key={payment.id}
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{formatLabel(payment.planKey)}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {payment.razorpayOrderId}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs capitalize">
                    {payment.status}
                  </span>
                </div>
                <p className="mt-3 text-[var(--text-muted)]">
                  {formatAmount(payment.amount, payment.currency)} - created{" "}
                  {formatDate(payment.createdAt)}
                </p>
              </article>
            ))
          ) : (
            <EmptyText>No payments recorded yet.</EmptyText>
          )}
        </HistoryPanel>

        <HistoryPanel title="Credit event history" loading={creditEvents.isLoading}>
          {creditEvents.data?.length ? (
            creditEvents.data.map((event) => (
              <article
                key={event.id}
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="font-semibold">{formatLabel(event.eventType)}</p>
                  <span
                    className={
                      event.creditsDelta >= 0
                        ? "text-[var(--mint)]"
                        : "text-[var(--warning)]"
                    }
                  >
                    {event.creditsDelta > 0 ? "+" : ""}
                    {event.creditsDelta}
                  </span>
                </div>
                <p className="mt-2 text-[var(--text-muted)]">
                  {event.reason ?? "No reason recorded."}
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {formatDate(event.createdAt)}
                </p>
              </article>
            ))
          ) : (
            <EmptyText>No credit events recorded yet.</EmptyText>
          )}
        </HistoryPanel>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function HistoryPanel({
  title,
  loading,
  children
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {loading ? <EmptyText>Loading...</EmptyText> : children}
      </div>
    </section>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 text-sm text-[var(--text-muted)]">
      {children}
    </p>
  );
}
