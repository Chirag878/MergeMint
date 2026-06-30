"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import Link from "next/link";
import { BILLING_PLANS, PAID_BILLING_PLAN_KEYS } from "@veriflow/shared";

const pricingPlans = PAID_BILLING_PLAN_KEYS.map((key) => BILLING_PLANS[key]);

const proofSteps = [
  {
    title: "Feature Request",
    detail: "Original client intent is captured before code starts.",
    signal: "Intent locked"
  },
  {
    title: "Requirement Review",
    detail: "Ambiguity is resolved with focused clarification questions.",
    signal: "Scope checked"
  },
  {
    title: "PRD",
    detail: "The request becomes testable requirements and acceptance criteria.",
    signal: "Spec generated"
  },
  {
    title: "Engineering Tasks",
    detail: "Requirements become developer-ready work items.",
    signal: "Tasks mapped"
  },
  {
    title: "GitHub PR",
    detail: "MergeMint connects to the real implementation pull request.",
    signal: "PR linked"
  },
  {
    title: "AI QA Review",
    detail: "The diff is checked against PRD, tasks, and rules.",
    signal: "Evidence reviewed"
  },
  {
    title: "Developer Fix Pack",
    detail: "Missing or risky work becomes actionable fix guidance.",
    signal: "Fix path ready"
  },
  {
    title: "Human Approval",
    detail: "A reviewer records the final product decision.",
    signal: "Sign-off logged"
  },
  {
    title: "Client Release Report",
    detail: "Safe delivery evidence is packaged for stakeholders.",
    signal: "Report shared"
  },
  {
    title: "GitHub Proof",
    detail: "A sticky verification comment/status is published to the PR.",
    signal: "Proof posted"
  }
];

const capabilities = [
  ["Requirement Review", "Collect the missing answers that would otherwise derail the PRD."],
  ["PRD Generator", "Turn a rough request into structured release criteria."],
  ["Engineering Tasks", "Create implementation steps tied back to requirements."],
  ["AI QA Review", "Compare the PR snapshot against the product promise."],
  ["Coverage Map", "See covered, partial, missing, and risky requirements."],
  ["Developer Fix Pack", "Give developers or coding agents a precise repair prompt."],
  ["Human Approval", "Capture the final decision with context and risk notes."],
  ["Release Reports", "Share client-safe delivery evidence without leaking internals."],
  ["GitHub Proof Gate", "Publish one sticky proof comment and commit status manually."]
];

const audiences = [
  "Founders",
  "CTOs",
  "Product leads",
  "Engineering managers",
  "Agencies",
  "Freelancers",
  "AI coding teams",
  "Client delivery teams"
];

const planBenefits: Record<string, string[]> = {
  launch_pack: ["3 verified PR reviews", "Repository context", "Coverage map", "Release reports"],
  pilot: ["15 PR reviews / month", "AI QA review", "Fix pack", "Client reports"],
  studio: ["90 PR reviews / month", "Rules engine", "Approval flow", "Priority support"],
  scale: ["220 PR reviews / month", "Team workspace", "Advanced reports", "Custom rules"],
  agency_max: ["500 PR reviews / month", "High-volume delivery", "Custom support", "Contract options"]
};

function useScrollY() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const update = () => setScrollY(window.scrollY);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return scrollY;
}

function useReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

function useElementProgress(ref: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const viewport = window.innerHeight;
      const total = rect.height + viewport * 0.75;
      const raw = (viewport * 0.82 - rect.top) / total;
      setProgress(Math.min(Math.max(raw, 0), 1));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ref]);

  return progress;
}

