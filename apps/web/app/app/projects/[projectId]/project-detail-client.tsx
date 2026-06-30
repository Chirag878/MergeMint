"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@veriflow/api";
import { trpc } from "@/trpc/react";

type ProjectControlRoom =
  inferRouterOutputs<AppRouter>["projects"]["getControlRoom"];
type VerificationRule =
  inferRouterOutputs<AppRouter>["verificationRules"]["listVerificationRules"][number];

const ruleSeverityOptions = ["blocking", "warning", "info"] as const;
const ruleScopeOptions = [
  "all",
  "frontend",
  "backend",
  "db",
  "auth",
  "billing",
  "api",
  "docs",
  "github",
  "ai"
] as const;

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const utils = trpc.useUtils();
  const [installationIdText, setInstallationIdText] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState({
    title: "",
    description: "",
    severity: "warning" as (typeof ruleSeverityOptions)[number],
    appliesTo: "all" as (typeof ruleScopeOptions)[number]
  });
  const controlRoom = trpc.projects.getControlRoom.useQuery({ projectId });
  const verificationRules = trpc.verificationRules.listVerificationRules.useQuery({
    projectId
  });
  const installations = trpc.githubApp.getInstallations.useQuery();
  const selectedInstallationId = installationIdText
    ? Number(installationIdText)
    : (installations.data?.[0]?.installationId ?? null);
  const repositories = trpc.githubApp.listInstallationRepositories.useQuery(
    { installationId: selectedInstallationId ?? 0 },
    { enabled: Boolean(selectedInstallationId) }
  );
  const latestAnalysis = trpc.repositoryIntelligence.getLatestByProject.useQuery(
    { projectId },
    { enabled: Boolean(projectId) }
  );
  const connectRepository =
    trpc.githubApp.connectRepositoryToProject.useMutation({
      onSuccess: async () => {
        setMessage("Repository connected.");
        await invalidateProject(utils, projectId);
        await utils.githubApp.getProjectIntegration.invalidate({ projectId });
        await utils.repositoryIntelligence.getLatestByProject.invalidate({
          projectId
        });
      }
    });
  const disconnectRepository =
    trpc.githubApp.disconnectRepositoryFromProject.useMutation({
      onSuccess: async () => {
        setMessage("Repository disconnected.");
        setRepositoryId("");
        await invalidateProject(utils, projectId);
        await utils.githubApp.getProjectIntegration.invalidate({ projectId });
      }
    });
  const analyzeRepository =
    trpc.repositoryIntelligence.analyzeProjectRepository.useMutation({
      onSuccess: async () => {
        setMessage("Repository analysis completed.");
        await invalidateProject(utils, projectId);
        await utils.repositoryIntelligence.getLatestByProject.invalidate({
          projectId
        });
      }
    });
  const updateStatus = trpc.projects.updateStatus.useMutation({
    onSuccess: async (_data, variables) => {
      setMessage(
        variables.status === "completed"
          ? "Project marked completed."
          : variables.status === "archived"
            ? "Project archived."
            : "Project reopened."
      );
      await invalidateProject(utils, projectId);
    },
    onError: (error, variables) => {
      if (
        variables.status === "completed" &&
        error.data?.code === "PRECONDITION_FAILED" &&
        window.confirm(
          "This project still has unresolved release items. Mark complete anyway?"
        )
      ) {
        updateStatus.mutate({
          ...variables,
          overrideUnresolved: true
        });
      }
    }
  });
  const createRule = trpc.verificationRules.createVerificationRule.useMutation({
    onSuccess: async () => {
      setMessage("Verification rule added.");
      resetRuleDraft();
      await verificationRules.refetch();
    }
  });
  const updateRule = trpc.verificationRules.updateVerificationRule.useMutation({
    onSuccess: async () => {
      setMessage("Verification rule updated.");
      resetRuleDraft();
      await verificationRules.refetch();
    }
  });
  const toggleRule = trpc.verificationRules.toggleVerificationRule.useMutation({
    onSuccess: async () => {
      setMessage("Verification rule status updated.");
      await verificationRules.refetch();
    }
  });
  const deleteRule = trpc.verificationRules.deleteVerificationRule.useMutation({
    onSuccess: async () => {
      setMessage("Verification rule deleted.");
      resetRuleDraft();
      await verificationRules.refetch();
    }
  });

  useEffect(() => {
    if (!installationIdText && installations.data?.[0]) {
      setInstallationIdText(String(installations.data[0].installationId));
    }
  }, [installationIdText, installations.data]);

  useEffect(() => {
    const connectedRepository = controlRoom.data?.connectedRepository;
    if (connectedRepository && !repositoryId) {
      setRepositoryId(connectedRepository.id);
    }
  }, [controlRoom.data?.connectedRepository, repositoryId]);

  const data = controlRoom.data;
  const analysis = latestAnalysis.data ?? data?.latestAnalysis ?? null;
  const focus = useMemo(() => (data ? getProjectFocus(data) : null), [data]);
  const canConnect = Boolean(repositoryId) && !connectRepository.isPending;
  const repositoryError =
    connectRepository.error?.message ??
    disconnectRepository.error?.message ??
    analyzeRepository.error?.message;

  function resetRuleDraft() {
    setEditingRuleId(null);
    setRuleDraft({
      title: "",
      description: "",
      severity: "warning",
      appliesTo: "all"
    });
  }

  if (controlRoom.isLoading) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-sm text-neutral-400">
        Loading project...
      </div>
    );
  }

  if (controlRoom.error || !data || !focus) {
    return (
      <div className="rounded-lg border border-red-900/60 bg-red-950/25 p-6 text-sm text-red-200">
        {controlRoom.error?.message ?? "Project not found."}
      </div>
    );
  }

  const project = data.project;
  const connectedRepository = data.connectedRepository;
  const features = data.features;
  const reports = data.reports;
  const readyToComplete =
    features.length > 0 &&
    features.every((item) => item.report || item.feature.boardStage === "shipped");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/app/projects"
            className="text-sm font-medium text-neutral-400 transition hover:text-white"
          >
            Back to projects
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              {project.name}
            </h1>
            <StatusChip>{formatStatus(project.status)}</StatusChip>
          </div>
          <p className="mt-2 text-sm text-neutral-400">
            {[project.clientName, connectedRepository?.fullName ?? "No repository connected"]
              .filter(Boolean)
              .join(" - ")}
          </p>
        </div>
        <div className="rounded-lg border border-blue-900/50 bg-blue-950/20 p-4 lg:w-80">
          <p className="text-sm font-medium text-blue-300">Project Focus</p>
          <h2 className="mt-2 text-xl font-semibold text-neutral-100">
            {focus.heading}
          </h2>
          <p className="mt-2 text-sm text-neutral-300">{focus.description}</p>
          <FocusAction
            action={focus.action}
            projectId={projectId}
            analyzing={analyzeRepository.isPending}
            onAnalyze={() => analyzeRepository.mutate({ projectId })}
          />
        </div>
      </div>

      {message ? (
        <p className="rounded-md border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Active features" value={data.metrics.activeFeatures} />
        <Metric label="Needs review" value={data.metrics.needsReview} />
        <Metric label="Reports ready" value={data.metrics.reportsReady} />
        <Metric
          label="Repo intelligence"
          value={analysis?.status === "completed" ? "Analyzed" : "Missing"}
        />
      </div>

      <SetupChecklist
        repo={Boolean(connectedRepository)}
        analysis={analysis?.status === "completed"}
        feature={features.length > 0}
        pr={features.some((item) => item.pullRequest)}
      />

      <VerificationRulesSection
        rules={verificationRules.data ?? []}
        isLoading={verificationRules.isLoading}
        error={
          verificationRules.error?.message ??
          createRule.error?.message ??
          updateRule.error?.message ??
          toggleRule.error?.message ??
          deleteRule.error?.message
        }
        draft={ruleDraft}
        setDraft={setRuleDraft}
        editingRuleId={editingRuleId}
        isSaving={createRule.isPending || updateRule.isPending}
        isMutating={toggleRule.isPending || deleteRule.isPending}
        onEdit={(rule) => {
          setEditingRuleId(rule.id);
          setRuleDraft({
            title: rule.title,
            description: rule.description,
            severity: rule.severity,
            appliesTo: rule.appliesTo
          });
        }}
        onCancel={resetRuleDraft}
        onSubmit={() => {
          const payload = {
            title: ruleDraft.title.trim(),
            description: ruleDraft.description.trim(),
            severity: ruleDraft.severity,
            appliesTo: ruleDraft.appliesTo
          };

          if (editingRuleId) {
            updateRule.mutate({
              ruleId: editingRuleId,
              rule: payload
            });
            return;
          }

          createRule.mutate({
            projectId,
            rule: payload
          });
        }}
        onToggle={(ruleId) => toggleRule.mutate({ ruleId })}
        onDelete={(ruleId) => {
          if (window.confirm("Delete this verification rule?")) {
            deleteRule.mutate({ ruleId });
          }
        }}
      />

      <section
        id="repository"
        className="rounded-lg border border-neutral-800 bg-neutral-900 p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-medium text-neutral-100">Repository</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Connect the repository this project ships from, then analyze it
              for repo-aware PRDs, tasks, and QA.
            </p>
          </div>
          <Link
            href="/app/settings/github"
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
          >
            Manage GitHub
          </Link>
        </div>

        {installations.data?.length === 0 ? (
          <div className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-4">
            <p className="text-sm text-neutral-400">
              Connect GitHub before selecting a project repository.
            </p>
            <Link
              href="/app/settings/github"
              className="mt-3 inline-flex rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
            >
              Connect GitHub
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <label className="block text-sm">
              <span className="text-neutral-300">GitHub account/org</span>
              <select
                value={installationIdText}
                onChange={(event) => {
                  setInstallationIdText(event.target.value);
                  setRepositoryId("");
                }}
                className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
              >
                {installations.data?.map((installation) => (
                  <option
                    key={installation.id}
                    value={String(installation.installationId)}
                  >
                    {installation.accountLogin}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-neutral-300">Synced repository</span>
              <select
                value={repositoryId}
                onChange={(event) => setRepositoryId(event.target.value)}
                disabled={repositories.isLoading}
                className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {repositories.isLoading ? "Loading repositories..." : "Select repository"}
                </option>
                {repositories.data?.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.fullName}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => connectRepository.mutate({ projectId, repositoryId })}
                disabled={!canConnect}
                className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {connectRepository.isPending
                  ? "Connecting..."
                  : connectedRepository
                    ? "Change repo"
                    : "Connect repository"}
              </button>
              {connectedRepository ? (
                <button
                  type="button"
                  onClick={() => disconnectRepository.mutate({ projectId })}
                  disabled={disconnectRepository.isPending}
                  className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {disconnectRepository.isPending ? "Disconnecting..." : "Disconnect"}
                </button>
              ) : null}
            </div>
          </div>
        )}

        {connectedRepository ? (
          <div className="mt-5 rounded-md border border-neutral-800 bg-neutral-950 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-medium text-neutral-100">
                  {connectedRepository.fullName}
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  Default branch: {connectedRepository.defaultBranch}
                </p>
              </div>
              <button
                type="button"
                onClick={() => analyzeRepository.mutate({ projectId })}
                disabled={analyzeRepository.isPending}
                className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analyzeRepository.isPending
                  ? "Analyzing..."
                  : analysis?.status === "completed"
                    ? "Re-analyze"
                    : "Analyze repository"}
              </button>
            </div>
            <RepositoryAnalysisSummary analysis={analysis} />
          </div>
        ) : null}

        {repositoryError ? (
          <p className="mt-4 text-sm text-red-300">{repositoryError}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-neutral-100">Features</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Only features assigned to this project appear here.
            </p>
          </div>
          <Link
            href={`/app/features?projectId=${projectId}`}
            className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
          >
            Create feature
          </Link>
        </div>

        {features.length === 0 ? (
          <p className="mt-5 rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
            No features yet. Create the first feature when the project scope is ready.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {features.map((item) => (
              <FeatureCard key={item.feature.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-medium text-neutral-100">Reports</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Reports generated from this project&apos;s features.
        </p>
        {reports.length === 0 ? (
          <p className="mt-5 rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
            No reports generated yet.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={`/reports/${report.shareToken}`}
                target="_blank"
                className="rounded-md border border-neutral-800 bg-neutral-950 p-4 transition hover:border-neutral-600"
              >
                <p className="font-medium text-neutral-100">{report.title}</p>
                <p className="mt-2 text-sm text-neutral-500">
                  {report.status} - readiness {report.readinessScore ?? "n/a"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-medium text-neutral-100">Project actions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {project.status === "completed" ? (
            <button
              type="button"
              onClick={() =>
                updateStatus.mutate({ projectId, status: "active" })
              }
              disabled={updateStatus.isPending}
              className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reopen project
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                updateStatus.mutate({ projectId, status: "completed" })
              }
              disabled={updateStatus.isPending || !readyToComplete}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark completed
            </button>
          )}
          <button
            type="button"
            onClick={() => updateStatus.mutate({ projectId, status: "archived" })}
            disabled={updateStatus.isPending}
            className="rounded-md border border-neutral-800 px-3 py-2 text-sm text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Archive
          </button>
        </div>
        {!readyToComplete && project.status !== "completed" ? (
          <p className="mt-3 text-xs text-neutral-500">
            Completion becomes available after this project has report-ready release work.
          </p>
        ) : null}
      </section>
    </div>
  );
}

async function invalidateProject(
  utils: ReturnType<typeof trpc.useUtils>,
  projectId: string
) {
  await Promise.all([
    utils.projects.list.invalidate(),
    utils.projects.getControlRoom.invalidate({ projectId }),
    utils.guidedWorkflow.getProjectSetup.invalidate({ projectId }),
    utils.dashboard.getSummary.invalidate(),
    utils.releaseBoard.getBoard.invalidate()
  ]);
}

function getProjectFocus(data: ProjectControlRoom) {
  if (data.project.status === "completed") {
    return {
      heading: "Project completed",
      description: "This project is closed for release tracking.",
      action: "view" as const
    };
  }

  if (!data.connectedRepository) {
    return {
      heading: "Finish project setup",
      description: "Connect the GitHub repository this project ships from.",
      action: "connect" as const
    };
  }

  if (data.latestAnalysis?.status !== "completed") {
    return {
      heading: "Analyze repository",
      description: "Build repo intelligence before creating release proof.",
      action: "analyze" as const
    };
  }

  if (data.features.length === 0) {
    return {
      heading: "Create first feature",
      description: "Start the first scoped release workflow for this project.",
      action: "feature" as const
    };
  }

  if (data.metrics.reportsReady > 0 && data.metrics.needsReview === 0) {
    return {
      heading: "Ready to ship",
      description: "Release proof is available for review or sharing.",
      action: "view" as const
    };
  }

  return {
    heading: "Continue release",
    description: "Move active features through PR evidence, QA, approval, and reporting.",
    action: "continue" as const
  };
}

function FocusAction({
  action,
  projectId,
  analyzing,
  onAnalyze
}: {
  action: "connect" | "analyze" | "feature" | "continue" | "view";
  projectId: string;
  analyzing: boolean;
  onAnalyze: () => void;
}) {
  if (action === "analyze") {
    return (
      <button
        type="button"
        onClick={onAnalyze}
        disabled={analyzing}
        className="mt-4 rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {analyzing ? "Analyzing..." : "Analyze repository"}
      </button>
    );
  }

  const href =
    action === "feature"
      ? `/app/features?projectId=${projectId}`
      : action === "connect"
        ? `#repository`
        : `/app/features?projectId=${projectId}`;
  const label =
    action === "feature"
      ? "Create feature"
      : action === "connect"
        ? "Connect repository"
        : "Continue";

  return (
    <Link
      href={href}
      className="mt-4 inline-flex rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
    >
      {label}
    </Link>
  );
}

function SetupChecklist({
  repo,
  analysis,
  feature,
  pr
}: {
  repo: boolean;
  analysis: boolean;
  feature: boolean;
  pr: boolean;
}) {
  const steps = [
    ["Project created", true],
    ["Repository connected", repo],
    ["Repository analyzed", analysis],
    ["Feature created", feature],
    ["PR verification started", pr]
  ] as const;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="text-lg font-medium text-neutral-100">Setup checklist</h2>
      <div className="mt-4 grid gap-2 md:grid-cols-5">
        {steps.map(([label, complete]) => (
          <div
            key={label}
            className="rounded-md border border-neutral-800 bg-neutral-950 p-3"
          >
            <div
              className={
                complete
                  ? "mb-3 h-1.5 rounded-full bg-emerald-400"
                  : "mb-3 h-1.5 rounded-full bg-neutral-800"
              }
            />
            <p className="text-sm text-neutral-300">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function VerificationRulesSection({
  rules,
  isLoading,
  error,
  draft,
  setDraft,
  editingRuleId,
  isSaving,
  isMutating,
  onEdit,
  onCancel,
  onSubmit,
  onToggle,
  onDelete
}: {
  rules: VerificationRule[];
  isLoading: boolean;
  error?: string;
  draft: {
    title: string;
    description: string;
    severity: (typeof ruleSeverityOptions)[number];
    appliesTo: (typeof ruleScopeOptions)[number];
  };
  setDraft: (draft: {
    title: string;
    description: string;
    severity: (typeof ruleSeverityOptions)[number];
    appliesTo: (typeof ruleScopeOptions)[number];
  }) => void;
  editingRuleId: string | null;
  isSaving: boolean;
  isMutating: boolean;
  onEdit: (rule: VerificationRule) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onToggle: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
}) {
  const canSubmit =
    draft.title.trim().length >= 3 &&
    draft.description.trim().length >= 8 &&
    !isSaving;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-medium text-neutral-100">
            Verification Rules
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Project-level rules are included in AI QA Review without consuming
            extra credits.
          </p>
        </div>
        <StatusChip>{rules.filter((rule) => rule.enabled).length} enabled</StatusChip>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1.3fr]">
        <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
          <h3 className="font-medium text-neutral-100">
            {editingRuleId ? "Edit rule" : "Add rule"}
          </h3>
          <label className="mt-4 block text-sm">
            <span className="text-neutral-300">Title</span>
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
              placeholder="Billing changes must include regression tests"
            />
          </label>
          <label className="mt-3 block text-sm">
            <span className="text-neutral-300">Description</span>
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              className="mt-2 min-h-24 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
              placeholder="Explain what QA should check before approval."
            />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-neutral-300">Severity</span>
              <select
                value={draft.severity}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    severity: event.target.value as (typeof ruleSeverityOptions)[number]
                  })
                }
                className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
              >
                {ruleSeverityOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatStatus(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-neutral-300">Applies to</span>
              <select
                value={draft.appliesTo}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    appliesTo: event.target.value as (typeof ruleScopeOptions)[number]
                  })
                }
                className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
              >
                {ruleScopeOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatStatus(option)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving
                ? "Saving..."
                : editingRuleId
                  ? "Save rule"
                  : "Add rule"}
            </button>
            {editingRuleId ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <p className="rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
              Loading verification rules...
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {!isLoading && rules.length === 0 ? (
            <p className="rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
              No rules yet. Add one to make QA stricter and more explainable.
            </p>
          ) : null}
          {rules.map((rule) => (
            <article
              key={rule.id}
              className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusChip>{formatStatus(rule.severity)}</StatusChip>
                    <StatusChip>{formatStatus(rule.appliesTo)}</StatusChip>
                    <StatusChip>{rule.enabled ? "Enabled" : "Disabled"}</StatusChip>
                  </div>
                  <h3 className="mt-3 font-medium text-neutral-100">
                    {rule.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">
                    {rule.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(rule)}
                  className="rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-100 transition hover:border-neutral-500"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onToggle(rule.id)}
                  disabled={isMutating}
                  className="rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {rule.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(rule.id)}
                  disabled={isMutating}
                  className="rounded-md border border-red-900/70 px-3 py-2 text-xs text-red-200 transition hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RepositoryAnalysisSummary({
  analysis
}: {
  analysis: ProjectControlRoom["latestAnalysis"] | undefined | null;
}) {
  if (!analysis) {
    return (
      <p className="mt-4 text-sm text-neutral-500">
        Repository intelligence is missing.
      </p>
    );
  }

  if (analysis.status === "failed") {
    return (
      <p className="mt-4 rounded-md border border-red-900/60 bg-red-950/25 p-3 text-sm text-red-200">
        {analysis.errorMessage ?? "Analysis failed."}
      </p>
    );
  }

  if (analysis.status !== "completed") {
    return <p className="mt-4 text-sm text-neutral-500">Analysis is running.</p>;
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {(analysis.techStack ?? []).slice(0, 10).map((item) => (
          <StatusChip key={item}>{item}</StatusChip>
        ))}
      </div>
      <p className="text-sm leading-6 text-neutral-400">
        {analysis.summary ?? "Repository analysis completed."}
      </p>
      <p className="text-xs text-neutral-500">
        Analyzed {formatDate(analysis.updatedAt)}
      </p>
    </div>
  );
}

function FeatureCard({
  item
}: {
  item: ProjectControlRoom["features"][number];
}) {
  const feature = item.feature;
  const riskChips = [
    item.qaReview?.overallStatus && item.qaReview.overallStatus !== "passed"
      ? item.qaReview.overallStatus
      : null,
    item.approval?.decision === "changes_requested" ? "changes requested" : null
  ].filter(Boolean);

  return (
    <article className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-medium text-neutral-100">{feature.title}</h3>
          <p className="mt-1 text-sm text-neutral-500">
            {feature.status} - board {feature.boardStage}
          </p>
        </div>
        <Link
          href={`/app/features/${feature.id}`}
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
        >
          Open feature
        </Link>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-4">
        <Metric label="PR linked" value={item.pullRequest ? "Yes" : "No"} />
        <Metric
          label="QA verdict"
          value={
            item.qaReview
              ? `${item.qaReview.overallStatus} ${item.qaReview.confidenceScore ?? 0}%`
              : "Missing"
          }
        />
        <Metric
          label="Approval"
          value={item.approval?.decision ?? "Missing"}
        />
        <Metric label="Report" value={item.report ? "Ready" : "Missing"} />
      </div>
      {riskChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {riskChips.map((chip) => (
            <StatusChip key={chip}>{chip}</StatusChip>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-100">{value}</p>
    </div>
  );
}

function StatusChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-700 bg-neutral-950 px-2.5 py-1 text-xs text-neutral-300">
      {children}
    </span>
  );
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatDate(value: Date | string | null) {
  if (!value) return "unknown";
  return new Date(value).toLocaleString();
}
