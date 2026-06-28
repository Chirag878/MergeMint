import Link from "next/link";

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
    ctaHref: "mailto:tiwarichirag19@gmail.com?subject=Launch%20Pack%20Offer",
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
    id: "elite",
    name: "Elite",
    price: "$199",
    billing: "/month",
    prs: "Fair-use 600 verified PRs/month",
    validity: "Monthly subscription",
    bestFor: "High-volume agencies",
    ctaText: "Talk to us",
    ctaHref: "mailto:tiwarichirag19@gmail.com?subject=Elite%20Plan%20Inquiry",
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
    <div className="min-h-screen bg-[#101312] font-sans text-white selection:bg-[#ABFF57]/30 selection:text-[#ABFF57]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-[#3F3F3F]/40 bg-[#101312]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-[#ABFF57]/40 bg-[#ABFF57]/10 text-sm font-bold text-[#ABFF57]">
              MM
            </span>
            <span className="text-base font-semibold tracking-normal text-white">
              MergeMint
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-[#A7B0AA] md:flex">
            <Link href="/" className="transition hover:text-white">
              Product
            </Link>
            <Link href="/pricing" className="font-medium text-[#ABFF57]">
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm text-[#A7B0AA] transition hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-md bg-[#ABFF57] px-4 py-2 text-sm font-semibold text-[#101312] transition hover:bg-[#b8ff6d]"
            >
              Start verifying
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ABFF57]/30 bg-[#ABFF57]/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-[#ABFF57]">
            Proof OS Pricing
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Pricing built around verified PRs.
          </h1>
          <p className="mt-6 text-lg leading-8 text-[#A7B0AA]">
            Pay for release proof, not another developer seat. MergeMint verifies pull requests against requirements, repo context, QA evidence, and approval state before you ship.
          </p>
          <p className="mt-3 text-sm font-medium text-[#51BFFF]">
            Built for agencies, AI studios, freelancers, and product teams that need proof before delivery.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4 xl:gap-6">
          {pricingPlans.map((plan) => {
            const isHighlight = plan.highlight;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-xl p-6 transition-all duration-200 ${
                  isHighlight
                    ? "border-2 border-[#ABFF57] bg-[#202623] shadow-2xl shadow-[#ABFF57]/10"
                    : "border border-[#3F3F3F]/60 bg-[#171B19] hover:border-[#3F3F3F]"
                }`}
              >
                {plan.badge ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#ABFF57] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#101312]">
                    {plan.badge}
                  </div>
                ) : null}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                    {plan.offerNote ? (
                      <span className="rounded bg-[#FE6E26]/15 px-2 py-0.5 text-[10px] font-semibold text-[#FE6E26]">
                        {plan.offerNote}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                      {plan.price}
                    </span>
                    <span className="text-xs text-[#A7B0AA]">{plan.billing}</span>
                  </div>

                  <div className="mt-4 rounded-lg border border-[#3F3F3F]/40 bg-[#101312]/60 p-3 text-xs">
                    <p className="font-semibold text-[#ABFF57]">{plan.prs}</p>
                    <p className="mt-1 text-[#A7B0AA]">{plan.validity}</p>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-[#A7B0AA]">
                    <span className="font-medium text-white">Best for:</span> {plan.bestFor}
                  </p>
                </div>

                <div className="mt-8">
                  {plan.isExternal ? (
                    <a
                      href={plan.ctaHref}
                      className={`block w-full rounded-lg px-4 py-2.5 text-center text-xs font-semibold transition ${
                        isHighlight
                          ? "bg-[#ABFF57] text-[#101312] hover:bg-[#b8ff6d]"
                          : "border border-[#3F3F3F] bg-[#202623] text-white hover:bg-[#202623]/80"
                      }`}
                    >
                      {plan.ctaText}
                    </a>
                  ) : (
                    <Link
                      href={plan.ctaHref}
                      className={`block w-full rounded-lg px-4 py-2.5 text-center text-xs font-semibold transition ${
                        isHighlight
                          ? "bg-[#ABFF57] text-[#101312] hover:bg-[#b8ff6d]"
                          : "border border-[#3F3F3F] bg-[#202623] text-white hover:bg-[#202623]/80"
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
        <section className="mt-24 rounded-2xl border border-[#3F3F3F]/60 bg-[#171B19] p-8 lg:p-12">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              What counts as a verified PR?
            </h2>
            <p className="mt-4 text-base leading-7 text-[#A7B0AA]">
              A verified PR means MergeMint links a pull request, reviews the diff against the PRD, REQ-IDs, acceptance criteria, engineering tasks, and repository context, then produces QA evidence for approval.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "01", title: "Link PR", desc: "Attach pull request from your connected GitHub repository." },
              { step: "02", title: "Analyze Diff", desc: "Compare code changes against PRD and REQ-ID mapped criteria." },
              { step: "03", title: "Generate Evidence", desc: "Produce structured QA review and risk finding summary." },
              { step: "04", title: "Release Approval", desc: "Record human approval and publish shareable release report." }
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-[#3F3F3F]/40 bg-[#101312]/70 p-5"
              >
                <span className="text-xs font-mono font-bold text-[#51BFFF]">{item.step}</span>
                <h3 className="mt-2 text-sm font-semibold text-white">{item.title}</h3>
                <p className="mt-1.5 text-xs text-[#A7B0AA] leading-5">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Value Comparison Section */}
        <section className="mt-16 rounded-2xl border border-[#51BFFF]/30 bg-[linear-gradient(135deg,rgba(81,191,255,0.06),rgba(171,255,87,0.03))] p-8 text-center lg:p-12">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Not another seat-based code review tool.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#A7B0AA]">
            Most tools charge per developer seat. MergeMint is priced around release volume, so you pay for the PRs you actually verify and deliver.
          </p>
          <div className="mt-8 inline-block rounded-xl border border-[#ABFF57]/40 bg-[#101312] px-6 py-4 shadow-xl">
            <p className="text-base font-semibold tracking-wide text-[#ABFF57] sm:text-lg">
              GitHub shows what changed. MergeMint shows whether it is actually done.
            </p>
          </div>
        </section>

        {/* Included Features Section */}
        <section className="mt-20">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Everything included across all plans
            </h2>
            <p className="mt-3 text-sm text-[#A7B0AA]">
              Complete requirement-to-release proof pipeline out of the box.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {includedFeatures.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-3 rounded-lg border border-[#3F3F3F]/40 bg-[#171B19] p-4 text-sm text-white"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ABFF57]/15 text-xs font-bold text-[#ABFF57]">
                  ✓
                </span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-24 max-w-3xl mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-10 space-y-6">
            {faqs.map((faq) => (
              <div
                key={faq.question}
                className="rounded-xl border border-[#3F3F3F]/40 bg-[#171B19] p-6"
              >
                <h3 className="text-base font-semibold text-white">
                  {faq.question}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#A7B0AA]">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mt-24 text-center">
          <div className="rounded-2xl border border-[#3F3F3F]/60 bg-[#171B19] p-10 lg:p-14">
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Ready to verify your next release?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#A7B0AA]">
              Get complete release proof for your pull requests with AI requirement verification and shareable client reports.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link
                href="/login"
                className="rounded-lg bg-[#ABFF57] px-6 py-3 text-sm font-semibold text-[#101312] transition hover:bg-[#b8ff6d]"
              >
                Start verifying now
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#3F3F3F]/40 bg-[#101312] py-10 text-xs text-[#A7B0AA]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center rounded border border-[#ABFF57]/40 bg-[#ABFF57]/10 text-xs font-bold text-[#ABFF57]">
              MM
            </span>
            <span className="font-semibold text-white">MergeMint</span>
            <span>- Requirement-to-release proof platform.</span>
          </div>
          <div className="flex gap-6">
            <Link href="/" className="transition hover:text-white">
              Home
            </Link>
            <Link href="/pricing" className="transition hover:text-white">
              Pricing
            </Link>
            <Link href="/login" className="transition hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
