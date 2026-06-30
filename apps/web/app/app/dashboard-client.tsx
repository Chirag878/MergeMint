"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/react";

type WorkspaceUseCase = "agency" | "product_team" | "solo_builder";

const personaOptions: Array<{
  value: WorkspaceUseCase;
  title: string;
  label: string;
  copy: string;
}> = [
  {
    value: "agency",
    title: "Client work",
    label: "Agency / Freelancer / AI Studio",
    copy: "Lead with client ledgers, projects, approvals, risks, and report archives."
  },
  {
    value: "product_team",
    title: "Internal product work",
    label: "Startup / CTO / PM / Product Team",
    copy: "Lead with projects, feature verification, and release control rooms."
  },
  {
    value: "solo_builder",
    title: "Solo project",
    label: "Solo Founder / Indie Builder",
    copy: "Lead with a project and verify each feature PR before release."
  }
];

export function DashboardClient({
  userLabel
}: {
  userLabel: string;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [demoError, setDemoError] = useState<string | null>(null);
  const summary = trpc.dashboard.getSummary.useQuery();
  const workspaceSetup = trpc.guidedWorkflow.getWorkspaceSetup.useQuery();
  const setUseCase = trpc.workspace.setUseCase.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.dashboard.getSummary.invalidate(),
        utils.workspace.me.invalidate(),
        utils.workspace.getCurrent.invalidate()
      ]);
    }
  });
  const createDemoProject = trpc.projects.create.useMutation();
  const createDemoFeature = trpc.featureRequests.create.useMutation();

  if (summary.isLoading) {
    return (
      <main className="min-h-screen bg-[#060706] px-5 py-10 text-neutral-100 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-7xl rounded-lg border border-white/10 bg-white/[0.035] p-6 text-sm text-neutral-400">
          Loading command center...
        </section>
      </main>
    );
  }

  if (summary.error || !summary.data) {
    return (
      <main className="min-h-screen bg-[#060706] px-5 py-10 text-neutral-100 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-7xl rounded-lg border border-red-900/60 bg-red-950/30 p-6 text-sm text-red-200">
          {summary.error?.message ?? "Unable to load dashboard."}
        </section>
      </main>
    );
  }

  const data = summary.data;
  const useCase = normalizeUseCase(data.workspace.useCase);
  const isOwner = data.workspace.isOwner;
  const primarySecondary = getPrimarySecondary(useCase);
  const proofReadiness =
    data.stats.featureRequests > 0
      ? Math.round((data.stats.releaseReports / data.stats.featureRequests) * 100)
      : 0;
  const commandMetrics = [
    {
      label: "Active features",
      value: data.stats.featureRequests,
      detail: `${data.needsAttention.length} need attention`
    },
    {
      label: "Proof readiness",
      value: `${proofReadiness}%`,
      detail: `${data.stats.releaseReports} reports generated`
    },
    {
      label: "Linked PRs",
      value: data.stats.linkedPullRequests,
      detail: `${data.stats.qaReviews} AI QA reviews`
    },
    {
      label: "Open risks",
      value: data.stats.openFindings,
      detail: data.stats.openFindings > 0 ? "Review before release" : "No open risks"
    }
  ] as const;
  const isStartingDemo = createDemoProject.isPending || createDemoFeature.isPending;

  async function startDemoFlow() {
    setDemoError(null);

    try {
      const project = await createDemoProject.mutateAsync({
        name: "Sample Project - Checkout Proof",
        description:
          "Demo data: a safe sample project for walking through MergeMint's proof chain. Not connected to a real GitHub repository.",
        clientName: "Sample Client"
      });
      const feature = await createDemoFeature.mutateAsync({
        projectId: project.id,
        title: "Sample Feature - Role-based checkout approval",
        description:
          "Demo data: add an approval checkpoint before checkout changes can be marked ready for release.",
        businessGoal:
          "Help founders and CTOs verify that a delivered PR matches the original product request before shipping.",
        expectedBehavior:
          "A release owner can review requirements, inspect PR evidence, run QA, approve or request fixes, generate a report, and manually publish GitHub Proof.",
        acceptanceCriteria: [
          "Requirement Review can be completed before PRD generation.",
          "PRD and Engineering Tasks can be generated from the sample feature.",
          "GitHub PR evidence is clearly marked as not connected until a real PR is linked.",
          "GitHub Proof remains manual-only and is not auto-published."
        ],
        priority: "high"
      });

      await Promise.all([
        utils.dashboard.getSummary.invalidate(),
        utils.guidedWorkflow.getWorkspaceSetup.invalidate(),
        utils.projects.list.invalidate(),
        utils.featureRequests.list.invalidate(),
        utils.featureRequests.listByProject.invalidate({ projectId: project.id }),
        utils.releaseBoard.getBoard.invalidate()
      ]);

      router.push(`/app/features/${feature.id}`);
    } catch (error) {
      setDemoError(
        error instanceof Error
          ? error.message
          : "Unable to start the sample project."
      );
    }
  }

  return (
    <main className="vf-app-page min-h-screen overflow-hidden px-5 py-8 text-neutral-100 sm:px-6 lg:px-8">
      <div className="vf-dashboard-aura pointer-events-none fixed inset-x-0 top-0 h-64" />

      <section className="relative mx-auto max-w-7xl space-y-8">
        <header className="vf-dashboard-cockpit vf-app-hero-card vf-fade-up rounded-lg border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 lg:p-8">
          <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="flex min-h-[22rem] flex-col justify-between">
              <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip>{data.workspace.name}</StatusChip>
                <StatusChip>{formatRole(data.workspace.role)}</StatusChip>
                {useCase ? <StatusChip>{getPersonaLabel(useCase)}</StatusChip> : null}
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                Command center for verified delivery
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-neutral-300">
                See what is ready, what is blocked, and which proof chain needs
                attention before a PR ships.
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-500">
                For agencies, founders, CTOs, PMs, and teams shipping with
                outsourced or internal developers. Signed in as {userLabel}.
              </p>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={startDemoFlow}
                  disabled={isStartingDemo}
                  className="vf-primary-cta rounded-md bg-white px-4 py-2.5 text-center text-sm font-semibold text-neutral-950 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isStartingDemo ? "Starting demo..." : "Start demo project"}
                </button>
                <Link
                  href={primarySecondary.primary.href}
                  className="rounded-md border border-white/15 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:border-[#E8C999]/40"
                >
                  {primarySecondary.primary.cta}
                </Link>
                <Link
                  href="/app/board"
                  className="rounded-md border border-white/15 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:border-[#E8C999]/40"
                >
                  Open release board
                </Link>
              </div>
              {demoError ? (
                <p className="mt-3 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                  {demoError}
                </p>
              ) : null}
            </div>
            <div className="vf-command-metric-deck grid gap-3 sm:grid-cols-2">
              {commandMetrics.map((metric) => (
                <CommandMetric
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  detail={metric.detail}
                />
              ))}
              <div className="vf-command-note sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8C999]">
                  Current mode
                </p>
                <p className="mt-2 text-sm text-neutral-300">
                  {useCase
                    ? `${getPersonaLabel(useCase)}. ${isOwner ? "You can tune workspace focus." : "Owner controls persona."}`
                    : "Choose a workspace mode to tailor the cockpit."}
                </p>
              </div>
            </div>
          </div>
        </header>

        {!useCase ? (
          <OnboardingChoice
            isOwner={isOwner}
            isSaving={setUseCase.isPending}
            error={setUseCase.error?.message}
            onSelect={(nextUseCase) => setUseCase.mutate({ useCase: nextUseCase })}
          />
        ) : null}

        {useCase ? (
          <PersonaSwitcher
            currentUseCase={useCase}
            isOwner={isOwner}
            isSaving={setUseCase.isPending}
            error={setUseCase.error?.message}
            onSelect={(nextUseCase) => setUseCase.mutate({ useCase: nextUseCase })}
          />
        ) : null}

        {data.isEmpty ? <FirstTimeEmptyState /> : null}

        <DemoFlowCard
          isStarting={isStartingDemo}
          error={demoError}
          onStart={startDemoFlow}
        />

        <section className="vf-dashboard-grid vf-section-reveal grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            {workspaceSetup.data ? (
              <NextBestActionCard workflow={workspaceSetup.data} />
            ) : null}
            <NeedsAttention items={data.needsAttention} />
          </div>
          <div className="space-y-5">
            <ReleaseBoardSummary summary={data.boardSummary} />
            <RecentClients clients={data.recentClients} />
            <RecentProjects projects={data.recentProjects} />
          </div>
        </section>

        <section className="vf-section-reveal grid gap-4 lg:grid-cols-2">
          <PathCard
            title={primarySecondary.primary.title}
            copy={primarySecondary.primary.copy}
            cta={primarySecondary.primary.cta}
            href={primarySecondary.primary.href}
            detail={primarySecondary.primary.detail}
            strong
          />
          <PathCard
            title={primarySecondary.secondary.title}
            copy={primarySecondary.secondary.copy}
            cta={primarySecondary.secondary.cta}
            href={primarySecondary.secondary.href}
            detail={primarySecondary.secondary.detail}
          />
        </section>

        <section className="vf-section-reveal rounded-lg border border-white/10 bg-white/[0.035] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Workspace snapshot
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Lightweight health counters after the active work queue.
              </p>
            </div>
            <Link
              href="/app/projects"
              className="rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:border-emerald-300/40"
            >
              Open projects
            </Link>
          </div>
          <div className="mt-4">
            <StatsGrid stats={data.stats} />
          </div>
        </section>
      </section>
    </main>
  );
}

