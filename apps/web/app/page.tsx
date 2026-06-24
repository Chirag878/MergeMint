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

const reportPoints = [
  "What was requested",
  "What changed in the PR",
  "Which requirements are covered or missing",
  "AI findings and risks",
  "Final approval decision",
  "Shareable client-ready link",
  "Print or save as PDF"
];

const faqs = [
  {
    question: "Is this a GitHub App?",
    answer:
      "Veriflow is built around GitHub PR evidence and can support GitHub-connected workflows. You can also run a manual pilot flow before deeper installation."
  },
  {
    question: "Does Veriflow merge PRs?",
    answer:
      "No. GitHub remains the source of truth for merging. Veriflow verifies, approves, and generates delivery proof."
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
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-[linear-gradient(90deg,rgba(16,185,129,0.18),rgba(14,165,233,0.14),rgba(245,158,11,0.1))] blur-3xl" />

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#060706]/78 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-emerald-400/40 bg-emerald-400/10 text-sm font-semibold text-emerald-200">
              VF
            </span>
            <span className="text-base font-semibold tracking-tight">
              Veriflow
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
              className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
            >
              Start pilot
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-20">
        <div className="vf-fade-up">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-emerald-300">
            Client delivery proof for modern software teams
          </p>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Verify every PR before release.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">
            Veriflow gives agencies a client delivery ledger for every feature:
            requirements, GitHub PR evidence, AI QA review, human approval, and
            shareable release reports.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={primaryCtaHref}
              className="inline-flex justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:-translate-y-0.5 hover:bg-neutral-100"
            >
              Start founding pilot
            </Link>
            <a
              href={secondaryCtaHref}
              target={sampleReportUrl ? "_blank" : undefined}
              rel={sampleReportUrl ? "noreferrer" : undefined}
              className="inline-flex justify-center rounded-md border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10"
            >
              {sampleReportUrl ? "View sample report" : "See how it works"}
            </a>
          </div>
          <p className="mt-6 max-w-xl text-sm leading-6 text-neutral-500">
            Built for agencies, freelancers, AI studios, and founders working
            with outsourced developers.
          </p>
        </div>

        <HeroConsole />
      </section>

      <section
        id="product"
        className="relative border-y border-white/10 bg-white/[0.025] px-5 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Product preview"
            title="A proof system your client can understand."
            copy="Veriflow turns the messy middle of delivery into a clean, inspectable trail from request to release."
          />
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
            title="Everything agencies need to show their work."
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
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Founding Pilot ₹2,999
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">
                A guided way to prove Veriflow on a real client delivery before
                rolling it across the team.
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
            copy="Veriflow is designed to sit beside your existing delivery flow, not replace the tools your team already trusts."
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
          <p>Veriflow verifies delivery proof before release.</p>
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
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-sm leading-7 text-neutral-400">{copy}</p>
    </div>
  );
}

function HeroConsole() {
  return (
    <div className="vf-fade-up relative lg:pl-4">
      <div className="vf-preview-scan rounded-lg border border-white/10 bg-[#0b0f0d] p-3 shadow-2xl shadow-black/50">
        <div className="rounded-md border border-white/10 bg-black/35 p-4">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
                Release Control Room
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Invoice automation approval
              </h2>
            </div>
            <StatusChip tone="amber">Review risks</StatusChip>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Coverage" value="9/10" />
            <Metric label="Readiness" value="86" />
            <Metric label="Findings" value="2" />
          </div>

          <div className="mt-5 space-y-3">
            {[
              ["REQ-001", "Webhook event captured", "covered"],
              ["REQ-004", "Duplicate invoice guard", "partial"],
              ["REQ-008", "Client approval email", "covered"]
            ].map(([key, text, status]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.035] p-3"
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

          <div className="mt-5 rounded-md border border-emerald-300/20 bg-emerald-300/5 p-4">
            <p className="text-sm font-medium text-emerald-200">
              Next: Generate release report
            </p>
            <p className="mt-2 text-xs leading-5 text-neutral-400">
              Human approval recorded with one accepted risk. Shareable proof is
              ready for the client.
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
          <p className="text-sm font-medium text-amber-100">Next Best Action</p>
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
