"use client";

import { FormEvent, useState } from "react";
import { BILLING_PLANS, PAID_BILLING_PLAN_KEYS, type BillingPlanKey } from "@veriflow/shared";
import { trpc } from "@/trpc/react";

const grantPlanKeys = ["free", ...PAID_BILLING_PLAN_KEYS] as BillingPlanKey[];

function formatDate(value?: Date | string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not set";
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function AdminAccessClient() {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [searchedEmail, setSearchedEmail] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [planKey, setPlanKey] = useState<BillingPlanKey>("launch_pack");
  const [credits, setCredits] = useState(3);
  const [validityDays, setValidityDays] = useState(30);
  const [source, setSource] = useState<"manual" | "demo">("manual");
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  const lookup = trpc.billing.adminLookupCustomer.useQuery(
    { email: searchedEmail },
    { enabled: searchedEmail.trim().length > 0 }
  );
  const grantAccess = trpc.billing.adminGrantAccess.useMutation({
    onSuccess: async () => {
      setSuccess("Manual access granted.");
      await utils.billing.adminLookupCustomer.invalidate();
    }
  });

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    setSearchedEmail(email.trim());
  }

  function selectCustomer(targetEmail: string) {
    setCustomerEmail(targetEmail);
    setSuccess(null);
  }

  function onGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    grantAccess.mutate({
      customerEmail: customerEmail.trim(),
      planKey,
      prCreditAmount: credits,
      validityDays,
      source,
      note: note.trim() || undefined
    });
  }

  function applyPlanDefaults(nextPlanKey: BillingPlanKey) {
    const plan = BILLING_PLANS[nextPlanKey];
    setPlanKey(nextPlanKey);
    setCredits(plan.credits);
    setValidityDays(plan.validityDays || 30);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold">Find customer</h2>
        <form onSubmit={onSearch} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--mint)]"
            placeholder="customer@example.com"
          />
          <button
            type="submit"
            disabled={!email.trim() || lookup.isFetching}
            className="rounded-md bg-[var(--mint)] px-4 py-2 text-sm font-semibold text-[#070A09] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {lookup.isFetching ? "Searching..." : "Search"}
          </button>
        </form>

        {lookup.error ? (
          <p className="mt-4 rounded-md border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
            {lookup.error.message}
          </p>
        ) : null}

        <div className="mt-5 space-y-3">
          {lookup.data?.map((row) => (
            <article
              key={`${row.user.id}-${row.organization?.id ?? "none"}`}
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{row.user.email}</p>
                  <p className="mt-1 text-[var(--text-muted)]">
                    {row.organization?.name ?? "No workspace"} -{" "}
                    {row.membership?.role ?? "No role"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => selectCustomer(row.user.email)}
                  disabled={!row.organization}
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold transition hover:border-[var(--mint)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Select
                </button>
              </div>
              {row.entitlement ? (
                <div className="mt-4 grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-3">
                  <p>Plan: {formatLabel(row.entitlement.planKey)}</p>
                  <p>
                    Credits: {row.entitlement.prUsed}/
                    {row.entitlement.prLimit}
                  </p>
                  <p>Valid: {formatDate(row.entitlement.currentPeriodEnd)}</p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  Free entitlement will initialize on first billing lookup.
                </p>
              )}
            </article>
          ))}
          {lookup.data && lookup.data.length === 0 ? (
            <p className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 text-sm text-[var(--text-muted)]">
              No customer found.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold">Grant access</h2>
        <p className="mt-2 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 text-xs leading-5 text-[var(--text-muted)]">
          Use this only for verified captured payments or early pilot access.
          For captured Razorpay payments that are not linked to a workspace,
          verify the payment in Razorpay first, then manually grant the exact
          matching plan here. Do not infer a workspace unless the customer
          identity is exact and safe.
        </p>
        <form onSubmit={onGrant} className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Customer email</span>
            <input
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 outline-none transition focus:border-[var(--mint)]"
              type="email"
              required
            />
          </label>

          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Plan</span>
            <select
              value={planKey}
              onChange={(event) =>
                applyPlanDefaults(event.target.value as BillingPlanKey)
              }
              className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 outline-none transition focus:border-[var(--mint)]"
            >
              {grantPlanKeys.map((key) => (
                <option key={key} value={key}>
                  {BILLING_PLANS[key].displayName}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">PR credits</span>
              <input
                value={credits}
                onChange={(event) => setCredits(Number(event.target.value))}
                className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 outline-none transition focus:border-[var(--mint)]"
                min={0}
                type="number"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Validity days</span>
              <input
                value={validityDays}
                onChange={(event) => setValidityDays(Number(event.target.value))}
                className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 outline-none transition focus:border-[var(--mint)]"
                min={0}
                max={730}
                type="number"
                required
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Source</span>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as "manual" | "demo")}
              className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 outline-none transition focus:border-[var(--mint)]"
            >
              <option value="manual">manual</option>
              <option value="demo">demo</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Admin note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 outline-none transition focus:border-[var(--mint)]"
              placeholder="Why access was granted"
            />
          </label>

          <button
            type="submit"
            disabled={!customerEmail.trim() || grantAccess.isPending}
            className="w-full rounded-md bg-[var(--mint)] px-4 py-2 text-sm font-semibold text-[#070A09] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {grantAccess.isPending ? "Granting..." : "Grant access"}
          </button>
        </form>

        {success ? (
          <p className="mt-4 rounded-md border border-[var(--mint)]/30 bg-[var(--mint)]/10 p-3 text-sm text-[var(--mint)]">
            {success}
          </p>
        ) : null}
        {grantAccess.error ? (
          <p className="mt-4 rounded-md border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
            {grantAccess.error.message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
