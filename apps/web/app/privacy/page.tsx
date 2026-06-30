import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-12 text-[var(--text)]">
      <article className="mx-auto max-w-3xl space-y-8">
        <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
          Back to MergeMint
        </Link>
        <header>
          <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Last updated June 29, 2026
          </p>
        </header>
        {[
          [
            "What we collect",
            "We collect account details, workspace information, project and feature content, connected GitHub repository metadata, pull request evidence, AI QA results, approvals, reports, billing records, and basic product usage records."
          ],
          [
            "How we use data",
            "We use this data to operate MergeMint, generate requirement and release proof artifacts, verify pull requests, maintain billing credits, support users, and improve reliability."
          ],
          [
            "GitHub data",
            "Repository and PR data is used to provide verification. MergeMint stores compact metadata, snapshots, summaries, and evidence needed for the product. Do not connect repositories containing data you are not permitted to process."
          ],
          [
            "AI processing",
            "Feature requirements, PRDs, engineering tasks, PR diffs, and safe repository context may be sent to configured AI providers to generate clarification, PRD, task, and QA outputs."
          ],
          [
            "Payments",
            "Razorpay processes checkout details. MergeMint stores safe payment identifiers, plan keys, amounts, status, and credit history, not card details."
          ],
          [
            "Data retention",
            "Workspace, repository, PR, review, approval, report, billing, and audit records are retained while your workspace is active unless deletion is requested or a shorter retention period is required by law."
          ],
          [
            "Contact",
            "For privacy questions or deletion requests, contact the founder or support email provided during onboarding."
          ]
        ].map(([title, copy]) => (
          <section
            key={title}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6"
          >
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {copy}
            </p>
          </section>
        ))}
      </article>
    </main>
  );
}
