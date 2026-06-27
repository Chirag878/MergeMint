import Link from "next/link";

const featureCards = [
  {
    title: "Client Requirement Vault",
    copy: "Keep the original request, business goal, behavior, and acceptance criteria attached to the client."
  },
  {
    title: "PR Verification Evidence",
    copy: "Connect each GitHub PR to REQ IDs, code changes, snapshots, and QA coverage."
  },
  {
    title: "Approval History",
    copy: "Record who approved, what risk remained, and when the release decision happened."
  },
  {
    title: "Report Archive",
    copy: "Build a searchable proof trail for every client feature and delivery milestone."
  },
  {
    title: "Risk Visibility",
    copy: "Surface missing requirements, unresolved findings, and approval caveats before release."
  },
  {
    title: "Delivery Ledger",
    copy: "Give clients a single view of shipped work, reports, QA status, and open risk."
  }
];

const problemPoints = [
  "Clients ask for proof that the requested work was actually delivered.",
  "Agencies struggle to show requested vs shipped across docs, PRs, chats, and calls.",
  "PR reviews catch code issues, but they do not prove requirement coverage.",
  "Approvals, risks, and client-ready evidence get scattered across tools."
];

const workflowSteps = [
  {
    title: "Capture client feature request",
    copy: "Start with the original client ask, business goal, behavior, and acceptance criteria."
  },
  {
    title: "Generate PRD and REQ IDs",
    copy: "Turn the request into traceable requirements your team can build and verify."
  },
  {
    title: "Link GitHub PR",
    copy: "Attach the implementation PR and preserve the latest code evidence snapshot."
  },
  {
    title: "Run AI QA against requirements",
    copy: "Compare the PR against each requirement and highlight coverage gaps or risk."
  },
  {
    title: "Approve and share release report",
    copy: "Record the human decision and send a client-ready proof link."
  }
];

const proofSteps = [
  {
    title: "Capture the request",
    copy: "Turn client or product requirements into clear acceptance criteria."
  },
  {
    title: "Verify the PR",
    copy: "Compare GitHub changes against the agreed scope before release."
  },
  {
    title: "Share the proof",
    copy: "Generate a clean report with coverage, risks, approvals, and evidence."
  }
];

const reportPoints = [
  "What was requested",
  "What changed in the PR",
  "Which requirements are covered or missing",
  "AI findings and risks",
  "Final approval decision",
  "Shareable client-ready link",
  "Print or save as PDF"
];

const personaCards = [
  {
    title: "For agencies",
    label: "Client delivery ledger",
    copy: "Track each client request through project work, PR evidence, approval history, risk notes, and release reports."
  },
  {
    title: "For product teams",
    label: "Release confidence layer",
    copy: "Verify internal feature PRs against original requirements before founders, CTOs, and PMs approve release."
  }
];

const faqs = [
  {
    question: "Is this a GitHub App?",
    answer:
      "MergeMint is built around GitHub PR evidence and can support GitHub-connected workflows. You can also run a manual pilot flow before deeper installation."
  },
  {
    question: "Does MergeMint merge PRs?",
    answer:
      "No. GitHub remains the source of truth for merging. MergeMint verifies, approves, and generates delivery proof."
  },
  {
    question: "Who is this for?",
    answer:
      "Agencies, freelancers, AI automation studios, and founders who need proof that outsourced development matched the original requirements."
  },
  {
    question: "What does the report include?",
    answer:
      "The feature request, PR evidence, requirement coverage, QA findings, approval decision, risks, and a shareable client-ready release summary."
  },
  {
    question: "Can I use it manually before installing GitHub App?",
    answer:
      "Yes. The founding pilot is designed to work with a guided manual setup so teams can validate the workflow before a deeper rollout."
  },
  {
    question: "Is this for agencies?",
    answer:
      "Yes. The product is especially useful for client-facing teams that need a clean delivery ledger and proof archive across multiple clients."
  }
];

