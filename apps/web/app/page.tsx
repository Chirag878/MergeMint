import React from "react";
import Link from "next/link";
import { ThemeToggle } from "./components/theme-provider";
import { CinematicBackground } from "./components/cinematic-background";

function HeroProductMockup() {
  return (
    <div className="hero-mockup-card vf-fade-up relative mx-auto w-full max-w-5xl lg:max-w-6xl border border-white/15 bg-[#101614]/95 text-left shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] transition-all duration-300">
      {/* Top Application Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#151C19] px-4 py-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-amber-500/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
          <span className="ml-2 font-mono text-[11px] text-[#9CAAA4]">mergemint.app/app/features/feat_9821</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#65F2B0]/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#65F2B0]">
            RELEASE CONSOLE ACTIVE
          </span>
        </div>
      </div>

      {/* Main Dashboard Layout (Sidebar + Content) */}
      <div className="grid grid-cols-1 md:grid-cols-12">
        {/* Sidebar */}
        <aside className="hidden border-r border-white/10 bg-[#070A09]/60 p-4 md:col-span-3 md:block">
          <div className="flex items-center gap-2 font-bold text-xs text-[#F8FAF9]">
            <span className="grid h-6 w-6 place-items-center rounded border border-[#65F2B0]/40 bg-[#65F2B0]/10 text-[10px] font-bold text-[#65F2B0]">
              MM
            </span>
            <span>MergeMint</span>
          </div>

          <div className="mt-6 space-y-1 text-xs">
            <div className="rounded-md bg-[#151C19] px-3 py-1.5 font-semibold text-[#F8FAF9] border border-white/10">
              Dashboard
            </div>
            <div className="px-3 py-1.5 text-[#9CAAA4]">Projects</div>
            <div className="px-3 py-1.5 text-[#9CAAA4]">Features</div>
            <div className="px-3 py-1.5 text-[#9CAAA4]">Release Board</div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-4 text-[11px] text-[#9CAAA4]">
            <p className="font-semibold text-[#F8FAF9]">Active Repository</p>
            <p className="mt-0.5 font-mono text-[#65F2B0]">veriflow/core</p>
          </div>
        </aside>

        {/* Main Console Area */}
        <main className="p-5 md:col-span-9 lg:p-6">
          {/* Top Proof Trail Navigation */}
          <div className="mb-6 rounded-xl border border-white/10 bg-[#151C19] p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#9CAAA4]">
                RELEASE PROOF TRAIL
              </span>
              <span className="text-[10px] font-mono text-[#65F2B0]">7/7 STEPS VERIFIED</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs">
              {[
                { label: "Requirement Review", done: true },
                { label: "PRD", done: true },
                { label: "Tasks", done: true },
                { label: "PR Diff", done: true, highlight: true },
                { label: "QA Review", done: true },
                { label: "Approval", pending: true },
                { label: "Report", ready: true }
              ].map((step, idx, arr) => (
                <React.Fragment key={step.label}>
                  <span
                    className={`rounded px-2.5 py-1 font-semibold transition-all ${
                      step.highlight
                        ? "bg-[#51BFFF] text-[#070A09] font-bold shadow-xs"
                        : step.pending
                        ? "bg-[#FF7AAE]/15 text-[#FF7AAE] border border-[#FF7AAE]/30"
                        : "bg-[#65F2B0]/15 text-[#65F2B0] border border-[#65F2B0]/20"
                    }`}
                  >
                    {step.label}
                  </span>
                  {idx < arr.length - 1 ? (
                    <span className="text-[#9CAAA4] font-mono text-[10px]">→</span>
                  ) : null}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Grid Cards inside Mockup */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Release Readiness Card */}
            <div className="rounded-xl border border-[#65F2B0]/40 bg-[#151C19] p-4 shadow-md relative overflow-hidden">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[#65F2B0]/10 blur-xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#9CAAA4]">Release Readiness</span>
                <span className="rounded bg-[#65F2B0]/15 px-2 py-0.5 font-mono text-[9px] font-bold text-[#65F2B0]">HIGH TRUST</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#F8FAF9]">87%</span>
                <span className="text-xs text-[#65F2B0] font-semibold">Ready to ship</span>
              </div>
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#070A09]">
                <div className="h-1.5 rounded-full bg-gradient-to-r from-[#65F2B0] to-[#FF7AAE]" style={{ width: "87%" }} />
              </div>
            </div>

            {/* PR Coverage Matrix Card */}
            <div className="rounded-xl border border-white/10 bg-[#070A09]/70 p-4">
              <span className="text-xs font-semibold text-[#9CAAA4]">Coverage Matrix</span>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-[#F8FAF9]">REQ-001 Audit Logs</span>
                  <span className="font-mono font-bold text-[#65F2B0]">100% Pass</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-[#F8FAF9]">REQ-002 Webhooks</span>
                  <span className="font-mono font-bold text-[#65F2B0]">100% Pass</span>
                </div>
              </div>
            </div>

            {/* Verification Summary Card */}
            <div className="rounded-xl border border-white/10 bg-[#070A09]/70 p-4 sm:col-span-2 lg:col-span-1">
              <span className="text-xs font-semibold text-[#9CAAA4]">Verification Summary</span>
              <div className="mt-3 space-y-1.5 text-xs">
                <p className="text-[#F8FAF9] font-medium">Linked PR: #142 Audit Engine</p>
                <p className="text-[11px] text-[#9CAAA4]">12 engineering tasks verified against repo snapshot.</p>
              </div>
            </div>
          </div>

          {/* Recent PRs List inside Mockup */}
          <div className="mt-4 rounded-xl border border-white/10 bg-[#070A09]/70 p-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-xs font-semibold text-[#9CAAA4]">
              <span>Recent Verified PRs</span>
              <span>Status</span>
            </div>
            <div className="mt-2 divide-y divide-white/5 text-xs">
              {[
                { id: "#142", title: "Add client webhook retry engine", status: "Verified", badge: "bg-[#65F2B0]/15 text-[#65F2B0]" },
                { id: "#139", title: "Update OAuth token scopes", status: "Approved", badge: "bg-[#65F2B0]/15 text-[#65F2B0]" },
                { id: "#138", title: "Refactor PRD clarification gating", status: "In review", badge: "bg-[#51BFFF]/15 text-[#51BFFF]" },
                { id: "#135", title: "Fix billing snapshot calculations", status: "Issues", badge: "bg-[#FF7AAE]/15 text-[#FF7AAE]" }
              ].map((pr) => (
                <div key={pr.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[#9CAAA4]">{pr.id}</span>
                    <span className="font-medium text-[#F8FAF9]">{pr.title}</span>
                  </div>
                  <span className={`rounded px-2.5 py-0.5 text-[10px] font-semibold ${pr.badge}`}>
                    {pr.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[var(--bg)] font-sans text-[var(--text)] transition-colors duration-200">
      {/* Pure CSS/SVG Ambient Cinematic Background Layer */}
      <CinematicBackground />

      {/* 1. Navbar */}
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

          <nav className="hidden items-center gap-8 text-xs font-medium text-[var(--text-muted)] lg:flex">
            <a href="#product" className="transition hover:text-[var(--text)]">
              Product
            </a>
            <a href="#how-it-works" className="transition hover:text-[var(--text)]">
              How it works
            </a>
            <Link href="/pricing" className="transition hover:text-[var(--text)]">
              Pricing
            </Link>
            <a href="#proof-map" className="transition hover:text-[var(--text)]">
              Resources
            </a>
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

      {/* 2. Hero Section */}
      <section className="relative z-10 pt-14 pb-16 lg:pt-20 lg:pb-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--mint)]/30 bg-[var(--mint)]/10 px-3.5 py-1 text-xs font-medium text-[var(--mint)]">
              AI Product Delivery Pipeline
            </div>
            <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-[var(--text)] sm:text-6xl lg:text-7xl leading-[1.08]">
              Prove every PR{" "}
              <span className="gradient-text-mint-pink">is ready to ship.</span>
            </h1>
            <p className="mt-6 text-base leading-7 text-[var(--text-muted)] sm:text-lg max-w-2xl mx-auto">
              MergeMint helps teams verify whether a GitHub pull request actually satisfies the original feature request before release.
            </p>
            <p className="mt-3 text-xs font-semibold text-[var(--text-muted)] sm:text-sm">
              GitHub shows what changed. MergeMint shows whether it is actually done.
            </p>

            <div className="mt-8 flex justify-center gap-4">
              <Link
                href="/login"
                className="gradient-btn-mint-pink rounded-xl px-7 py-3.5 text-sm font-bold shadow-lg"
              >
                Start verifying
              </Link>
              <a
                href="#how-it-works"
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md px-7 py-3.5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-elevated)]"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Hero Product Mockup (visually dominating after headline & elevated higher) */}
          <div className="mt-10 lg:mt-12">
            <HeroProductMockup />
          </div>
        </div>
      </section>

      {/* 3. Trusted by / Trust Row */}
      <section className="relative z-10 py-10 border-t border-b border-[var(--border)] bg-[var(--surface-elevated)]/40 backdrop-blur-md text-center">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <p className="text-xs font-mono font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            Trusted by AI Studios, Engineering Agencies, and Product Teams
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 opacity-75 text-xs font-semibold text-[var(--text-muted)] sm:gap-12">
            <span>Vanguard AI Studio</span>
            <span>•</span>
            <span>StackCraft Labs</span>
            <span>•</span>
            <span>Hyperion Systems</span>
            <span>•</span>
            <span>Apex Delivery Co</span>
          </div>
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section id="how-it-works" className="relative z-10 py-20 border-b border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--blue)]/30 bg-[var(--blue)]/10 px-3 py-1 text-xs font-medium text-[var(--blue)]">
              5-Step Verification Process
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
              How MergeMint proves your releases
            </h2>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { step: "1", title: "Connect GitHub", desc: "Link repository through GitHub App." },
              { step: "2", title: "Analyze Repository", desc: "Index codebase architecture and context." },
              { step: "3", title: "Generate PRD & REQ-IDs", desc: "Extract structured criteria and tasks." },
              { step: "4", title: "Verify PR Diff", desc: "Compare code changes to requirements." },
              { step: "5", title: "Approve & Share Report", desc: "Publish audit-ready proof link." }
            ].map((s) => (
              <div key={s.step} className="mint-card p-5 text-left">
                <span className="grid h-7 w-7 place-items-center rounded-md border border-[var(--mint)]/30 bg-[var(--mint)]/10 text-xs font-mono font-bold text-[var(--mint)]">
                  {s.step}
                </span>
                <h3 className="mt-3 text-sm font-bold text-[var(--text)]">{s.title}</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)] leading-5">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Proof Trail / Proof Map Section */}
      <section id="proof-map" className="relative z-10 py-20 border-b border-[var(--border)] bg-[var(--surface-elevated)]/30">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 text-center">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
              A proof map for every release.
            </h2>
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              MergeMint connects requirements, tasks, PR files, QA findings, risks, approval, and reports into one visible release trail.
            </p>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-center gap-2.5 lg:gap-4">
            {[
              "Requirement Review",
              "PRD",
              "Engineering Tasks",
              "PR Diff",
              "QA Coverage",
              "Human Approval",
              "Release Report"
            ].map((node, idx, arr) => (
              <React.Fragment key={node}>
                <div className="rounded-xl border border-[var(--mint)]/40 bg-[var(--surface)] px-4 py-2.5 text-xs font-bold text-[var(--text)] shadow-xs">
                  {node}
                </div>
                {idx < arr.length - 1 ? (
                  <span className="text-sm text-[var(--pink)] font-mono font-bold">→</span>
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Release Checklist / Coverage Matrix */}
      <section className="relative z-10 py-20 border-b border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
              Coverage Matrix Telemetry
            </h2>
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              Inspect requirement verification status in real-time before human approval.
            </p>
          </div>

          <div className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-md lg:p-8">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 text-xs font-semibold text-[var(--text-muted)]">
              <span>Requirement Item (REQ-ID)</span>
              <span>PR Coverage Status</span>
            </div>
            <div className="mt-3 divide-y divide-[var(--border)]/50 text-xs">
              {[
                { req: "REQ-001: Client Audit Log Schema", status: "100% Covered", file: "src/audit/logger.ts" },
                { req: "REQ-002: Webhook Retry Policy", status: "100% Covered", file: "src/webhooks/retry.ts" },
                { req: "REQ-003: OAuth Token Scope Verification", status: "Verified", file: "src/auth/oauth.ts" }
              ].map((row) => (
                <div key={row.req} className="flex flex-wrap items-center justify-between gap-2 py-3.5">
                  <div>
                    <p className="font-bold text-[var(--text)]">{row.req}</p>
                    <p className="mt-0.5 text-[11px] font-mono text-[var(--text-muted)]">{row.file}</p>
                  </div>
                  <span className="rounded bg-[var(--mint-light)] px-2.5 py-1 font-mono text-[11px] font-bold text-[var(--mint)]">
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. Product Highlights Section */}
      <section id="product" className="relative z-10 py-20 border-b border-[var(--border)] bg-[var(--surface-elevated)]/30">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
              Engineered for requirement-to-release proof
            </h2>
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              Everything your team needs to verify code changes against original product intent.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Repository Intelligence",
                copy: "Deep repo analysis mapping code architecture to feature requests before PR review."
              },
              {
                title: "AI Requirement Review",
                copy: "Gated requirement checks ensuring feature briefs are crystal clear before PRD generation."
              },
              {
                title: "REQ-ID Mapped Tasks",
                copy: "Structured engineering tasks directly linked to specific acceptance criteria items."
              },
              {
                title: "Audit-Ready Reports",
                copy: "Shareable delivery links giving clients and stakeholders undeniable proof of completion."
              }
            ].map((card) => (
              <div key={card.title} className="mint-card p-6 text-left">
                <h3 className="text-base font-bold text-[var(--text)]">{card.title}</h3>
                <p className="mt-2 text-xs text-[var(--text-muted)] leading-5">{card.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Reports Section */}
      <section className="relative z-10 py-20 border-b border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--mint)]/30 bg-[var(--mint)]/10 px-3 py-1 text-xs font-medium text-[var(--mint)]">
                Shareable Release Proof
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
                Turn reviews into shareable release proof.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
                Generate client-ready or internal release reports that show what was requested, what changed, what passed, what is risky, and who approved.
              </p>
              <div className="mt-8 space-y-3 text-xs text-[var(--text)]">
                {[
                  "Immutable release share links for client sign-off",
                  "Traceable mapping between REQ-IDs and PR files",
                  "Automated risk & test failure summary",
                  "Human approval audit history"
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--mint-light)] text-[10px] font-bold text-[var(--mint)]">✓</span>
                    <span className="font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mint-card p-6 text-left border-2 border-[var(--pink)]/30">
              <div className="border-b border-[var(--border)] pb-4">
                <span className="text-[10px] font-mono font-bold text-[var(--pink)]">CLIENT RELEASE REPORT</span>
                <h3 className="mt-1 text-lg font-bold text-[var(--text)]">Feature: Client Audit Integration</h3>
              </div>
              <div className="mt-5 space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-[var(--border)]/40">
                  <span className="text-[var(--text-muted)]">Verification Status</span>
                  <span className="font-bold text-[var(--mint)]">PASSED (100% Covered)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--border)]/40">
                  <span className="text-[var(--text-muted)]">Pull Request</span>
                  <span className="font-mono text-[var(--text)]">#142 (Merged)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--border)]/40">
                  <span className="text-[var(--text-muted)]">Approved By</span>
                  <span className="text-[var(--text)] font-semibold">Lead Product Manager</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Pricing Preview Section */}
      <section className="relative z-10 py-20 border-b border-[var(--border)] bg-[var(--surface-elevated)]/40">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 text-center">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
              Transparent pricing for verified releases
            </h2>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Pay for release volume, not team seats.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {[
              { name: "Launch Pack", price: "₹199", detail: "3 verified PRs", note: "Valid until 30 June" },
              { name: "Studio", price: "$51/mo", detail: "90 verified PRs/month", note: "Recommended for agencies", highlight: true },
              { name: "Scale", price: "$99/mo", detail: "220 verified PRs/month", note: "Product teams & studios" }
            ].map((p) => (
              <div
                key={p.name}
                className={`mint-card p-6 text-left flex flex-col justify-between ${
                  p.highlight ? "border-2 border-[var(--mint)] bg-[var(--surface)] shadow-md" : ""
                }`}
              >
                <div>
                  <h3 className="text-lg font-bold text-[var(--text)]">{p.name}</h3>
                  <p className="mt-3 text-3xl font-extrabold text-[var(--text)]">{p.price}</p>
                  <p className="mt-2 text-xs font-bold text-[var(--mint)]">{p.detail}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">{p.note}</p>
                </div>
                <Link
                  href="/pricing"
                  className="mt-6 block w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] py-2 text-center text-xs font-semibold text-[var(--text)] transition hover:border-[var(--mint)]/40"
                >
                  View details
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--mint)] hover:underline"
            >
              <span>View full pricing & plan comparison</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 10. FAQ Section */}
      <section className="relative z-10 py-20 border-b border-[var(--border)]">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-12 space-y-4">
            {[
              {
                q: "Is MergeMint a code review tool?",
                a: "MergeMint reviews PRs, but its main job is to verify whether the PR satisfies the original requirement before release."
              },
              {
                q: "Do I need to paste PR links manually?",
                a: "No. MergeMint connects to GitHub and lets you select PRs directly from your connected repository. Manual paste is only an advanced fallback."
              },
              {
                q: "Who is this for?",
                a: "Agencies, AI studios, freelancers, founders, product teams, and engineering teams that need verifiable proof before shipping."
              },
              {
                q: "What is a verified PR?",
                a: "A PR reviewed against the PRD, REQ-IDs, acceptance criteria, engineering tasks, and repository context to produce release evidence."
              }
            ].map((faq) => (
              <div key={faq.q} className="mint-card p-6 text-left">
                <h3 className="text-base font-bold text-[var(--text)]">{faq.q}</h3>
                <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 11. Final CTA */}
      <section className="relative z-10 py-20 text-center">
        <div className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
          <div className="mint-card p-10 sm:p-16 border-2 border-[var(--mint)]/30">
            <h2 className="text-3xl font-extrabold tracking-tight text-[var(--text)] sm:text-4xl">
              Stop guessing if a PR is done.
            </h2>
            <p className="mt-4 text-xs text-[var(--text-muted)] max-w-xl mx-auto leading-5">
              Get full requirement coverage, QA evidence, and shareable client proof in minutes.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/login"
                className="gradient-btn-mint-pink rounded-xl px-8 py-3.5 text-sm font-bold shadow-lg"
              >
                Start verifying
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border)] bg-[var(--surface)] py-8 text-xs text-[var(--text-muted)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 place-items-center rounded border border-[var(--mint)]/30 bg-[var(--mint)]/10 text-[10px] font-bold text-[var(--mint)]">
              MM
            </span>
            <span className="font-semibold text-[var(--text)]">MergeMint</span>
            <span>- Requirement-to-release proof platform.</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/" className="transition hover:text-[var(--text)]">
              Home
            </Link>
            <Link href="/pricing" className="transition hover:text-[var(--text)]">
              Pricing
            </Link>
            <Link href="/terms" className="transition hover:text-[var(--text)]">
              Terms
            </Link>
            <Link href="/privacy" className="transition hover:text-[var(--text)]">
              Privacy
            </Link>
            <Link
              href="/refund-policy"
              className="transition hover:text-[var(--text)]"
            >
              Refund Policy
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
