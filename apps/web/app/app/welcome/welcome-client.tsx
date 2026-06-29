"use client";

import Link from "next/link";
import { BILLING_PLANS } from "@veriflow/shared";
import { trpc } from "@/trpc/react";

const nextSteps = [
  "Create or open a project",
  "Connect GitHub",
  "Pick a repository",
  "Create a feature request",
  "Generate PRD",
  "Generate engineering tasks",
  "Link a PR",
  "Run QA review",
  "Approve and generate report"
];

export function WelcomeClient({ payment }: { payment?: string }) {
  const entitlement = trpc.billing.getCurrentEntitlement.useQuery();
  const planKey = entitlement.data?.planKey as keyof typeof BILLING_PLANS | undefined;
  const plan = planKey ? BILLING_PLANS[planKey] : null;
  const paymentSuccess = payment === "success";

  return (
    <div className="space-y-6">
      {paymentSuccess ? (
        <section className="rounded-lg border border-[var(--mint)]/35 bg-[var(--mint)]/10 p-4 text-sm text-[var(--mint)]">
          Payment verified. Your workspace plan is active.
        </section>
      ) : null}

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--mint)]">
              Welcome to MergeMint
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">
              Turn requirements into release proof.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              MergeMint helps you create feature requirements, generate PRDs and
              engineering tasks, link pull requests, run AI QA review, collect
              approval, and publish a shareable release report.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric
                label="Plan"
                value={
                  entitlement.isLoading
                    ? "Loading..."
                    : plan?.displayName ?? entitlement.data?.planKey ?? "Free"
                }
              />
              <Metric
                label="Credits available"
                value={
                  entitlement.isLoading
                    ? "Loading..."
                    : String(entitlement.data?.remainingCredits ?? 0)
                }
              />
              <Metric
                label="Credit limit"
                value={
                  entitlement.isLoading
                    ? "Loading..."
                    : String(entitlement.data?.prLimit ?? 0)
                }
              />
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/app"
                className="rounded-md bg-[var(--mint)] px-4 py-2 text-sm font-semibold text-[#070A09]"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/app/projects"
                className="rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--mint)]/50"
              >
                Create Project
              </Link>
              <Link
                href="/app/billing"
                className="rounded-md px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
              >
                View Billing
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Next-step checklist
            </h2>
            <ol className="mt-4 space-y-3">
              {nextSteps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm text-[var(--text)]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--mint)]/15 text-xs font-bold text-[var(--mint)]">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}
