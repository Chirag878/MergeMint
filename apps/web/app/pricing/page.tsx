import Link from "next/link";
import { ThemeToggle } from "../components/theme-provider";

const pricingPlans = [
  {
    id: "launch-pack",
    name: "Launch Pack",
    price: "₹199",
    billing: "one-time access",
    prs: "3 verified PRs",
    validity: "1 month access",
    offerNote: "Valid until 30 June",
    bestFor: "Trying MergeMint on a real project",
    ctaText: "Get launch offer",
    ctaHref: "mailto:hello@mergemint.com?subject=Launch%20Pack%20Offer",
    isExternal: true,
    highlight: false
  },
  {
    id: "pilot",
    name: "Pilot",
    price: "$21",
    billing: "/month",
    prs: "30 verified PRs/month",
    validity: "Monthly subscription",
    bestFor: "Freelancers and solo builders",
    ctaText: "Start pilot",
    ctaHref: "/login",
    isExternal: false,
    highlight: false
  },
  {
    id: "studio",
    name: "Studio",
    price: "$51",
    billing: "/month",
    prs: "90 verified PRs/month",
    validity: "Monthly subscription",
    bestFor: "Agencies shipping client work",
    ctaText: "Choose Studio",
    ctaHref: "/login",
    isExternal: false,
    badge: "Recommended",
    highlight: true
  },
  {
    id: "scale",
    name: "Scale",
    price: "$99",
    billing: "/month",
    prs: "220 verified PRs/month",
    validity: "Monthly subscription",
    bestFor: "Product teams and AI studios",
    ctaText: "Choose Scale",
    ctaHref: "/login",
    isExternal: false,
    highlight: false
  },
  {
    id: "agency-max",
    name: "Agency Max",
    price: "$199",
    billing: "/month",
    prs: "Fair-use 600 verified PRs/month",
    validity: "Monthly subscription",
    bestFor: "High-volume agencies",
    ctaText: "Talk to us",
    ctaHref: "mailto:hello@mergemint.com?subject=Agency%20Max%20Inquiry",
    isExternal: true,
    highlight: false
  }
];

const includedFeatures = [
  "GitHub App connection",
  "Repository analysis",
  "Requirement Review",
  "PRD generation",
  "REQ-ID mapping",
  "Acceptance criteria",
  "Engineering tasks",
  "PR diff verification",
  "Coverage matrix",
  "Human approval gate",
  "Shareable release reports",
  "Release Board"
];

