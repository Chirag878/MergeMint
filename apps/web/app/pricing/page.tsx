import Link from "next/link";
import { BILLING_PLANS, PAID_BILLING_PLAN_KEYS } from "@veriflow/shared";
import { ThemeToggle } from "../components/theme-provider";

const pricingPlans = PAID_BILLING_PLAN_KEYS.map((key) => BILLING_PLANS[key]);

const bestFor: Record<(typeof PAID_BILLING_PLAN_KEYS)[number], string> = {
  launch_pack: "Trying MergeMint on a real project",
  pilot: "Freelancers and solo builders",
  studio: "Agencies shipping client work",
  scale: "Product teams and AI studios",
  agency_max: "High-volume agencies"
};

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
      "No. MergeMint is priced around verified PR reviews, so agencies and teams pay based on release volume instead of team size."
  },
  {
    question: "What happens if I exceed my PR review credits?",
    answer:
      "Only AI QA Review is gated. You can keep exploring projects, repos, requirements, PRDs, tasks, and PR links, then upgrade or contact us for manual access."
  },
  {
    question: "Is the Launch Pack recurring?",
    answer:
      "No. Phase 1 uses Razorpay Standard Checkout for one-off 30-day credit packs. Recurring subscriptions are not enabled yet."
  },
  {
    question: "Do international customers have a fallback?",
    answer:
      "Yes. Razorpay international payments can require account activation, so early pilots can be onboarded manually by an admin."
  }
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] font-sans text-[var(--text)] transition-colors duration-200">
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
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]"
            >
              Sign in
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--mint)]/30 bg-[var(--mint)]/10 px-3 py-1 text-xs font-medium text-[var(--mint)]">
            Transparent Delivery Pricing
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
            Pricing built around verified PR reviews.
          </h1>
          <p className="mt-5 text-base leading-7 text-[var(--text-muted)] sm:text-lg">
            Pay for release proof, not another developer seat. MergeMint verifies pull requests against requirements, repo context, QA evidence, and approval state before you ship.
          </p>
          <p className="mt-3 text-xs font-semibold text-[var(--blue)]">
            Free workspaces include 1 PR review credit. Exploration is not gated.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4 xl:gap-6">
          {pricingPlans.map((plan) => {
            const isHighlight = Boolean(plan.recommended);

            return (
              <div
                key={plan.key}
                className={`mint-card relative flex flex-col justify-between p-6 ${
                  isHighlight
                    ? "border-2 border-[var(--mint)] bg-[var(--surface-elevated)] shadow-md"
                    : ""
                }`}
              >
                {plan.recommended ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--mint)] px-3 py-0.5 text-[10px] font-bold text-[#070A09] uppercase tracking-wider">
                    Recommended
                  </div>
                ) : null}

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-bold text-[var(--text)]">
                      {plan.displayName}
                    </h3>
                    {plan.offerNote ? (
                      <span className="rounded bg-[var(--warning)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
                        {plan.offerNote}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <span className="text-3xl font-extrabold tracking-tight text-[var(--text)]">
                      {plan.displayPrice}
                    </span>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Razorpay checkout: Rs. {plan.checkoutAmountInr.toLocaleString("en-IN")}
                    </p>
                  </div>

                  <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 text-xs">
                    <p className="font-bold text-[var(--mint)]">
                      {plan.credits} verified PR reviews
                    </p>
                    <p className="mt-0.5 text-[var(--text-muted)]">
                      Valid for {plan.validityDays} days
                    </p>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text)]">Best for:</span>{" "}
                    {bestFor[plan.key as keyof typeof bestFor]}
                  </p>
                </div>

                <div className="mt-8">
                  <Link
                    href={`/app/billing?checkoutPlan=${plan.key}`}
                    className={`block w-full rounded-md px-4 py-2 text-center text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isHighlight
                        ? "gradient-btn-mint-pink"
                        : "border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text)] hover:border-[var(--mint)]/40"
                    }`}
                  >
                    Continue in app
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-[var(--text-muted)]">
          By continuing, you agree to the{" "}
          <Link href="/terms" className="font-semibold text-[var(--text)] underline-offset-4 hover:underline">
            Terms & Conditions
          </Link>
          ,{" "}
          <Link href="/privacy" className="font-semibold text-[var(--text)] underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          , and{" "}
          <Link href="/refund-policy" className="font-semibold text-[var(--text)] underline-offset-4 hover:underline">
            Refund Policy
          </Link>
          .
        </p>

        <section className="mt-20 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-xs lg:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              What counts as a verified PR review?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              A verified PR review means MergeMint links a pull request, reviews the diff against the PRD, REQ-IDs, acceptance criteria, engineering tasks, and repository context, then produces QA evidence for approval.
            </p>
          </div>
        </section>

        <section className="mt-16">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              Everything else stays open
            </h2>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Credits are enforced only at AI QA Review / Verify PR.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {includedFeatures.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5 text-xs font-medium text-[var(--text)] shadow-xs"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--mint)]/15 text-[10px] font-bold text-[var(--mint)]">
                  OK
                </span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-3xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-8 space-y-4">
            {faqs.map((faq) => (
              <div key={faq.question} className="mint-card p-5 text-left">
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
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-8 text-xs text-[var(--text-muted)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 place-items-center rounded border border-[var(--mint)]/30 bg-[var(--mint)]/10 text-[10px] font-bold text-[var(--mint)]">
              MM
            </span>
            <span className="font-semibold text-[var(--text)]">MergeMint</span>
            <span>- Requirement-to-release proof platform.</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/pricing" className="transition hover:text-[var(--text)]">
              Pricing
            </Link>
            <Link href="/cli" className="transition hover:text-[var(--text)]">
              CLI
            </Link>
            <Link href="/terms" className="transition hover:text-[var(--text)]">
              Terms
            </Link>
            <Link href="/privacy" className="transition hover:text-[var(--text)]">
              Privacy
            </Link>
            <Link href="/refund-policy" className="transition hover:text-[var(--text)]">
              Refund Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
