import Link from "next/link";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updatedAt="June 29, 2026">
      <Section title="Service">
        MergeMint helps teams connect requirements, GitHub pull request
        evidence, AI QA review, human approval, and shareable release reports.
        It does not merge pull requests or replace your engineering judgment.
      </Section>
      <Section title="AI output">
        AI-generated analysis can be incomplete or incorrect. You are
        responsible for reviewing findings, approving releases, and deciding
        whether code is safe to ship.
      </Section>
      <Section title="Repository data">
        MergeMint processes repository metadata, pull request diffs, safe repo
        context, PRDs, requirements, tasks, reviews, approvals, and reports to
        provide the service. Do not connect repositories you are not authorized
        to use.
      </Section>
      <Section title="Payments">
        Phase 1 billing uses one-off Razorpay checkout orders for verified PR
        review credits. Credits are consumed only after successful AI QA Review
        creation.
      </Section>
      <Section title="Contact">
        Questions about these terms can be sent to your MergeMint support
        contact or the founder email shared during onboarding.
      </Section>
    </LegalPage>
  );
}

function LegalPage({
  title,
  updatedAt,
  children
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-12 text-[var(--text)]">
      <article className="mx-auto max-w-3xl space-y-8">
        <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
          Back to MergeMint
        </Link>
        <header>
          <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Last updated {updatedAt}
          </p>
        </header>
        <div className="space-y-6">{children}</div>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{children}</p>
    </section>
  );
}