function CommandMetric({
  label,
  value,
  detail
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="vf-command-metric rounded-lg border border-white/10 bg-black/25 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-neutral-400">{detail}</p>
    </div>
  );
}

function DemoFlowCard({
  isStarting,
  error,
  onStart
}: {
  isStarting: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const steps = [
    "Feature Request",
    "Requirement Review",
    "PRD",
    "Engineering Tasks",
    "GitHub PR",
    "AI QA Review",
    "Developer Fix Pack",
    "Human Approval",
    "Client Report",
    "GitHub Proof"
  ];

  return (
    <section className="vf-demo-flow-card vf-section-reveal rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8C999]">
            Guided demo
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Try a safe sample project
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            Creates clearly labeled sample data and opens the Release Control
            Room. GitHub PR evidence stays disconnected until you link a real PR;
            GitHub Proof remains manual-only.
          </p>
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={isStarting}
          className="vf-primary-cta rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isStarting ? "Creating sample..." : "Start Demo"}
        </button>
      </div>
      <div className="mt-5 grid gap-2 md:grid-cols-5">
        {steps.map((step, index) => (
          <div
            key={step}
            className="rounded-md border border-white/10 bg-black/20 p-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Step {index + 1}
            </p>
            <p className="mt-1 text-sm font-medium text-neutral-100">{step}</p>
          </div>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
    </section>
  );
}

function NextBestActionCard({
  workflow
}: {
  workflow: {
    title: string;
    description: string;
    primaryActionLabel: string;
    primaryActionHref?: string;
    secondaryActionLabel?: string;
    secondaryActionHref?: string;
    blockedReason?: string;
    completionPercentage: number;
    steps: Array<{
      id: string;
      label: string;
      status: "completed" | "current" | "blocked" | "upcoming";
    }>;
  };
}) {
  return (
    <section className="rounded-lg border border-emerald-300/25 bg-emerald-300/[0.055] p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-emerald-200">
            Your Release Focus
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            {workflow.title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
            {workflow.description}
          </p>
          {workflow.blockedReason ? (
            <p className="mt-3 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
              {workflow.blockedReason}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {workflow.primaryActionHref ? (
            <Link
              href={workflow.primaryActionHref}
              className="rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-neutral-950 transition hover:bg-neutral-100"
            >
              {workflow.primaryActionLabel}
            </Link>
          ) : null}
          {workflow.secondaryActionHref ? (
            <Link
              href={workflow.secondaryActionHref}
              className="rounded-md border border-white/15 px-4 py-2 text-center text-sm font-semibold text-white transition hover:border-emerald-300/40"
            >
              {workflow.secondaryActionLabel}
            </Link>
          ) : null}
        </div>
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Setup progress</span>
          <span>{workflow.completionPercentage}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-black/40">
          <div
            className="h-2 rounded-full bg-emerald-300"
            style={{ width: `${workflow.completionPercentage}%` }}
          />
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-5">
          {workflow.steps.map((step) => (
            <div
              key={step.id}
              className="rounded-md border border-white/10 bg-black/25 p-3"
            >
              <p className="text-sm font-medium text-white">{step.label}</p>
              <p className="mt-1 text-xs text-neutral-500">{step.status}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PersonaSwitcher({
  currentUseCase,
  isOwner,
  isSaving,
  error,
  onSelect
}: {
  currentUseCase: WorkspaceUseCase;
  isOwner: boolean;
  isSaving: boolean;
  error?: string;
  onSelect: (useCase: WorkspaceUseCase) => void;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Workspace use case
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Product persona personalizes dashboard emphasis. Access permissions
            are still controlled separately by workspace role.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {personaOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              disabled={!isOwner || isSaving || currentUseCase === option.value}
              className={
                currentUseCase === option.value
                  ? "rounded-md border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-100 disabled:cursor-default"
                  : "rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-neutral-300 transition hover:border-emerald-300/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              {option.title}
            </button>
          ))}
        </div>
      </div>
      {!isOwner ? (
        <p className="mt-4 text-sm text-amber-200">
          Only an Owner or workspace admin can change this setting.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
    </section>
  );
}

function OnboardingChoice({
  isOwner,
  isSaving,
  error,
  onSelect
}: {
  isOwner: boolean;
  isSaving: boolean;
  error?: string;
  onSelect: (useCase: WorkspaceUseCase) => void;
}) {
  return (
    <section className="vf-fade-up rounded-lg border border-emerald-300/20 bg-emerald-300/[0.045] p-6 lg:p-8">
      <p className="text-sm font-medium uppercase tracking-[0.24em] text-emerald-200">
        Choose how you want to use MergeMint
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-white">
        Choose how you want to start
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
        Client ledgers are optional. You can verify PRs for your own product by
        starting with a project.
      </p>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {personaOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            disabled={!isOwner || isSaving}
            className="rounded-md border border-white/10 bg-black/25 p-5 text-left transition hover:-translate-y-1 hover:border-emerald-300/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <p className="text-sm font-semibold text-emerald-200">
              {option.title}
            </p>
            <h3 className="mt-3 font-semibold text-white">{option.label}</h3>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              {option.copy}
            </p>
          </button>
        ))}
      </div>
      {!isOwner ? (
        <p className="mt-4 text-sm text-amber-200">
          Only an Owner or workspace admin can set the workspace use case.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
    </section>
  );
}

function PathCard({
  title,
  copy,
  cta,
  href,
  detail,
  strong
}: {
  title: string;
  copy: string;
  cta: string;
  href: string;
  detail: string;
  strong?: boolean;
}) {
  return (
    <article
      className={
        strong
          ? "vf-fade-up rounded-lg border border-emerald-300/25 bg-emerald-300/[0.06] p-6 shadow-2xl shadow-black/20 transition hover:-translate-y-1"
          : "vf-fade-up rounded-lg border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20 transition hover:-translate-y-1 hover:border-white/20"
      }
    >
      <h2 className="text-2xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-neutral-300">{copy}</p>
      <p className="mt-4 text-sm text-neutral-500">{detail}</p>
      <Link
        href={href}
        className="mt-6 inline-flex rounded-md bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-100"
      >
        {cta}
      </Link>
    </article>
  );
}

function StatsGrid({
  stats
}: {
  stats: {
    clients: number;
    projects: number;
    featureRequests: number;
    linkedPullRequests: number;
    qaReviews: number;
    releaseReports: number;
    openFindings: number;
  };
}) {
  const items = [
    ["Clients", stats.clients],
    ["Projects", stats.projects],
    ["Feature requests", stats.featureRequests],
    ["Linked PRs", stats.linkedPullRequests],
    ["QA reviews", stats.qaReviews],
    ["Release reports", stats.releaseReports],
    ["Open risks", stats.openFindings]
  ] as const;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-md border border-white/10 bg-white/[0.035] p-4"
        >
          <p className="text-xs text-neutral-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        </div>
      ))}
    </section>
  );
}

function FirstTimeEmptyState() {
  return (
    <section className="rounded-lg border border-amber-300/20 bg-amber-300/[0.045] p-6">
      <h2 className="text-xl font-semibold text-white">
        Choose how you want to start
      </h2>
      <p className="mt-3 text-sm leading-6 text-neutral-300">
        Client ledgers are optional. You can verify PRs for your own product by
        starting with a project.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/app/clients"
          className="rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-neutral-950"
        >
          Create client ledger
        </Link>
        <Link
          href="/app/projects"
          className="rounded-md border border-white/15 px-4 py-2 text-center text-sm font-semibold text-white"
        >
          Create project
        </Link>
      </div>
    </section>
  );
}

function NeedsAttention({
  items
}: {
  items: Array<{
    featureRequestId: string;
    featureTitle: string;
    projectName: string;
    clientName: string | null;
    stage: string;
    nextAction: string;
  }>;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <h2 className="text-lg font-semibold text-white">Needs attention</h2>
      {items.length === 0 ? (
        <p className="mt-4 rounded-md border border-white/10 bg-black/25 p-4 text-sm text-neutral-400">
          Nothing blocked. Start a new feature request or open a client ledger.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article
              key={item.featureRequestId}
              className="rounded-md border border-white/10 bg-black/25 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold text-white">{item.featureTitle}</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {item.projectName}
                    {item.clientName ? ` - ${item.clientName}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusChip>{item.stage}</StatusChip>
                    <StatusChip>{item.nextAction}</StatusChip>
                  </div>
                </div>
                <Link
                  href={`/app/features/${item.featureRequestId}`}
                  className="rounded-md border border-white/15 px-3 py-2 text-center text-sm font-semibold text-white transition hover:border-emerald-300/40"
                >
                  Open release control room
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ReleaseBoardSummary({
  summary
}: {
  summary: {
    pending: number;
    ongoing: number;
    completing: number;
    shippedThisMonth: number;
  };
}) {
  const items = [
    ["Pending", summary.pending],
    ["Ongoing", summary.ongoing],
    ["Completing", summary.completing],
    ["Shipped 30d", summary.shippedThisMonth]
  ] as const;

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Release Board</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Feature releases grouped by current delivery stage.
          </p>
        </div>
        <Link
          href="/app/board"
          className="rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:border-emerald-300/40"
        >
          Open board
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-md border border-white/10 bg-black/25 p-3">
            <p className="text-xs text-neutral-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentClients({
  clients
}: {
  clients: Array<{
    clientId: string;
    name: string;
    projectCount: number;
    openRisks: number;
    reportsCount: number;
  }>;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <h2 className="text-lg font-semibold text-white">Recent client ledgers</h2>
      <ListEmpty empty={clients.length === 0} text="No client ledgers yet." />
      <div className="mt-4 space-y-3">
        {clients.map((client) => (
          <Link
            key={client.clientId}
            href={`/app/clients/${client.clientId}`}
            className="block rounded-md border border-white/10 bg-black/25 p-4 transition hover:border-emerald-300/30"
          >
            <p className="font-semibold text-white">{client.name}</p>
            <p className="mt-2 text-sm text-neutral-500">
              {client.projectCount} projects - {client.openRisks} open risks -{" "}
              {client.reportsCount} reports
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecentProjects({
  projects
}: {
  projects: Array<{
    projectId: string;
    name: string;
    clientName: string | null;
    featureCount: number;
  }>;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <h2 className="text-lg font-semibold text-white">Recent projects</h2>
      <ListEmpty empty={projects.length === 0} text="No projects yet." />
      <div className="mt-4 space-y-3">
        {projects.map((project) => (
          <Link
            key={project.projectId}
            href={`/app/features?projectId=${project.projectId}`}
            className="block rounded-md border border-white/10 bg-black/25 p-4 transition hover:border-sky-300/30"
          >
            <p className="font-semibold text-white">{project.name}</p>
            <p className="mt-2 text-sm text-neutral-500">
              {project.clientName ? `${project.clientName} - ` : ""}
              {project.featureCount} feature requests
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ListEmpty({ empty, text }: { empty: boolean; text: string }) {
  return empty ? (
    <p className="mt-4 rounded-md border border-white/10 bg-black/25 p-4 text-sm text-neutral-500">
      {text}
    </p>
  ) : null;
}

function StatusChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-xs text-emerald-100">
      {children}
    </span>
  );
}

function getPrimarySecondary(useCase: WorkspaceUseCase | null) {
  if (useCase === "agency") {
    return {
      primary: {
        title: "Create client ledger",
        copy: "Create a client delivery ledger to track requests, projects, PR evidence, approvals, risks, and release reports.",
        cta: "Create client ledger",
        href: "/app/clients",
        detail: "Best for agencies, freelancers, and AI studios."
      },
      secondary: {
        title: "Create project",
        copy: "Start a project directly when the work is not tied to a client ledger yet.",
        cta: "Create project",
        href: "/app/projects",
        detail: "Project remains the mandatory base for verification."
      }
    };
  }

  if (useCase === "solo_builder") {
    return {
      primary: {
        title: "Create project",
        copy: "Start with a project and verify every feature PR against the original requirements before release.",
        cta: "Create project",
        href: "/app/projects",
        detail: "Best for solo founders and indie builders."
      },
      secondary: {
        title: "Add feature request",
        copy: "Once a project exists, feature requests become the verification unit.",
        cta: "Add feature request",
        href: "/app/features",
        detail: "Feature is where PR verification starts."
      }
    };
  }

  return {
    primary: {
      title: "Create project",
      copy: "Start with a project and verify every feature PR against the original requirements before release.",
      cta: "Create project",
      href: "/app/projects",
      detail: "Best for founders, CTOs, PMs, and internal product teams."
    },
    secondary: {
      title: "Create client ledger",
      copy: "Use client ledgers when the release proof needs to be grouped by client account.",
      cta: "Create client ledger",
      href: "/app/clients",
      detail: "Clients stay available, but they are optional."
    }
  };
}

function getPersonaLabel(useCase: WorkspaceUseCase) {
  if (useCase === "agency") {
    return "Agency / Freelancer / AI Studio";
  }

  if (useCase === "solo_builder") {
    return "Solo Founder / Indie Builder";
  }

  return "Startup / CTO / PM / Product Team";
}

function normalizeUseCase(value: string | null): WorkspaceUseCase | null {
  return value === "agency" ||
    value === "product_team" ||
    value === "solo_builder"
    ? value
    : null;
}

function formatRole(role: string) {
  return role === "owner"
    ? "Owner"
    : role
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