function AmbientBackground() {
  const scrollY = useScrollY();

  return (
    <div className="mm-ambient" aria-hidden="true">
      <div className="mm-hero-aura" />
      <div className="mm-spotlight" />
      <div
        className="mm-grid"
        style={{ transform: `translate3d(0, ${scrollY * 0.05}px, 0)` }}
      />
      <div
        className="mm-grid mm-grid-fine"
        style={{ transform: `translate3d(0, ${scrollY * 0.11}px, 0)` }}
      />
      <div
        className="mm-mesh"
        style={{ transform: `translate3d(${scrollY * -0.018}px, ${scrollY * 0.035}px, 0)` }}
      />
      <div
        className="mm-orbit mm-orbit-one"
        style={
          {
            "--drift-x": `${scrollY * 0.025}px`,
            "--drift-y": `${scrollY * 0.018}px`
          } as CSSProperties
        }
      />
      <div
        className="mm-orbit mm-orbit-two"
        style={
          {
            "--drift-x": `${scrollY * -0.02}px`,
            "--drift-y": `${scrollY * 0.024}px`
          } as CSSProperties
        }
      />
      <div className="mm-blob mm-blob-one" />
      <div className="mm-blob mm-blob-two" />
      <div className="mm-blob mm-blob-three" />
      <div className="mm-particles">
        {Array.from({ length: 24 }).map((_, index) => (
          <span
            key={index}
            style={
              {
                "--x": `${(index * 37) % 100}%`,
                "--y": `${(index * 53) % 100}%`,
                "--delay": `${index * 0.35}s`,
                "--size": `${index % 3 === 0 ? 3 : 2}px`
            } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <span className="mm-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" role="img">
        <path className="mm-brand-frame" d="M9 7.5H31L34.5 11V29L31 32.5H9L5.5 29V11L9 7.5Z" />
        <path className="mm-brand-path" d="M12 14.5H17.8C19.5 14.5 20.5 15.4 20.5 17V23C20.5 24.6 21.5 25.5 23.2 25.5H28" />
        <path className="mm-brand-path" d="M28 14.5H22.2C20.5 14.5 19.5 15.4 19.5 17V23C19.5 24.6 18.5 25.5 16.8 25.5H12" />
        <path className="mm-brand-check" d="M15.2 20.4L18.1 23.2L24.9 16.8" />
        <circle className="mm-brand-dot" cx="12" cy="14.5" r="1.6" />
        <circle className="mm-brand-dot" cx="28" cy="25.5" r="1.6" />
      </svg>
    </span>
  );
}

function Navbar() {
  const scrollY = useScrollY();
  const compact = scrollY > 32;

  return (
    <header className={`mm-nav ${compact ? "mm-nav-compact" : ""}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark />
          <span className="text-sm font-semibold tracking-tight text-[#F8EEDF]">
            MergeMint
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-[13px] text-[#E8C999]/70 md:flex">
          <a href="#problem" className="transition hover:text-[#F8EEDF]">Problem</a>
          <a href="#product" className="transition hover:text-[#F8EEDF]">Product</a>
          <a href="#proof-chain" className="transition hover:text-[#F8EEDF]">Proof Chain</a>
          <a href="#pricing" className="transition hover:text-[#F8EEDF]">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-[13px] text-[#E8C999]/70 transition hover:text-[#F8EEDF] sm:inline">
            Sign in
          </Link>
          <Link href="/login" className="mm-button mm-button-small">
            Start verifying
          </Link>
        </div>
      </div>
    </header>
  );
}

function ProductPreview() {
  return (
    <div className="mm-product-preview" data-reveal>
      <div className="mm-preview-depth" aria-hidden="true" />
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-[#8E1616]" />
          <span className="size-2.5 rounded-full bg-[#E9B63B]" />
          <span className="size-2.5 rounded-full bg-[#758A93]" />
        </div>
        <span className="font-mono text-[11px] text-[#ECD5BC]/55">
          feature/checkout-credits-pr-482
        </span>
      </div>
      <div className="grid gap-0 lg:grid-cols-[240px_1fr]">
        <aside className="hidden border-r border-white/10 bg-black/20 p-4 lg:block">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#E8C999]/45">
            Release room
          </p>
          {["Feature Request", "PRD", "GitHub PR", "AI QA Review", "Proof Gate"].map(
            (item, index) => (
              <div
                key={item}
                className={`mb-2 rounded-lg px-3 py-2 text-sm ${
                  index === 3
                    ? "bg-[#E8C999]/10 text-[#F8EEDF]"
                    : "text-[#E8C999]/55"
                }`}
              >
                {item}
              </div>
            )
          )}
        </aside>
        <div className="p-4 sm:p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mm-eyebrow">AI QA Review</p>
              <h3 className="mt-2 text-xl font-semibold text-[#F8EEDF]">
                Checkout credit activation
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#ECD5BC]/62">
                MergeMint compared the linked PR against the original request,
                PRD requirements, tasks, and release rules.
              </p>
            </div>
            <div className="rounded-full border border-[#E9B63B]/30 bg-[#E9B63B]/10 px-3 py-1 text-xs font-medium text-[#FFC69D]">
              Ready with evidence
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Readiness", "91"],
              ["Requirements", "12/13"],
              ["Findings", "1 warning"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs text-[#ECD5BC]/48">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-[#F8EEDF]">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-[#F8EEDF]">
                Requirement coverage
              </p>
              <span className="font-mono text-[11px] text-[#E8C999]/55">
                REQ-001 to REQ-013
              </span>
            </div>
            <div className="space-y-2">
              {[
                ["Payment captured maps to credits", "covered", "w-[92%]"],
                ["Webhook remains idempotent", "covered", "w-[84%]"],
                ["Manual retry messaging", "warning", "w-[61%]"]
              ].map(([label, status, width]) => (
                <div key={label} className="rounded-lg bg-white/[0.035] p-3">
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-[#ECD5BC]/72">{label}</span>
                    <span className={status === "covered" ? "text-[#E8C999]" : "text-[#E06B80]"}>
                      {status}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full bg-gradient-to-r from-[#8E1616] via-[#CD2C58] to-[#E8C999] ${width}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProofChain() {
  const ref = useRef<HTMLElement | null>(null);
  const progress = useElementProgress(ref);
  const activeIndex = Math.min(
    proofSteps.length - 1,
    Math.floor(progress * proofSteps.length)
  );
  const pathLength = 1840;

  return (
    <section id="proof-chain" ref={ref} className="mm-section">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <p className="mm-eyebrow">Signature workflow</p>
          <h2 className="mm-section-title">The Proof Chain</h2>
          <p className="mm-section-copy">
            A premium evidence chain that follows the work from client intent to
            a GitHub-native verification signal.
          </p>
        </div>
        <div className="mm-proof-shell" data-reveal>
          <div className="mm-proof-glow" />
          <svg className="mm-proof-line" viewBox="0 0 1000 1260" fill="none" aria-hidden="true">
            <path
              d="M500 42 C500 112 235 105 235 210 C235 315 765 278 765 390 C765 508 235 462 235 588 C235 715 765 666 765 792 C765 920 235 872 235 1000 C235 1115 500 1110 500 1218"
              stroke="rgba(232,201,153,0.14)"
              strokeWidth="2"
            />
            <path
              d="M500 42 C500 112 235 105 235 210 C235 315 765 278 765 390 C765 508 235 462 235 588 C235 715 765 666 765 792 C765 920 235 872 235 1000 C235 1115 500 1110 500 1218"
              stroke="url(#proofGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={pathLength}
              strokeDashoffset={pathLength - progress * pathLength}
            />
            <defs>
              <linearGradient id="proofGradient" x1="146" y1="56" x2="829" y2="1191">
                <stop stopColor="#E8C999" />
                <stop offset="0.45" stopColor="#CD2C58" />
                <stop offset="1" stopColor="#FFC69D" />
              </linearGradient>
            </defs>
          </svg>
          <div className="mm-proof-steps">
            {proofSteps.map((step, index) => {
              const complete = index < activeIndex;
              const active = index === activeIndex;

              return (
                <article
                  key={step.title}
                  className={`mm-proof-card ${index % 2 === 0 ? "is-left" : "is-right"} ${
                    active ? "is-active" : ""
                  } ${complete ? "is-complete" : ""}`}
                  style={{ "--delay": `${index * 90}ms` } as CSSProperties}
                >
                  <div className="mm-proof-node">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3>{step.title}</h3>
                      <span>{step.signal}</span>
                    </div>
                    <p>{step.detail}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mm-section">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center" data-reveal>
          <p className="mm-eyebrow">Pricing</p>
          <h2 className="mm-section-title">Pay for verified release volume</h2>
          <p className="mm-section-copy">
            Public pricing links only route into protected billing. No public
            Razorpay checkout is opened from this page.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {pricingPlans.map((plan, index) => {
            const featured = plan.key === "studio";
            return (
              <article
                key={plan.key}
                className={`mm-price-card ${featured ? "is-featured" : ""}`}
                data-reveal
                style={{ "--delay": `${index * 70}ms` } as CSSProperties}
              >
                {featured ? <span className="mm-price-badge">Best for teams</span> : null}
                <h3>{plan.displayName}</h3>
                <p className="mm-price">{plan.displayPrice}</p>
                <p className="mm-price-note">{plan.credits} verified PR reviews</p>
                <ul>
                  {(planBenefits[plan.key] ?? []).map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
                <Link href={`/app/billing?checkoutPlan=${plan.key}`} className="mm-price-link">
                  Select plan
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
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
    <div className="max-w-2xl" data-reveal>
      <p className="mm-eyebrow">{eyebrow}</p>
      <h2 className="mm-section-title text-left">{title}</h2>
      <p className="mm-section-copy text-left">{copy}</p>
    </div>
  );
}

export default function LandingPage() {
  useReveal();

  const capabilityCards = useMemo(() => capabilities, []);

  return (
    <div className="mm-landing min-h-screen overflow-x-hidden bg-[#050202] text-[#F8EEDF]">
      <AmbientBackground />
      <Navbar />
      <main className="relative z-10">
        <section className="mm-hero">
          <div className="mx-auto max-w-7xl px-5 pt-32 sm:px-6 lg:px-8 lg:pt-40">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mm-pill mx-auto" data-reveal>
                <span className="mm-live-dot" />
                AI Product Delivery Pipeline
              </div>
              <h1 className="mt-7 text-balance text-5xl font-semibold tracking-[-0.055em] text-[#F8EEDF] sm:text-6xl lg:text-7xl" data-reveal>
                GitHub shows what changed. MergeMint shows whether it is done.
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-8 text-[#ECD5BC]/72" data-reveal>
                MergeMint turns feature requests into PRDs, engineering tasks,
                AI QA reviews, approval evidence, release reports, and GitHub
                proof so teams can ship with confidence.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row" data-reveal>
                <Link href="/login" className="mm-button">
                  Start verifying PRs
                </Link>
                <a href="#proof-chain" className="mm-button mm-button-secondary">
                  See the Proof Chain
                </a>
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section id="problem" className="mm-section">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
            <SectionHeader
              eyebrow="The problem"
              title="Code review is not delivery proof."
              copy="A pull request can pass review while still missing the original business request. MergeMint connects the promise, the implementation, the QA evidence, and the human approval into one delivery record."
            />
            <div className="grid gap-3" data-reveal>
              {[
                ["Before MergeMint", "Specs live in chats, tasks drift, and PR review becomes a manual detective job."],
                ["After MergeMint", "Every release step leaves structured evidence that can be reviewed, fixed, approved, and shared."],
                ["Why it matters", "Founders, clients, and engineering leads can see what was promised versus what actually shipped."]
              ].map(([title, copy]) => (
                <div key={title} className="mm-insight-card">
                  <span>{title}</span>
                  <p>{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className="mm-section">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <SectionHeader
                eyebrow="How it works"
                title="A release control room between product intent and GitHub."
                copy="MergeMint does not replace GitHub, your developers, or your AI coding tools. It adds the missing evidence layer that proves whether the work matches the request."
              />
              <div className="mm-system-card" data-reveal>
                {[
                  ["Request", "The feature promise"],
                  ["Plan", "PRD and tasks"],
                  ["Verify", "PR evidence and AI QA"],
                  ["Approve", "Human decision"],
                  ["Publish", "Report and GitHub proof"]
                ].map(([title, copy], index) => (
                  <div key={title} className="mm-system-row">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <ProofChain />

        <section id="capabilities" className="mm-section">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mx-auto mb-12 max-w-2xl text-center" data-reveal>
              <p className="mm-eyebrow">Capabilities</p>
              <h2 className="mm-section-title">Built for serious product delivery</h2>
              <p className="mm-section-copy">
                A focused set of release controls that turn a messy delivery
                loop into inspectable proof.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {capabilityCards.map(([title, copy], index) => (
                <article
                  key={title}
                  className="mm-capability-card"
                  data-reveal
                  style={{ "--delay": `${index * 55}ms` } as CSSProperties}
                >
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mm-section">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <SectionHeader
                eyebrow="Who it is for"
                title="For teams who need proof before they call work done."
                copy="MergeMint is built for people accountable for shipped outcomes, not just merged pull requests."
              />
              <div className="mm-audience-grid" data-reveal>
                {audiences.map((audience) => (
                  <div key={audience}>{audience}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Pricing />

        <section className="mm-final-cta">
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-6 lg:px-8" data-reveal>
            <p className="mm-eyebrow">Ship with evidence</p>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.04em] text-[#F8EEDF] sm:text-5xl">
              Make every pull request answer one question: is it actually done?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#ECD5BC]/70">
              Build the proof chain from request to GitHub without changing your
              engineering workflow.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/login" className="mm-button">
                Start verifying PRs
              </Link>
              <a href="#pricing" className="mm-button mm-button-secondary">
                View pricing
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="relative z-10 border-t border-[#E8C999]/10 px-5 py-8 text-center text-sm text-[#ECD5BC]/48">
        MergeMint - requirement-to-release proof for modern teams.
      </footer>
    </div>
  );
}