const faqs = [
  {
    question: "Do you charge per developer?",
    answer:
      "No. MergeMint is priced around verified PRs, so agencies and teams pay based on release volume instead of team size."
  },
  {
    question: "What happens if I exceed my PR limit?",
    answer:
      "You can upgrade to the next plan or contact us for additional usage."
  },
  {
    question: "Is the Launch Pack recurring?",
    answer:
      "No. It is an early access launch offer with 1 month access."
  },
  {
    question: "What is the best plan for agencies?",
    answer:
      "Studio is best for small agencies. Scale or Agency Max is better for teams shipping many client releases every month."
  }
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] font-sans text-[var(--text)] transition-colors duration-200">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mint)]/30 bg-[var(--mint)]/10 text-xs font-bold text-[var(--mint)]">
              MM
            </span>
            <span className="text-base font-semibold tracking-tight text-[var(--text)]">
              MergeMint
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-xs font-medium text-[var(--text-muted)] md:flex">
            <Link href="/#product" className="transition hover:text-[var(--text)]">
              Product
            </Link>
            <Link href="/#how-it-works" className="transition hover:text-[var(--text)]">
              How it works
            </Link>
            <Link href="/pricing" className="font-semibold text-[var(--mint)]">
              Pricing
            </Link>
            <Link href="/#proof-map" className="transition hover:text-[var(--text)]">
              Resources
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="gradient-btn-mint-pink rounded-md px-3.5 py-1.5 text-xs font-bold shadow-xs"
            >
              Start verifying
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--mint)]/30 bg-[var(--mint)]/10 px-3 py-1 text-xs font-medium text-[var(--mint)]">
            Transparent Delivery Pricing
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
            Pricing built around verified PRs.
          </h1>
          <p className="mt-5 text-base leading-7 text-[var(--text-muted)] sm:text-lg">
            Pay for release proof, not another developer seat. MergeMint verifies pull requests against requirements, repo context, QA evidence, and approval state before you ship.
          </p>
          <p className="mt-3 text-xs font-semibold text-[var(--blue)]">
            Built for agencies, AI studios, freelancers, and product teams that need proof before delivery.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4 xl:gap-6">
          {pricingPlans.map((plan) => {
            const isHighlight = plan.highlight;
            return (
              <div
                key={plan.id}
                className={`mint-card relative flex flex-col justify-between p-6 ${
                  isHighlight
                    ? "border-2 border-[var(--mint)] bg-[var(--surface-elevated)] shadow-md"
                    : ""
                }`}
              >
                {plan.badge ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--mint)] px-3 py-0.5 text-[10px] font-bold text-[#070A09] uppercase tracking-wider">
                    {plan.badge}
                  </div>
                ) : null}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-[var(--text)]">{plan.name}</h3>
                    {plan.offerNote ? (
                      <span className="rounded bg-[var(--warning)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
                        {plan.offerNote}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight text-[var(--text)]">
                      {plan.price}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{plan.billing}</span>
                  </div>

                  <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 text-xs">
                    <p className="font-bold text-[var(--mint)]">{plan.prs}</p>
                    <p className="mt-0.5 text-[var(--text-muted)]">{plan.validity}</p>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text)]">Best for:</span> {plan.bestFor}
                  </p>
                </div>

                <div className="mt-8">
                  {plan.isExternal ? (
                    <a
                      href={plan.ctaHref}
                      className={`block w-full rounded-md px-4 py-2 text-center text-xs font-semibold transition ${
                        isHighlight
                          ? "gradient-btn-mint-pink"
                          : "border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text)] hover:border-[var(--mint)]/40"
                      }`}
                    >
                      {plan.ctaText}
                    </a>
                  ) : (
                    <Link
                      href={plan.ctaHref}
                      className={`block w-full rounded-md px-4 py-2 text-center text-xs font-semibold transition ${
                        isHighlight
                          ? "gradient-btn-mint-pink"
                          : "border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text)] hover:border-[var(--mint)]/40"
                      }`}
                    >
                      {plan.ctaText}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* What counts as a verified PR section */}
        <section className="mt-20 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-xs lg:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              What counts as a verified PR?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              A verified PR means MergeMint links a pull request, reviews the diff against the PRD, REQ-IDs, acceptance criteria, engineering tasks, and repository context, then produces QA evidence for approval.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "01", title: "Link PR", desc: "Attach pull request from your connected GitHub repository." },
              { step: "02", title: "Analyze Diff", desc: "Compare code changes against PRD and REQ-ID mapped criteria." },
              { step: "03", title: "Generate Evidence", desc: "Produce structured QA review and risk finding summary." },
              { step: "04", title: "Release Approval", desc: "Record human approval and publish shareable release report." }
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 text-left"
              >
                <span className="text-xs font-mono font-bold text-[var(--blue)]">{item.step}</span>
                <h3 className="mt-1.5 text-sm font-semibold text-[var(--text)]">{item.title}</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)] leading-5">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Value Comparison Section */}
        <section className="mt-14 rounded-2xl border border-[var(--blue)]/20 bg-[var(--blue)]/5 p-8 text-center lg:p-10">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            Not another seat-based code review tool.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Most tools charge per developer seat. MergeMint is priced around release volume, so you pay for the PRs you actually verify and deliver.
          </p>
          <div className="mt-6 inline-block rounded-xl border border-[var(--mint)]/30 bg-[var(--surface)] px-6 py-3.5 shadow-xs">
            <p className="text-sm font-bold tracking-wide text-[var(--mint)] sm:text-base">
              GitHub shows what changed. MergeMint shows whether it is actually done.
            </p>
          </div>
        </section>

        {/* Included Features Section */}
        <section className="mt-16">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              Everything included across all plans
            </h2>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Complete requirement-to-release proof pipeline out of the box.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {includedFeatures.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5 text-xs font-medium text-[var(--text)] shadow-xs"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--mint)]/15 text-[10px] font-bold text-[var(--mint)]">
                  ✓
                </span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-20 max-w-3xl mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-8 space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.question}
                className="mint-card p-5 text-left"
              >
                <h3 className="text-sm font-bold text-[var(--text)]">
                  {faq.question}
                </h3>
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mt-20 text-center">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 lg:p-12 shadow-xs">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              Ready to verify your next release?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-xs text-[var(--text-muted)] leading-5">
              Get complete release proof for your pull requests with AI requirement verification and shareable client reports.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/login"
                className="gradient-btn-mint-pink rounded-md px-6 py-2.5 text-xs font-bold shadow-xs"
              >
                Start verifying now
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-8 text-xs text-[var(--text-muted)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 place-items-center rounded border border-[var(--mint)]/30 bg-[var(--mint)]/10 text-[10px] font-bold text-[var(--mint)]">
              MM
            </span>
            <span className="font-semibold text-[var(--text)]">MergeMint</span>
            <span>- Requirement-to-release proof platform.</span>
          </div>
          <div className="flex gap-6">
            <Link href="/" className="transition hover:text-[var(--text)]">
              Home
            </Link>
            <Link href="/pricing" className="transition hover:text-[var(--text)]">
              Pricing
            </Link>
            <Link href="/login" className="transition hover:text-[var(--text)]">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