export default function HomePage() {
  const sampleReportUrl = process.env.NEXT_PUBLIC_SAMPLE_REPORT_URL;
  const paymentLink = process.env.NEXT_PUBLIC_PAYMENT_LINK;
  const primaryCtaHref = paymentLink ?? "/login";
  const secondaryCtaHref = sampleReportUrl ?? "#how-it-works";

  return (
    <main className="min-h-screen overflow-hidden bg-[#060706] text-neutral-100">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.2),rgba(14,165,233,0.1),transparent_62%)] blur-3xl" />

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#060706]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-emerald-400/40 bg-emerald-400/10 text-sm font-semibold text-emerald-200">
              MM
            </span>
            <span className="text-base font-semibold tracking-normal">
              MergeMint
            </span>
          </Link>

          <div className="hidden items-center gap-6 text-sm text-neutral-300 lg:flex">
            <a href="#product" className="transition hover:text-white">
              Product
            </a>
            <a href="#how-it-works" className="transition hover:text-white">
              How it works
            </a>
            <Link href="/pricing" className="transition hover:text-white">
              Pricing
            </Link>
            {sampleReportUrl ? (
              <a
                href={sampleReportUrl}
                className="transition hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                Sample report
              </a>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-md px-3 py-2 text-sm text-neutral-300 transition hover:text-white sm:inline-flex"
            >
              Login
            </Link>
            <Link
              href={primaryCtaHref}
              className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 shadow-sm shadow-white/10 transition hover:-translate-y-0.5 hover:bg-white"
            >
              Start free pilot
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative mx-auto grid min-h-[680px] max-w-7xl items-center gap-12 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-24">
        <div className="vf-fade-up max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            REQUIREMENT-TO-RELEASE PROOF
          </p>
          <h1
            className="mt-6 max-w-4xl text-[2.75rem] font-semibold leading-[1.02] tracking-normal text-white sm:text-[3.5rem] lg:text-[4.5rem]"
            style={{ textWrap: "balance" }}
          >
            Prove every PR is ready to ship.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">
            MergeMint verifies each pull request against the original
            requirements, QA evidence, and approval history before your team
            ships or shares the release.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={primaryCtaHref}
              className="inline-flex justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-white/10 transition hover:-translate-y-0.5 hover:bg-neutral-100"
            >
              Start free pilot
            </Link>
            <a
              href={secondaryCtaHref}
              target={sampleReportUrl ? "_blank" : undefined}
              rel={sampleReportUrl ? "noreferrer" : undefined}
              className="inline-flex justify-center rounded-md border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10"
            >
              View sample report
            </a>
          </div>
          <p className="mt-6 max-w-xl text-sm leading-6 text-neutral-500">
            Built for agencies, founders, CTOs, PMs, and teams that need clear
            delivery evidence without slowing down GitHub.
          </p>
        </div>

        <HeroConsole />
      </section>

      <section className="relative border-y border-white/10 bg-white/[0.025] px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="How teams use it"
            title="From request to release proof."
            copy="A focused workflow for turning scope, code, QA, and approval into evidence your team can trust."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {proofSteps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-lg border border-white/10 bg-white/[0.035] p-6 transition hover:-translate-y-1 hover:border-emerald-300/30 hover:bg-white/[0.055]"
              >
                <span className="text-sm font-semibold text-emerald-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-neutral-400">
                  {step.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="product"
        className="relative border-y border-white/10 bg-white/[0.025] px-5 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Product preview"
            title="A proof system stakeholders can understand."
            copy="MergeMint turns the messy middle of delivery into a clean, inspectable trail from request to release."
          />
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {personaCards.map((card) => (
              <article
                key={card.title}
                className="vf-fade-up rounded-lg border border-white/10 bg-white/[0.035] p-6 transition hover:-translate-y-1 hover:border-emerald-300/30 hover:bg-white/[0.055]"
              >
                <p className="text-sm font-semibold text-emerald-200">
                  {card.title}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-white">
                  {card.label}
                </h3>
                <p className="mt-3 text-sm leading-6 text-neutral-400">
                  {card.copy}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <LedgerPreview />
            <ControlRoomPreview />
            <ReportPreview />
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeader
            eyebrow="The problem"
            title="Shipping code is not the same as proving delivery."
            copy="Client-facing teams need a durable record of what was requested, what changed, what was verified, and what risk was accepted."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {problemPoints.map((point) => (
              <div
                key={point}
                className="vf-fade-up rounded-md border border-white/10 bg-white/[0.035] p-5 text-sm leading-6 text-neutral-300 transition hover:-translate-y-1 hover:border-amber-300/30 hover:bg-white/[0.055]"
              >
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-y border-white/10 bg-neutral-950/70 px-5 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="How it works"
            title="Five steps from request to client-ready proof."
            copy="A lightweight delivery trail that fits around your existing GitHub workflow."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-5">
            {workflowSteps.map((step, index) => (
              <article
                key={step.title}
                className="vf-fade-up rounded-md border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-1 hover:border-emerald-300/30 hover:bg-white/[0.055]"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <span className="text-sm font-semibold text-emerald-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-base font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-neutral-400">
                  {step.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Built for client-facing teams"
            title="Everything delivery teams need to show their work."
            copy="A shared ledger for teams that need delivery confidence without adding another heavyweight project management system."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="vf-fade-up rounded-md border border-white/10 bg-white/[0.035] p-6 transition hover:-translate-y-1 hover:border-sky-300/30 hover:bg-white/[0.055]"
              >
                <h3 className="text-base font-semibold text-white">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-neutral-400">
                  {card.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] px-5 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <SectionHeader
            eyebrow="Public release report"
            title="A client-ready proof link for every release."
            copy="Give stakeholders a clean artifact they can inspect, save, print, or archive with the final approval decision."
          />
          <div className="rounded-lg border border-white/10 bg-[#0b0f0d] p-5 shadow-2xl shadow-black/40">
            <div className="rounded-md border border-emerald-300/20 bg-emerald-300/5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-neutral-500">Release Report</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    Client portal checkout flow
                  </h3>
                </div>
                <StatusChip tone="green">Approved</StatusChip>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {reportPoints.map((point) => (
                  <div
                    key={point}
                    className="rounded-md border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-300"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="px-5 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-lg border border-amber-300/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(16,185,129,0.1),rgba(255,255,255,0.03))] p-6 shadow-2xl shadow-black/30 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-center">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-200">
                Founding pilot
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
                Founding Pilot ₹2,999
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">
                A guided way to prove MergeMint on a real client or product
                delivery before rolling it across the team.
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 p-5">
              <ul className="space-y-3 text-sm text-neutral-300">
                <li>5 PR verifications</li>
                <li>AI requirement coverage review</li>
                <li>Human approval workflow</li>
                <li>Shareable release reports</li>
                <li>Founder-assisted onboarding</li>
              </ul>
              <Link
                href={primaryCtaHref}
                className="mt-6 inline-flex w-full justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:-translate-y-0.5 hover:bg-neutral-100"
              >
                Start founding pilot
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-5 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="FAQ"
            title="Clear answers before your first pilot."
            copy="MergeMint is designed to sit beside your existing delivery flow, not replace the tools your team already trusts."
          />
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {faqs.map((faq) => (
              <article
                key={faq.question}
                className="rounded-md border border-white/10 bg-white/[0.035] p-6"
              >
                <h3 className="text-base font-semibold text-white">
                  {faq.question}
                </h3>
                <p className="mt-3 text-sm leading-6 text-neutral-400">
                  {faq.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>MergeMint verifies delivery proof before release.</p>
          <div className="flex gap-4">
            <Link href="/login" className="transition hover:text-white">
              Login
            </Link>
            <Link href="/pricing" className="transition hover:text-white">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function SectionHeader({
  eyebrow,
  title,
  copy
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="vf-fade-up max-w-3xl">
      <p className="text-sm font-medium uppercase tracking-[0.24em] text-emerald-300">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-sm leading-7 text-neutral-400">{copy}</p>
    </div>
  );
}

function HeroConsole() {
  return (
    <div className="vf-fade-up relative lg:pl-4">
      <div className="vf-preview-scan rounded-xl border border-white/10 bg-[#0b0f0d] p-3 shadow-2xl shadow-black/50">
        <div className="rounded-lg border border-white/10 bg-black/35 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                PR Verification
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-normal text-white">
                Payment retry PR
              </h2>
            </div>
            <StatusChip tone="green">Ready</StatusChip>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Metric label="Requirements covered" value="8/9" />
            <Metric label="QA confidence" value="92%" />
          </div>

          <div className="mt-5 space-y-3 rounded-lg border border-white/10 bg-white/[0.025] p-3">
            {[
              ["REQ-001", "Retry failed card charge", "covered"],
              ["REQ-004", "Expose final failure state", "minor risk"],
              ["REQ-008", "Notify account owner", "covered"]
            ].map(([key, text, status]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/25 p-3"
              >
                <div>
                  <p className="text-xs font-medium text-sky-300">{key}</p>
                  <p className="mt-1 text-sm text-neutral-300">{text}</p>
                </div>
                <StatusChip tone={status === "covered" ? "green" : "amber"}>
                  {status}
                </StatusChip>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-amber-300/20 bg-amber-300/5 p-4">
              <p className="text-xs text-neutral-500">Approval</p>
              <p className="mt-2 text-sm font-medium text-amber-100">
                Ready with minor risk
              </p>
            </div>
            <div className="rounded-md border border-emerald-300/20 bg-emerald-300/5 p-4">
              <p className="text-xs text-neutral-500">Report</p>
              <p className="mt-2 text-sm font-medium text-emerald-100">
                Ready to share
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-md border border-emerald-300/20 bg-emerald-300/5 p-4">
            <p className="text-sm font-medium text-emerald-200">
              Release report ready
            </p>
            <p className="mt-2 text-xs leading-5 text-neutral-400">
              Coverage, QA evidence, approval status, and PR details are linked
              in one shareable proof artifact.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerPreview() {
  return (
    <PreviewFrame title="Client Delivery Ledger">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Northstar Labs</p>
            <p className="mt-1 text-xs text-neutral-500">4 active features</p>
          </div>
          <StatusChip tone="green">2 reports</StatusChip>
        </div>
        {[
          ["Checkout audit", "Approved", "Report archived"],
          ["Refund workflow", "QA reviewed", "1 open risk"],
          ["Client portal", "PR linked", "Next: Run QA"]
        ].map(([title, status, note]) => (
          <div
            key={title}
            className="rounded-md border border-white/10 bg-black/25 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-neutral-200">{title}</p>
              <span className="text-xs text-neutral-500">{status}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">{note}</p>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

function ControlRoomPreview() {
  return (
    <PreviewFrame title="Release Control Room">
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="REQs" value="12" />
          <Metric label="Covered" value="10" />
          <Metric label="Risk" value="2" />
        </div>
        <div className="rounded-md border border-amber-300/20 bg-amber-300/5 p-3">
          <p className="text-sm font-medium text-amber-100">Release Focus</p>
          <p className="mt-2 text-xs text-neutral-400">
            Review missing export permission requirement before approval.
          </p>
        </div>
        <div className="h-2 rounded-full bg-white/10">
          <div className="h-2 w-4/5 rounded-full bg-emerald-300" />
        </div>
      </div>
    </PreviewFrame>
  );
}

function ReportPreview() {
  return (
    <PreviewFrame title="Public Release Report">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <StatusChip tone="green">Approved</StatusChip>
          <span className="text-xs text-neutral-500">Share link ready</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Files" value="18" />
          <Metric label="Score" value="91" />
        </div>
        <div className="rounded-md border border-white/10 bg-black/25 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            Client summary
          </p>
          <p className="mt-2 text-sm leading-5 text-neutral-300">
            Requested behavior is covered. One low-risk validation gap accepted
            by the project owner.
          </p>
        </div>
      </div>
    </PreviewFrame>
  );
}

function PreviewFrame({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="vf-fade-up vf-preview-scan rounded-lg border border-white/10 bg-[#0b0f0d] p-3 shadow-2xl shadow-black/30 transition hover:-translate-y-1 hover:border-emerald-300/25">
      <div className="rounded-md border border-white/10 bg-black/35 p-4">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <div className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-300/70" />
            <span className="h-2 w-2 rounded-full bg-amber-300/70" />
            <span className="h-2 w-2 rounded-full bg-emerald-300/70" />
          </div>
        </div>
        {children}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function StatusChip({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: "green" | "amber";
}) {
  const classes =
    tone === "green"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
      : "border-amber-300/30 bg-amber-300/10 text-amber-100";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${classes}`}>
      {children}
    </span>
  );
}
