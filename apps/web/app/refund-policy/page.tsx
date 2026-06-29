import Link from "next/link";

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-12 text-[var(--text)]">
      <article className="mx-auto max-w-3xl space-y-8">
        <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
          Back to MergeMint
        </Link>
        <header>
          <h1 className="text-4xl font-semibold tracking-tight">Refund Policy</h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Last updated June 29, 2026
          </p>
        </header>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold">One-off credit packs</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            Phase 1 plans are one-off Razorpay checkout purchases for verified
            PR review credits. They are not recurring subscriptions.
          </p>
        </section>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold">Refund basics</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            If you purchased the wrong plan or cannot use MergeMint due to a
            product issue, contact support within 7 days. Used verified PR
            review credits may reduce or disqualify refund eligibility.
          </p>
        </section>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold">Manual pilots</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            Founder-assisted or manually granted credits may have custom terms
            shared during onboarding.
          </p>
        </section>
      </article>
    </main>
  );
}
