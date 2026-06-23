"use client";

import { trpc } from "@/trpc/react";

export default function HomePage() {
  const health = trpc.health.ping.useQuery();

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
          Veriflow checks whether a GitHub pull request satisfies the original
          requirements and generates a release approval report.
        </p>

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