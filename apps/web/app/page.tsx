"use client";

import { trpc } from "@/trpc/react";

export default function HomePage() {
  const health = trpc.health.ping.useQuery();
  const paymentLink = process.env.NEXT_PUBLIC_PAYMENT_LINK;
  const ctaHref =
    paymentLink ??
    "mailto:hello@veriflow.dev?subject=Veriflow%20founding%20pilot";

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <section className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-900/70 p-8 shadow-2xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-blue-400">
          Veriflow
        </p>

        <h1 className="text-4xl font-semibold tracking-tight">
          Verify every PR before release.
        </h1>

        <p className="mt-4 text-lg leading-8 text-neutral-400">
          Turn requirements, GitHub PRs, AI review, and human approval into a
          client-ready release report.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={ctaHref}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
          >
            Start founding pilot
          </a>
          <a
            href="#contact"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500"
          >
            DM/email to start pilot
          </a>
        </div>

        <div className="mt-8 rounded-xl border border-blue-900/60 bg-blue-950/20 p-5">
          <p className="text-sm text-blue-200">Founding Pilot</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-100">₹2,999</p>
          <p className="mt-3 text-sm leading-6 text-neutral-300">
            Includes 5 PR verifications and shareable release reports.
          </p>
          <p className="mt-3 text-sm text-neutral-500">
            Manual onboarding available this week.
          </p>
        </div>

        <div
          id="contact"
          className="mt-8 rounded-xl border border-neutral-800 bg-neutral-950 p-5"
        >
          <p className="text-sm text-neutral-500">Pilot contact</p>
          <p className="mt-2 text-sm text-neutral-300">
            DM/email to start pilot.
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <p className="text-sm text-neutral-500">tRPC Health Check</p>

          <div className="mt-2 text-lg font-medium">
            {health.isLoading && "Checking API..."}
            {health.error && (
              <span className="text-red-400">
                API error: {health.error.message}
              </span>
            )}
            {health.data && (
              <span className="text-green-400">
                {health.data.service} API is running.
              </span>
            )}
          </div>

          {health.data && (
            <p className="mt-2 text-sm text-neutral-500">
              Server timestamp: {health.data.timestamp}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
