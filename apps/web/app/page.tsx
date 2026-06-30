"use client";

import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { CinematicBackground } from "./components/cinematic-background";
import { BILLING_PLANS, PAID_BILLING_PLAN_KEYS } from "@veriflow/shared";

const pricingPlans = PAID_BILLING_PLAN_KEYS.map((key) => BILLING_PLANS[key]);

const bestFor: Record<string, string> = {
  launch_pack: "Trying MergeMint on a real project",
  pilot: "Freelancers and solo builders",
  studio: "Agencies shipping client work",
  scale: "Product teams and AI studios",
  agency_max: "High-volume agencies"
};

const planBenefits: Record<string, string[]> = {
  launch_pack: [
    "3 verified PR reviews included",
    "Full repository context indexing",
    "Requirements coverage telemetry",
    "Shareable release reports"
  ],
  pilot: [
    "15 verified PR reviews / month",
    "Interactive Evidence Cockpit",
    "Automated PRD & Task breakdown",
    "Basic client delivery reports"
  ],
  studio: [
    "90 verified PR reviews / month",
    "Gated QA review automation",
    "Developer Fix Pack guidance",
    "Boardroom-safe PDF/web reports",
    "Priority support SLA"
  ],
  scale: [
    "220 verified PR reviews / month",
    "Advanced repository intelligence",
    "Custom verification rules",
    "Team workspace management",
    "Dedicated Slack integration"
  ],
  agency_max: [
    "500 verified PR reviews / month",
    "Custom API access & webhooks",
    "White-labeled release reports",
    "Dedicated solutions engineer",
    "Custom contract options"
  ]
};

function useScrollProgress(ref: React.RefObject<HTMLDivElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      const start = rect.top - windowHeight;
      const end = rect.bottom - 100;
      const total = end - start;
      const current = window.scrollY - (ref.current.offsetTop - windowHeight);

      const scrollPercent = Math.min(Math.max(current / total, 0), 1);
      setProgress(scrollPercent);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [ref]);

  return progress;
}

function ProofChainTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollProgress = useScrollProgress(containerRef);

  const steps = [
    { title: "Feature Request", desc: "Capture what the founder or client actually asked for.", badge: "Intake", code: "REQ-001 Intake" },
    { title: "Requirement Review", desc: "Clarify missing requirements before planning starts.", badge: "Clarified", code: "12 Requirements Verified" },
    { title: "PRD", desc: "Turn the request into acceptance criteria.", badge: "Spec generated", code: "PRD-2026.1" },
    { title: "Engineering Tasks", desc: "Break the PRD into developer-ready tasks.", badge: "Ready for dev", code: "8 Tasks Created" },
    { title: "GitHub PR", desc: "Link the actual implementation.", badge: "PR connected", code: "PR #142 Linked" },
    { title: "AI QA Review", desc: "Check the PR against requirements, PRD, and tasks.", badge: "Reviewed", code: "0 Blockers Found" },
    { title: "Developer Fix Pack", desc: "Generate actionable fixes for missing work.", badge: "Fix guidance", code: "2 Suggestions" },
    { title: "Human Approval", desc: "Approve, reject, or request changes with context.", badge: "Decision logged", code: "Sign-off Received" },
    { title: "Client Release Report", desc: "Create safe delivery evidence for clients.", badge: "Shareable", code: "REP-492 Generated" },
    { title: "GitHub Proof", desc: "Publish MergeMint Verification inside the PR.", badge: "Proof posted", code: "Comment Immutable" }
  ];

  return (
    <div ref={containerRef} className="relative w-full border border-[#6B6278] rounded-2xl bg-[#141524] p-6 md:p-12 overflow-hidden shadow-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(rgba(107,98,120,0.1)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
      <div className="hidden md:block absolute inset-0 pointer-events-none z-0">
        <svg className="w-full h-full" viewBox="0 0 800 1200" fill="none" preserveAspectRatio="none">
          <path d="M 400 50 L 400 100 Q 400 150 550 150 L 600 150 Q 720 150 720 250 L 720 300 Q 720 400 550 400 L 400 400 L 250 400 Q 80 400 80 500 L 80 550 Q 80 650 250 650 L 400 650 L 550 650 Q 720 650 720 750 L 720 800 Q 720 900 550 900 L 400 900 L 250 900 Q 80 900 80 1000 L 80 1050 Q 80 1150 250 1150 L 400 1150 L 400 1200" stroke="#6B6278" strokeWidth="2" />
          <path d="M 400 50 L 400 100 Q 400 150 550 150 L 600 150 Q 720 150 720 250 L 720 300 Q 720 400 550 400 L 400 400 L 250 400 Q 80 400 80 500 L 80 550 Q 80 650 250 650 L 400 650 L 550 650 Q 720 650 720 750 L 720 800 Q 720 900 550 900 L 400 900 L 250 900 Q 80 900 80 1000 L 80 1050 Q 80 1150 250 1150 L 400 1150 L 400 1200" stroke="url(#aurora-timeline-glow)" strokeWidth="3" strokeDasharray="2000" strokeDashoffset={2000 - scrollProgress * 2000} strokeLinecap="round" />
          <defs>
            <linearGradient id="aurora-timeline-glow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#C0C4FF" />
              <stop offset="100%" stopColor="#69FFB7" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="relative z-10 flex flex-col md:grid md:grid-cols-2 gap-y-12 md:gap-y-16">
        {steps.map((step, idx) => {
          const isLeft = idx % 2 === 0;
          const nodeThreshold = (idx + 1) / steps.length;
          const isCompleted = scrollProgress >= nodeThreshold;
          const isActive = scrollProgress > idx / steps.length && !isCompleted;
          return (
            <div key={step.title} className={`flex flex-col w-full ${isLeft ? "md:col-start-1 md:pr-12 items-start md:items-end" : "md:col-start-2 md:pl-12 items-start"}`}>
              <div className="w-full max-w-sm border border-[#6B6278] bg-[#171829]/90 backdrop-blur-sm rounded-xl p-5 hover:border-[#C0C4FF] transition-all duration-300 shadow-lg relative group">
                <div className={`absolute -inset-px rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${isActive ? "bg-gradient-to-r from-[#C0C4FF]/10 to-transparent blur-md" : "bg-gradient-to-r from-[#69FFB7]/10 to-transparent blur-md"}`} />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono tracking-wider text-[#A0A0A0] uppercase">Step {idx + 1}</span>
                    <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-wide ${isCompleted ? "bg-[#69FFB7]/15 text-[#69FFB7] border border-[#69FFB7]/25" : isActive ? "bg-[#C0C4FF]/15 text-[#C0C4FF] border border-[#C0C4FF]/25" : "bg-white/5 text-[#A0A0A0] border border-white/5"}`}>{step.badge}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                  <p className="mt-1.5 text-xs text-[#A0A0A0] leading-relaxed">{step.desc}</p>
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-[#A0A0A0]">
                    <span>Evidence Hash</span>
                    <span className="text-white">{step.code}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Navbar() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const isScrolled = scrollY > 20;
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "bg-[#1B1C2F]/90 backdrop-blur-lg border-b border-[#6B6278] py-3" : "bg-transparent py-6"}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded border border-[#6B6278] bg-[#141524] text-[10px] font-bold text-white">MM</span>
          <span className="text-sm font-semibold tracking-tight text-white">MergeMint</span>
        </Link>
        <nav className="hidden items-center gap-8 text-xs font-medium text-[#A0A0A0] md:flex">
          <a href="#problem" className="transition hover:text-white">The Problem</a>
          <a href="#proof-chain" className="transition hover:text-white">Proof Chain</a>
          <a href="#capabilities" className="transition hover:text-white">Capabilities</a>
          <a href="#pricing" className="transition hover:text-white">Pricing</a>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-xs font-medium text-[#A0A0A0] hover:text-white transition">Sign in</Link>
          <Link href="/login" className={`rounded bg-[#C0C4FF] text-[#1B1C2F] font-bold transition-all hover:bg-opacity-90 ${isScrolled ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm shadow-md'}`}>Start verifying</Link>
        </div>
      </div>
    </header>
  );
}

function CockpitPreview() {
  return (
    <div className="relative border border-[#6B6278] rounded-xl bg-[#141524] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden text-left font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(192,196,255,0.03),transparent_60%)] pointer-events-none" />
      <div className="flex items-center justify-between border-b border-[#6B6278] bg-[#171829] px-4 py-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-white/10" />
          <span className="font-mono text-[10px] text-[#A0A0A0]">veriflow-cockpit.mergemint.app</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#69FFB7] animate-pulse" />
          <span className="text-[10px] font-mono text-[#69FFB7] uppercase font-semibold">Live System Connected</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 min-h-[380px]">
        <div className="hidden md:block border-r border-[#6B6278] p-4 space-y-6 text-xs bg-[#141524]/50">
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-mono tracking-wider text-[#A0A0A0] pl-2">Navigation</span>
            <div className="rounded bg-[#171829] px-3 py-2 font-semibold text-white border border-white/5">Evidence Cockpit</div>
            <div className="px-3 py-2 text-[#A0A0A0] hover:text-white transition">Release Reports</div>
            <div className="px-3 py-2 text-[#A0A0A0] hover:text-white transition">Telemetry Logs</div>
          </div>
          <div className="space-y-2 pl-2">
            <span className="text-[9px] uppercase font-mono tracking-wider text-[#A0A0A0]">Repository</span>
            <p className="font-mono text-[10px] text-[#C0C4FF]">veriflow/core-api</p>
          </div>
        </div>
        <div className="col-span-3 p-6 space-y-6 flex flex-col justify-between">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <span className="text-[9px] uppercase font-mono tracking-wider text-[#A0A0A0]">Current Phase</span>
              <h2 className="text-xl font-bold text-white mt-1">Implement Client Audit Integration</h2>
              <p className="text-xs text-[#A0A0A0] mt-1">PR #142 • Linked from REQ-001</p>
            </div>
            <div className="rounded-md border border-[#69FFB7]/30 bg-[#69FFB7]/10 px-3 py-1.5 text-xs font-bold text-[#69FFB7] font-mono">VERIFIED: 100% COVERAGE</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 border border-white/5 rounded-lg bg-[#141524]/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-mono text-[#A0A0A0]">AI QA Review</span>
                <span className="text-[10px] text-[#69FFB7] font-semibold font-mono">PASSED</span>
              </div>
              <p className="text-xs text-[#A0A0A0] leading-relaxed">Verified 12 acceptance criteria checkpoints successfully.</p>
            </div>
            <div className="p-4 border border-white/5 rounded-lg bg-[#141524]/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-mono text-[#A0A0A0]">GitHub Proof Gate</span>
                <span className="text-[10px] text-[#C0C4FF] font-semibold font-mono">READY</span>
              </div>
              <p className="text-xs text-[#A0A0A0] leading-relaxed">Proof artifact compiled. Ready to post immutable verification to PR.</p>
            </div>
          </div>
          <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-[#A0A0A0]">
            <span className="font-mono">Last Telemetry Sweep: 2m ago</span>
            <Link href="/login" className="text-[#C0C4FF] hover:underline font-semibold">Launch Interactive Cockpit &rarr;</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#1B1C2F] font-sans text-white overflow-x-hidden selection:bg-[#C0C4FF] selection:text-[#1B1C2F]">
      <CinematicBackground />
      <Navbar />
      <main className="relative z-10 pt-28">
        <section className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8 text-center pt-16 pb-20 space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#C0C4FF]/20 bg-[#C0C4FF]/5 px-4 py-1 text-xs font-medium text-[#C0C4FF] font-mono">Evidence Control Room &bull; AI Product Delivery Pipeline</div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1] max-w-[1000px] mx-auto">
            MergeMint proves whether a GitHub PR actually delivered the <br className="hidden lg:inline" />
            <span className="bg-gradient-to-r from-[#C0C4FF] to-[#69FFB7] bg-clip-text text-transparent">original feature request.</span>
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-sm sm:text-base text-[#A0A0A0] leading-relaxed">Turn feature requests into PRDs, engineering tasks, AI QA reviews, approval evidence, client reports, and GitHub-native proof. Build high-trust delivery chains.</p>
          <div className="flex justify-center items-center gap-4">
            <Link href="/login" className="rounded bg-[#C0C4FF] text-[#1B1C2F] px-6 py-3 text-sm font-bold shadow-lg hover:bg-opacity-95 transition">Start verifying PRs</Link>
            <a href="#proof-chain" className="rounded border border-[#6B6278] bg-[#141524] px-6 py-3 text-sm font-medium hover:bg-white/5 transition">View sample proof</a>
          </div>
          <div className="pt-12"><CockpitPreview /></div>
        </section>
        <section id="problem" className="py-24 border-t border-[#6B6278] bg-[#141524]/30">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <span className="text-xs font-mono uppercase tracking-wider text-[#C0C4FF]">The Delivery Gap</span>
                <h2 className="text-3xl font-bold text-white tracking-tight leading-tight">GitHub shows what changed. <br />MergeMint shows whether it is <span className="text-[#69FFB7]">actually done.</span></h2>
                <p className="text-sm text-[#A0A0A0] leading-relaxed">Code changes aren't feature completions. AI coding tools like Cursor, GitHub Copilot, and CodeRabbit generate code and review syntax, but they don't prove whether the acceptance criteria requested by founders or clients have been fully implemented.</p>
                <p className="text-sm text-[#A0A0A0] leading-relaxed">MergeMint spans the entire workflow to connect business intent directly with repository state.</p>
              </div>
              <div className="border border-[#6B6278] rounded-xl bg-[#141524] p-6 space-y-4 font-mono text-xs shadow-inner">
                <div className="pb-3 border-b border-white/5 text-[#A0A0A0]">// Common Release Problems</div>
                <div className="space-y-3">
                  <div className="p-3 bg-[#171829] rounded border border-white/5">
                    <p className="font-semibold text-white">Issue 1: Code vs. Specs</p>
                    <p className="mt-1 text-[#A0A0A0] text-[11px]">Git shows diffs. It doesn't tell you if feature specs are missing.</p>
                  </div>
                  <div className="p-3 bg-[#171829] rounded border border-white/5">
                    <p className="font-semibold text-white">Issue 2: Verification Gaps</p>
                    <p className="mt-1 text-[#A0A0A0] text-[11px]">Agencies struggle to prove delivery to clients, causing manual verification cycles.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="proof-chain" className="py-24">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-16 space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[#C0C4FF]">The Signature Motif</span>
              <h2 className="text-3xl font-bold text-white">The Proof Chain Timeline</h2>
              <p className="text-sm text-[#A0A0A0] max-w-md mx-auto">Scroll to watch the chain of evidence align from feature request to final GitHub Proof.</p>
            </div>
            <ProofChainTimeline />
          </div>
        </section>
        <section id="capabilities" className="py-24 border-t border-[#6B6278] bg-[#141524]/30">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-16 space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[#C0C4FF]">Product Capabilities</span>
              <h2 className="text-3xl font-bold text-white">Operational Telemetry Features</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: "Requirement Review", desc: "Gated AI sweeps clarify scope discrepancies, preventing coding before plans align." },
                { title: "PRD Generation", desc: "Draft feature constraints immediately into structured, telemetry-ready acceptance matrices." },
                { title: "Engineering Tasks", desc: "Auto-generate discrete developer-focused task lists to align implementation path." },
                { title: "AI QA Review", desc: "Code-level logic sweeps verifying that every REQ-ID was actually satisfied in the diff." },
                { title: "Requirement Coverage Map", desc: "See which requirements are covered, partial, missing, or awaiting approval before a PR is shipped." },
                { title: "Developer Fix Pack", desc: "Turn QA findings into copyable implementation guidance for Cursor, Codex, Claude Code, or your developer." },
                { title: "Human Approval Gate", desc: "One-click approval control room designed to capture the final human sign-off evidence." },
                { title: "Client Delivery Report", desc: "Boardroom-safe, print-friendly reports demonstrating exact specs mapped to release proofs." },
                { title: "GitHub Proof Gate", desc: "Immutable proof stamps automatically commented into the GitHub PR upon verification." },
                { title: "Verification Rules", desc: "Custom gating criteria defining release-readiness thresholds for automated checks." }
              ].map((c) => (
                <div key={c.title} className="p-6 border border-[#6B6278] rounded-xl bg-[#141524] hover:border-[#C0C4FF] transition duration-300">
                  <h3 className="font-bold text-sm text-white">{c.title}</h3>
                  <p className="mt-2 text-xs text-[#A0A0A0] leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="py-24 border-t border-[#6B6278]">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8 text-center space-y-12">
            <div className="space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[#C0C4FF]">Audience</span>
              <h2 className="text-3xl font-bold text-white">Who Ships with MergeMint</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {["Startup Founders", "CTOs", "Product Managers", "Engineering Managers", "Agencies", "Freelancers", "AI Coding Teams", "Client Delivery Teams"].map((aud) => (
                <div key={aud} className="p-4 border border-[#6B6278] rounded-lg bg-[#141524] text-xs font-semibold">{aud}</div>
              ))}
            </div>
          </div>
        </section>
        <section id="pricing" className="py-24 border-t border-[#6B6278] bg-[#141524]/30">
          <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8 text-center space-y-16">
            <div className="space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[#C0C4FF]">Pricing</span>
              <h2 className="text-3xl font-bold text-white">Calibrated Plan Structure</h2>
              <p className="text-sm text-[#A0A0A0]">Pay for release verification volume, not team headcount.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5 items-stretch">
              {pricingPlans.map((plan) => {
                const isHighlight = plan.key === "studio";
                return (
                  <div key={plan.key} className={`border rounded-xl p-5 flex flex-col justify-between text-left relative ${isHighlight ? "border-[#C0C4FF] bg-[#171829] shadow-lg" : "border-[#6B6278] bg-[#141524]"}`}>
                    {isHighlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-[#C0C4FF] text-[#1B1C2F] px-2.5 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider">Recommended</span>}
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-bold text-xs text-white uppercase tracking-wider">{plan.displayName}</h3>
                        <p className="mt-2 text-2xl font-extrabold text-white">{plan.displayPrice}</p>
                      </div>
                      <div className="p-3 rounded border border-white/5 bg-[#1B1C2F] space-y-1.5 text-[11px] font-mono">
                        <p className="font-bold text-[#69FFB7]">{plan.credits} verified PRs</p>
                        <p className="text-[#A0A0A0]">{plan.validityDays} Days Validity</p>
                      </div>
                      <p className="text-[11px] text-[#A0A0A0] leading-relaxed">{bestFor[plan.key] || "Continuous verification"}</p>
                      <ul className="space-y-1.5 pt-2 text-[10px] text-[#A0A0A0]">
                        {(planBenefits[plan.key] || []).map((ben, idx) => (
                          <li key={idx} className="flex items-center gap-1.5"><span className="text-[#69FFB7]">&bull;</span>{ben}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-8">
                      <Link href={`/app/billing?checkoutPlan=${plan.key}`} className={`block w-full text-center py-2 rounded text-xs font-bold transition ${isHighlight ? "bg-[#C0C4FF] text-[#1B1C2F] hover:bg-opacity-90" : "border border-white/10 bg-[#171829] hover:bg-white/5 text-white"}`}>Select {plan.displayName}</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section className="py-24 text-center border-t border-[#6B6278]">
          <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 space-y-6">
            <h2 className="text-3xl font-bold text-white">Every shipped feature needs proof.</h2>
            <p className="text-sm text-[#A0A0A0] max-w-md mx-auto">Stop guessing if a pull request is actually complete. Build release telemetry reports that your clients and team can trust.</p>
            <div className="pt-4 flex justify-center gap-4">
              <Link href="/login" className="rounded bg-[#C0C4FF] text-[#1B1C2F] px-8 py-3 text-sm font-bold shadow-lg hover:bg-opacity-95 transition">Start verifying PRs</Link>
              <a href="#proof-chain" className="rounded border border-[#6B6278] bg-[#141524] px-8 py-3 text-sm font-medium hover:bg-white/5 transition">View sample proof</a>
            </div>
          </div>
        </section>
      </main>
      <footer className="py-8 border-t border-[#6B6278] text-center text-xs text-[#A0A0A0] bg-[#1B1C2F]">MergeMint &copy; {new Date().getFullYear()} - The Evidence Control Room.</footer>
    </div>
  );
}
