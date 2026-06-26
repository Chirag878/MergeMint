"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/react";

type UserStory = {
  actor?: unknown;
  want?: unknown;
  benefit?: unknown;
};

type PRDView = {
  id: string;
  title: string;
  problem: string | null;
  goals: string[];
  nonGoals: string[];
  userStories: unknown[];
  edgeCases: string[];
  risks: string[];
  version: number;
};

type AiRunView = {
  id: string;
  agentType: string;
  model: string;
  status: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  } | null;
  error?: string | null;
  createdAt: Date | string;
};

type ApprovalDecision =
  | "approved"
  | "approved_with_risk"
  | "changes_requested"
  | "rejected";

type NextActionKind =
  | "generate_prd"
  | "link_pr"
  | "run_qa_review"
  | "review_risks"
  | "submit_approval"
  | "generate_report"
  | "open_report"
  | "rerun_qa";

type FeatureDetailTab =
  | "overview"
  | "requirements"
  | "pr"
  | "qa"
  | "approval"
  | "report"
  | "timeline"
  | "token_usage";

function getFriendlyQaRunError(message: string | undefined) {
  if (!message) {
    return undefined;
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes("failed query") ||
    normalized.includes("clarification_questions") ||
    normalized.includes("invalid timestamp") ||
    normalized.includes("could not be validated")
  ) {
    return "Your PRD is outdated or could not be validated. Please regenerate the PRD and try again.";
  }

  return message;
}

type ReleaseControlRoomView = {
  feature: {
    title: string;
    status: string;
    priority: string;
  };
  project: {
    id?: string;
    name: string;
    clientId?: string | null;
    clientName: string | null;
  };
  client: {
    name: string;
    companyName: string | null;
    status: string;
  } | null;
  releaseReadinessStatus: string;
  prdMayBeOutdated?: boolean;
  nextBestAction: {
    kind: NextActionKind;
    title: string;
    why: string;
  };
  progress: Array<{
    id: string;
    label: string;
    status: "complete" | "current" | "blocked" | "pending";
    timestamp: Date | string | null;
    blockedReason?: string;
    actionKind?: NextActionKind;
  }>;
  riskSummary: {
    unresolvedFindingsCount: number;
    highCriticalFindingsCount: number;
    partialRequirementsCount: number;
    missingRequirementsCount: number;
    riskyRequirementsCount: number;
    approvalRiskNote: string | null;
    remainingRisks: string[];
  };
  requirementEvidenceSummary: Record<
    "covered" | "partial" | "missing" | "risky" | "notReviewed",
    Array<{
      requirementKey: string;
      requirement: string;
      status: string;
      concern: string | null;
      evidenceSummary: string | null;
    }>
  >;
  prEvidence: {
    pullRequestId: string;
    title: string;
    repo: string | null;
    prNumber: number;
    branch: string;
    baseBranch: string;
    htmlUrl: string;
    changedFilesCount: number;
    additions: number;
    deletions: number;
    ciStatus: string;
    lastSnapshotAt: Date | string | null;
  } | null;
  qaReview: {
    reviewVersion: number;
    readinessScore: number | null;
    confidenceScore: number | null;
    verdict: string;
    summary: string | null;
    createdAt: Date | string;
    topFindings: Array<{
      id: string;
      title: string;
      severity: string;
      status: string;
      requirementKey: string | null;
    }>;
  } | null;
  humanApproval: {
    decision?: ApprovalDecision;
    note?: string | null;
    remainingRisks?: string[];
    createdAt?: Date | string;
    historyCount: number;
    history: Array<{
      id: string;
      decision: ApprovalDecision;
      note: string | null;
      remainingRisks: string[];
      createdAt: Date | string;
    }>;
  };
  releaseReport: {
    title: string;
    status: string;
    shareToken: string;
    readinessScore: number | null;
    generatedAt: Date | string | null;
    createdAt: Date | string;
  } | null;
  timeline: Array<{
    title: string;
    timestamp: Date | string;
    source: "user" | "AI" | "GitHub" | "system";
    description: string;
  }>;
};

const approvalOptions: Array<{
  value: ApprovalDecision;
  label: string;
}> = [
  { value: "approved", label: "Approve" },
  { value: "approved_with_risk", label: "Approve with risk" },
  { value: "changes_requested", label: "Request changes" },
  { value: "rejected", label: "Reject" }
];

const featureDetailTabs: Array<{
  id: FeatureDetailTab;
  label: string;
}> = [
  { id: "overview", label: "Overview" },
  { id: "requirements", label: "Requirements" },
  { id: "pr", label: "PR Evidence" },
  { id: "qa", label: "QA Review" },
  { id: "approval", label: "Approval" },
  { id: "report", label: "Report" },
  { id: "timeline", label: "Timeline" },
  { id: "token_usage", label: "Token Usage" }
];

export function FeatureDetailClient({
  featureRequestId
}: {
  featureRequestId: string;
}) {
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [prUrl, setPrUrl] = useState("");
  const [approvalDecision, setApprovalDecision] =
    useState<ApprovalDecision>("approved");
  const [approvalNote, setApprovalNote] = useState("");
  const [remainingRisks, setRemainingRisks] = useState("");
  const [approvalValidationError, setApprovalValidationError] = useState<
    string | null
  >(null);
  const [showApprovalConfirmation, setShowApprovalConfirmation] =
    useState(false);
  const [activeTab, setActiveTab] = useState<FeatureDetailTab>("overview");
  const utils = trpc.useUtils();
  const featureQuery = trpc.featureRequests.getById.useQuery({
    id: featureRequestId
  });
  const controlRoom = trpc.featureRequests.getReleaseControlRoom.useQuery({
    featureRequestId
  });
  const timelineControlRoom = trpc.featureRequests.getReleaseControlRoom.useQuery(
    {
      featureRequestId,
      includeTimeline: true
    },
    {
      enabled: activeTab === "timeline"
    }
  );
  const workflow = trpc.requirementEngine.getWorkflow.useQuery({
    featureRequestId
  }, {
    enabled: activeTab === "requirements"
  });
  const aiRunUsage = trpc.requirementEngine.getAiRunUsage.useQuery({
    featureRequestId
  }, {
    enabled: activeTab === "token_usage"
  });
  const linkedPullRequest = trpc.github.getFeaturePullRequest.useQuery({
    featureRequestId
  }, {
    enabled: activeTab === "pr" || activeTab === "qa"
  });
  const latestQaReview = trpc.qaReview.getLatest.useQuery({
    featureRequestId
  }, {
    enabled:
      activeTab === "qa" ||
      activeTab === "approval" ||
      activeTab === "report"
  });
  const latestApproval = trpc.approval.getLatest.useQuery({
    featureRequestId
  }, {
    enabled: activeTab === "approval" || activeTab === "report"
  });
  const latestClientDeliveryReport = trpc.releaseReport.getLatestForFeature.useQuery({
    featureRequestId,
    reportType: "client_delivery"
  }, {
    enabled: activeTab === "report"
  });
  const latestDeveloperFixReport = trpc.releaseReport.getLatestForFeature.useQuery({
    featureRequestId,
    reportType: "developer_fix"
  }, {
    enabled: activeTab === "report"
  });
  const latestInternalReleaseReport = trpc.releaseReport.getLatestForFeature.useQuery({
    featureRequestId,
    reportType: "internal_release"
  }, {
    enabled: activeTab === "report"
  });
  const invalidateReleaseControlRoom = async () => {
    await utils.featureRequests.getReleaseControlRoom.invalidate({
      featureRequestId
    });
  };
  const generateClarifications =
    trpc.requirementEngine.generateClarifications.useMutation({
      onSuccess: async () => {
        await utils.requirementEngine.getWorkflow.invalidate({ featureRequestId });
        await invalidateReleaseControlRoom();
      }
    });
  const generatePrd = trpc.requirementEngine.generatePrd.useMutation({
    onSuccess: async () => {
      await utils.requirementEngine.getWorkflow.invalidate({ featureRequestId });
      await invalidateReleaseControlRoom();
    }
  });
  const generateTasks =
    trpc.requirementEngine.generateEngineeringTasks.useMutation({
      onSuccess: async () => {
        await utils.requirementEngine.getWorkflow.invalidate({ featureRequestId });
        await invalidateReleaseControlRoom();
      }
    });
  const answerClarification =
    trpc.requirementEngine.answerClarification.useMutation({
      onSuccess: async (_data, variables) => {
        setAnswerDrafts((current) => {
          const next = { ...current };
          delete next[variables.questionId];
          return next;
        });
        setEditingQuestionId((current) =>
          current === variables.questionId ? null : current
        );
        await utils.requirementEngine.getWorkflow.invalidate({ featureRequestId });
        await invalidateReleaseControlRoom();
      }
    });
  const linkPullRequest = trpc.github.linkPullRequest.useMutation({
    onSuccess: async () => {
      setPrUrl("");
      await utils.github.getFeaturePullRequest.invalidate({ featureRequestId });
      await utils.requirementEngine.getWorkflow.invalidate({ featureRequestId });
      await invalidateReleaseControlRoom();
    }
  });
  const refreshSnapshot = trpc.github.refreshSnapshot.useMutation({
    onSuccess: async () => {
      await utils.github.getFeaturePullRequest.invalidate({ featureRequestId });
      await invalidateReleaseControlRoom();
    }
  });
  const runQaReview = trpc.qaReview.run.useMutation({
    onSuccess: async () => {
      await utils.qaReview.getLatest.invalidate({ featureRequestId });
      await utils.requirementEngine.getWorkflow.invalidate({ featureRequestId });
      await invalidateReleaseControlRoom();
    }
  });
  const createApproval = trpc.approval.createDecision.useMutation({
    onSuccess: async () => {
      setApprovalNote("");
      setRemainingRisks("");
      setApprovalValidationError(null);
      setShowApprovalConfirmation(false);
      await utils.approval.getLatest.invalidate({ featureRequestId });
      await utils.requirementEngine.getWorkflow.invalidate({ featureRequestId });
      await invalidateReleaseControlRoom();
    }
  });
  const generateReleaseReport = trpc.releaseReport.generate.useMutation({
    onSuccess: async () => {
      await utils.releaseReport.getLatestForFeature.invalidate({
        featureRequestId,
        reportType: "client_delivery"
      });
      await invalidateReleaseControlRoom();
    }
  });
  const generateDeveloperFixReport =
    trpc.releaseReport.generateDeveloperFix.useMutation({
      onSuccess: async () => {
        await utils.releaseReport.getLatestForFeature.invalidate({
          featureRequestId,
          reportType: "developer_fix"
        });
        await invalidateReleaseControlRoom();
      }
    });
  const generateInternalReleaseReport =
    trpc.releaseReport.generateInternalRelease.useMutation({
      onSuccess: async () => {
        await utils.releaseReport.getLatestForFeature.invalidate({
          featureRequestId,
          reportType: "internal_release"
        });
        await invalidateReleaseControlRoom();
      }
    });

  const feature = featureQuery.data ?? workflow.data?.featureRequest;
  const clarificationQuestions =
    workflow.data?.clarificationQuestions ?? workflow.data?.questions ?? [];
  const unansweredRequiredClarificationQuestions =
    workflow.data?.unansweredRequiredClarificationQuestions ??
    clarificationQuestions.filter(
      (question) => isRequiredQuestionPriority(question.priority) && !question.answer
    );
  const prd = workflow.data?.prd ?? workflow.data?.prds[0] ?? null;
  const prdRequirements =
    workflow.data?.prdRequirements ?? workflow.data?.requirements ?? [];
  const engineeringTasks =
    workflow.data?.engineeringTasks ?? workflow.data?.tasks ?? [];
  const latestAiRuns = aiRunUsage.data ?? [];

  const hasQuestions = clarificationQuestions.length > 0;
  const hasPrd = Boolean(prd);
  const hasTasks = engineeringTasks.length > 0;
  const prdMayBeOutdated =
    controlRoom.data?.prdMayBeOutdated ?? workflow.data?.prdMayBeOutdated ?? false;
  const projectHasClient = Boolean(
    controlRoom.data?.client ||
      controlRoom.data?.project.clientId ||
      controlRoom.data?.project.clientName
  );
  const prdBlockedByClarifications =
    !hasPrd && unansweredRequiredClarificationQuestions.length > 0;

  function setAnswerDraft(questionId: string, value: string) {
    setAnswerDrafts((current) => ({
      ...current,
      [questionId]: value
    }));
  }

  function saveAnswer(questionId: string) {
    const answer = answerDrafts[questionId]?.trim();

    if (!answer) {
      return;
    }

    answerClarification.mutate({
      questionId,
      answer
    });
  }

  function editAnswer(questionId: string, answer: string) {
    setEditingQuestionId(questionId);
    setAnswerDraft(questionId, answer);
  }

  function cancelEditAnswer(questionId: string) {
    setEditingQuestionId((current) => (current === questionId ? null : current));
    setAnswerDrafts((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  }

  function openTab(tab: FeatureDetailTab, sectionId?: string) {
    setActiveTab(tab);

    if (!sectionId) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 0);
    });
  }

  function submitApprovalDecision() {
    if (prdMayBeOutdated) {
      setApprovalValidationError(
        "Regenerate the PRD and rerun QA before submitting approval."
      );
      return;
    }

    const note = approvalNote.trim();
    const parsedRemainingRisks = parseRemainingRisks(remainingRisks);
    const riskSummary = getApprovalRiskSummary(latestQaReview.data);
    const validationError = validateApprovalDecision({
      decision: approvalDecision,
      note,
      remainingRisks: parsedRemainingRisks,
      riskSummary
    });

    if (validationError) {
      setApprovalValidationError(validationError);
      setShowApprovalConfirmation(false);
      return;
    }

    if (
      approvalDecision === "approved" &&
      riskSummary.hasUnresolvedRisk &&
      !showApprovalConfirmation
    ) {
      setApprovalValidationError(null);
      setShowApprovalConfirmation(true);
      return;
    }

    setApprovalValidationError(null);
    setShowApprovalConfirmation(false);
    createApproval.mutate({
      featureRequestId,
      decision: approvalDecision,
      note: note || undefined,
      remainingRisks: parsedRemainingRisks
    });
  }

  if (featureQuery.isLoading) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-400">
        Loading feature...
      </div>
    );
  }

  if (featureQuery.error || !feature) {
    return (
      <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-5">
        <p className="text-sm text-red-200">
          {featureQuery.error?.message ?? "Feature request not found."}
        </p>
        <Link
          href="/app/features"
          className="mt-4 inline-flex rounded-md border border-red-800 px-3 py-2 text-sm text-red-100"
        >
          Back to features
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app/features" className="text-sm text-neutral-500">
            Back to features
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            {feature.title}
          </h1>
          <p className="mt-3 max-w-3xl text-neutral-400">
            {feature.description}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge>{feature.priority}</Badge>
          <Badge>{feature.status}</Badge>
        </div>
      </div>

      {controlRoom.isLoading ? (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-400">
          Loading release control room...
        </section>
      ) : null}

      {controlRoom.error ? (
        <section className="rounded-lg border border-red-900/60 bg-red-950/30 p-5 text-sm text-red-200">
          {controlRoom.error.message}
        </section>
      ) : null}

      {controlRoom.data ? (
          <ReleaseControlRoom
            data={controlRoom.data}
            prdMayBeOutdated={prdMayBeOutdated}
            onGeneratePrd={() => {
              openTab("requirements", "requirement-engine-section");
              generatePrd.mutate({ featureRequestId: feature.id });
          }}
          isGeneratingPrd={generatePrd.isPending}
          onLinkPr={() => openTab("pr", "github-pr-section")}
          onRunQa={() => {
            openTab("qa", "ai-qa-review");
            if (!prdMayBeOutdated) {
              runQaReview.mutate({ featureRequestId });
            }
          }}
          isRunningQa={runQaReview.isPending}
          onSubmitApproval={() => openTab("approval", "human-approval")}
          onGenerateReport={() => {
            openTab("report", "release-report");
            if (!prdMayBeOutdated) {
              if (projectHasClient) {
                generateReleaseReport.mutate({ featureRequestId });
              } else {
                generateInternalReleaseReport.mutate({ featureRequestId });
              }
            }
          }}
          isGeneratingReport={
            generateReleaseReport.isPending || generateInternalReleaseReport.isPending
          }
        />
      ) : null}

      <FeatureDetailTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" ? (
        <section
          id="feature-overview-section"
          className="space-y-4 scroll-mt-28"
        >
      <div className="grid gap-4 md:grid-cols-2">
        <DetailBlock title="Business goal" value={feature.businessGoal} />
        <DetailBlock
          title="Expected behavior"
          value={feature.expectedBehavior}
        />
      </div>

      <section
        id="acceptance-criteria-section"
        className="scroll-mt-28 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
      >
        <h2 className="text-lg font-medium">Acceptance criteria</h2>
        <StringList
          items={feature.acceptanceCriteria}
          emptyText="No acceptance criteria captured yet."
        />
      </section>
        </section>
      ) : null}

      {activeTab === "requirements" ? (
        <section
          id="requirements-section"
          className="space-y-4 scroll-mt-28"
        >
      <section
        id="requirement-engine-section"
        className="scroll-mt-28 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Requirement engine</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Generated artifacts stay idempotent and are shown below.
            </p>
          </div>
          {latestAiRuns[0] ? (
            <span className="rounded-full border border-blue-900/70 bg-blue-950/30 px-3 py-1 text-xs text-blue-200">
              Latest AI: {latestAiRuns[0].model}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              generateClarifications.mutate({ featureRequestId: feature.id })
            }
            disabled={hasQuestions || generateClarifications.isPending}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {hasQuestions
              ? "Clarifications generated"
              : generateClarifications.isPending
                ? "Generating..."
                : "Generate clarification questions"}
          </button>
          <button
            type="button"
            onClick={() => generatePrd.mutate({ featureRequestId: feature.id })}
            disabled={
              (hasPrd && !prdMayBeOutdated) ||
              prdBlockedByClarifications ||
              generatePrd.isPending
            }
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {hasPrd
              ? prdMayBeOutdated
                ? "Regenerate PRD"
                : "PRD generated"
              : prdBlockedByClarifications
                ? "Answer required questions"
              : generatePrd.isPending
                ? "Generating..."
                : "Generate PRD"}
          </button>
          <button
            type="button"
            onClick={() => (prd ? generateTasks.mutate({ prdId: prd.id }) : null)}
            disabled={!prd || prdMayBeOutdated || hasTasks || generateTasks.isPending}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {hasTasks
              ? "Tasks generated"
              : generateTasks.isPending
                ? "Generating..."
                : "Generate engineering tasks"}
          </button>
        </div>

        {generateClarifications.error || generatePrd.error || generateTasks.error ? (
          <p className="mt-4 text-sm text-red-300">
            {generateClarifications.error?.message ??
              generatePrd.error?.message ??
              generateTasks.error?.message}
          </p>
        ) : null}

        {prdMayBeOutdated ? (
          <p className="mt-4 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
            PRD may be outdated because a clarification answer changed. Regenerate
            the PRD before running QA or generating release evidence.
          </p>
        ) : prdBlockedByClarifications ? (
          <p className="mt-4 text-sm text-amber-300">
            Answer required clarification questions before generating the PRD.
          </p>
        ) : hasPrd || hasTasks ? (
          <p className="mt-4 text-sm text-neutral-500">
            Create a new feature request to generate a fresh PRD, or enable
            regeneration later.
          </p>
        ) : null}
      </section>

      <section
        id="clarifications-section"
        className="scroll-mt-28 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
      >
        <h2 className="text-lg font-medium">Clarification questions</h2>
        {clarificationQuestions.length > 0 ? (
          <div className="mt-4 space-y-3">
            {clarificationQuestions.map((question) => {
              const isEditing = editingQuestionId === question.id;
              const isSavingQuestion =
                answerClarification.isPending &&
                answerClarification.variables?.questionId === question.id;
              const draft = answerDrafts[question.id] ?? "";
              const canSave = draft.trim().length > 0 && !isSavingQuestion;

              return (
                <article
                  key={question.id}
                  className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-medium text-neutral-100">
                      {question.question}
                    </h3>
                    <Badge>{formatQuestionPriority(question.priority)}</Badge>
                  </div>
                  {question.reason ? (
                    <p className="mt-3 text-sm text-neutral-400">
                      <span className="text-neutral-500">Reason:</span>{" "}
                      {question.reason}
                    </p>
                  ) : null}
                  {question.answer && !isEditing ? (
                    <div className="mt-3 space-y-3 rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3">
                      <p className="text-sm text-emerald-100">
                        <span className="text-emerald-400">Answered:</span>{" "}
                        {question.answer}
                      </p>
                      <button
                        type="button"
                        onClick={() => editAnswer(question.id, question.answer ?? "")}
                        disabled={answerClarification.isPending}
                        className="rounded-md border border-emerald-800 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {isRequiredQuestionPriority(question.priority) ? (
                        <p className="text-sm text-amber-300">
                          Required before PRD generation.
                        </p>
                      ) : null}
                      {isEditing && prd ? (
                        <p className="rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
                          Changing this answer will mark the current PRD as
                          outdated until you regenerate it.
                        </p>
                      ) : null}
                      <textarea
                        value={draft}
                        onChange={(event) =>
                          setAnswerDraft(question.id, event.target.value)
                        }
                        className="min-h-24 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-blue-500"
                        placeholder="Answer this clarification..."
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => saveAnswer(question.id)}
                          disabled={!canSave}
                          className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingQuestion
                            ? "Saving..."
                            : isEditing
                              ? "Save changes"
                              : "Save answer"}
                        </button>
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => cancelEditAnswer(question.id)}
                            disabled={isSavingQuestion}
                            className="rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                      {answerClarification.error &&
                      answerClarification.variables?.questionId === question.id ? (
                        <p className="text-sm text-red-300">
                          {answerClarification.error.message}
                        </p>
                      ) : null}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyText>No clarification questions generated yet.</EmptyText>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-medium">PRD</h2>
        {prd ? (
          <div className="mt-4 space-y-5">
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-neutral-100">{prd.title}</h3>
                  <p className="mt-2 text-sm text-neutral-400">
                    {prd.problem || "No problem statement."}
                  </p>
                </div>
                <Badge>v{prd.version}</Badge>
              </div>
            </div>

            <PRDLists prd={prd} />
          </div>
        ) : (
          <EmptyText>No PRD generated yet.</EmptyText>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-medium">Requirements</h2>
        {prdRequirements.length > 0 ? (
          <div className="mt-4 space-y-3">
            {prdRequirements.map((requirement) => (
              <article
                key={requirement.id}
                className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-blue-300">
                      {requirement.requirementKey}
                    </p>
                    <h3 className="mt-1 font-medium text-neutral-100">
                      {requirement.requirement}
                    </h3>
                  </div>
                  <Badge>{requirement.priority}</Badge>
                </div>
                <StringList
                  title="Acceptance criteria"
                  items={requirement.acceptanceCriteria}
                  emptyText="No acceptance criteria."
                />
              </article>
            ))}
          </div>
        ) : (
          <EmptyText>No requirements generated yet.</EmptyText>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-medium">Engineering tasks</h2>
        {engineeringTasks.length > 0 ? (
          <div className="mt-4 space-y-3">
            {engineeringTasks.map((task) => (
              <article
                key={task.id}
                className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-neutral-100">{task.title}</h3>
                    <p className="mt-2 text-sm text-neutral-400">
                      {task.description || "No description."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{task.type}</Badge>
                    <Badge>{task.complexity}</Badge>
                  </div>
                </div>
                <StringList
                  title="Related requirements"
                  items={task.relatedRequirementKeys}
                  emptyText="No related requirements."
                />
                <StringList
                  title="Acceptance checklist"
                  items={task.acceptanceChecklist}
                  emptyText="No acceptance checklist."
                />
              </article>
            ))}
          </div>
        ) : (
          <EmptyText>No engineering tasks generated yet.</EmptyText>
        )}
      </section>
        </section>
      ) : null}

      {activeTab === "pr" ? (
      <GitHubPullRequestSection
        data={linkedPullRequest.data}
        isLoading={linkedPullRequest.isLoading}
        error={linkedPullRequest.error?.message}
        prUrl={prUrl}
        setPrUrl={setPrUrl}
        onLink={() =>
          linkPullRequest.mutate({
            featureRequestId,
            prUrl
          })
        }
        isLinking={linkPullRequest.isPending}
        linkError={linkPullRequest.error?.message}
        onRefresh={(pullRequestId) =>
          refreshSnapshot.mutate({
            pullRequestId
          })
        }
        isRefreshing={refreshSnapshot.isPending}
        refreshError={refreshSnapshot.error?.message}
      />
      ) : null}

      {activeTab === "qa" ? (
      <AIQAReviewSection
        hasPrd={Boolean(prd)}
        prdMayBeOutdated={prdMayBeOutdated}
        requirementsCount={prdRequirements.length}
        hasPullRequestSnapshot={Boolean(linkedPullRequest.data?.latestSnapshot)}
        reviewBundle={latestQaReview.data}
        isLoading={latestQaReview.isLoading}
        error={latestQaReview.error?.message}
        onRun={() => runQaReview.mutate({ featureRequestId })}
        isRunning={runQaReview.isPending}
        runError={getFriendlyQaRunError(runQaReview.error?.message)}
      />
      ) : null}

      {activeTab === "approval" ? (
      <HumanApprovalGateSection
        latestQaReview={latestQaReview.data}
        prdMayBeOutdated={prdMayBeOutdated}
        latestApproval={latestApproval.data}
        isLoadingApproval={latestApproval.isLoading}
        approvalError={latestApproval.error?.message}
        decision={approvalDecision}
        setDecision={(decision) => {
          setApprovalDecision(decision);
          setApprovalValidationError(null);
          setShowApprovalConfirmation(false);
        }}
        note={approvalNote}
        setNote={(note) => {
          setApprovalNote(note);
          setApprovalValidationError(null);
        }}
        remainingRisks={remainingRisks}
        setRemainingRisks={(risks) => {
          setRemainingRisks(risks);
          setApprovalValidationError(null);
        }}
        onSubmit={submitApprovalDecision}
        isSubmitting={createApproval.isPending}
        submitError={createApproval.error?.message}
        validationError={approvalValidationError}
        confirmationVisible={showApprovalConfirmation}
        onCancelConfirmation={() => setShowApprovalConfirmation(false)}
      />
      ) : null}

      {activeTab === "report" ? (
      <ReleaseReportSection
        latestQaReview={latestQaReview.data}
        prdMayBeOutdated={prdMayBeOutdated}
        latestApproval={latestApproval.data}
        projectHasClient={projectHasClient}
        latestClientReport={latestClientDeliveryReport.data}
        latestDeveloperFixReport={latestDeveloperFixReport.data}
        latestInternalReport={latestInternalReleaseReport.data}
        isLoadingReport={
          latestClientDeliveryReport.isLoading ||
          latestDeveloperFixReport.isLoading ||
          latestInternalReleaseReport.isLoading
        }
        reportError={
          latestClientDeliveryReport.error?.message ??
          latestDeveloperFixReport.error?.message ??
          latestInternalReleaseReport.error?.message
        }
        onGenerateClientReport={() =>
          generateReleaseReport.mutate({ featureRequestId })
        }
        onGenerateDeveloperFixReport={() =>
          generateDeveloperFixReport.mutate({ featureRequestId })
        }
        onGenerateInternalReport={() =>
          generateInternalReleaseReport.mutate({ featureRequestId })
        }
        isGeneratingClientReport={generateReleaseReport.isPending}
        isGeneratingDeveloperFixReport={generateDeveloperFixReport.isPending}
        isGeneratingInternalReport={generateInternalReleaseReport.isPending}
        clientGenerateError={generateReleaseReport.error?.message}
        developerGenerateError={generateDeveloperFixReport.error?.message}
        internalGenerateError={generateInternalReleaseReport.error?.message}
      />
      ) : null}

      {activeTab === "timeline" && timelineControlRoom.isLoading ? (
        <SectionSkeleton title="Loading timeline..." />
      ) : null}

      {activeTab === "timeline" && timelineControlRoom.data ? (
        <TrustTimeline timeline={timelineControlRoom.data.timeline} />
      ) : null}

      {activeTab === "token_usage" && aiRunUsage.isLoading ? (
        <SectionSkeleton title="Loading token usage..." />
      ) : null}

      {activeTab === "token_usage" && !aiRunUsage.isLoading ? (
        <AiRunUsage runs={latestAiRuns} />
      ) : null}
    </>
  );
}

function DetailBlock({
  title,
  value
}: {
  title: string;
  value?: string | null;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-3 text-sm text-neutral-400">
        {value || "Not specified."}
      </p>
    </section>
  );
}

function FeatureDetailTabs({
  activeTab,
  onChange
}: {
  activeTab: FeatureDetailTab;
  onChange: (tab: FeatureDetailTab) => void;
}) {
  return (
    <nav className="sticky top-20 z-30 -mx-1 flex gap-2 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950/90 p-2 backdrop-blur">
      {featureDetailTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={
            activeTab === tab.id
              ? "whitespace-nowrap rounded-md border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-100"
              : "whitespace-nowrap rounded-md border border-transparent px-3 py-2 text-sm font-semibold text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-100"
          }
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function ReleaseControlRoom({
  data,
  prdMayBeOutdated,
  onGeneratePrd,
  isGeneratingPrd,
  onLinkPr,
  onRunQa,
  isRunningQa,
  onSubmitApproval,
  onGenerateReport,
  isGeneratingReport
}: {
  data: ReleaseControlRoomView;
  prdMayBeOutdated: boolean;
  onGeneratePrd: () => void;
  isGeneratingPrd: boolean;
  onLinkPr: () => void;
  onRunQa: () => void;
  isRunningQa: boolean;
  onSubmitApproval: () => void;
  onGenerateReport: () => void;
  isGeneratingReport: boolean;
}) {
  const clientName =
    data.client?.companyName ?? data.client?.name ?? data.project.clientName;
  const reportHref = data.releaseReport
    ? `/reports/${data.releaseReport.shareToken}`
    : undefined;
  const prdStep = data.progress.find((step) => step.id === "prd");

  return (
    <section className="space-y-5 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-blue-400">
            Release Control Room
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-100">
            {data.feature.title}
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            {data.project.name}
            {clientName ? ` - ${clientName}` : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{data.feature.status}</Badge>
            <StatusBadge status={data.releaseReadinessStatus} />
            <Badge>{data.feature.priority}</Badge>
          </div>
        </div>
        <PrimaryControlRoomAction
          action={data.nextBestAction.kind}
          reportHref={reportHref}
          prdBlocked={prdStep?.status === "blocked"}
          prdMayBeOutdated={prdMayBeOutdated}
          onGeneratePrd={onGeneratePrd}
          isGeneratingPrd={isGeneratingPrd}
          onLinkPr={onLinkPr}
          onRunQa={onRunQa}
          isRunningQa={isRunningQa}
          onSubmitApproval={onSubmitApproval}
          onGenerateReport={onGenerateReport}
          isGeneratingReport={isGeneratingReport}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          <h3 className="text-base font-medium text-neutral-100">
            Workflow Progress
          </h3>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {data.progress.map((step) => (
              <article
                key={step.id}
                className="rounded-md border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-neutral-100">{step.label}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {step.timestamp ? formatDate(step.timestamp) : "Not yet"}
                    </p>
                  </div>
                  <WorkflowStatusBadge status={step.status} />
                </div>
                {step.blockedReason ? (
                  <p className="mt-3 text-sm text-amber-300">
                    {step.blockedReason}
                  </p>
                ) : null}
                {step.actionKind ? (
                  <div className="mt-3">
                    <InlineControlRoomAction
                      action={step.actionKind}
                      reportHref={reportHref}
                      prdMayBeOutdated={prdMayBeOutdated}
                      onGeneratePrd={onGeneratePrd}
                      isGeneratingPrd={isGeneratingPrd}
                      onLinkPr={onLinkPr}
                      onRunQa={onRunQa}
                      isRunningQa={isRunningQa}
                      onSubmitApproval={onSubmitApproval}
                      onGenerateReport={onGenerateReport}
                      isGeneratingReport={isGeneratingReport}
                    />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-blue-900/50 bg-blue-950/20 p-4">
          <p className="text-sm text-blue-300">Next Best Action</p>
          <h3 className="mt-2 text-xl font-semibold text-neutral-100">
            {data.nextBestAction.title}
          </h3>
          <p className="mt-3 text-sm leading-6 text-neutral-300">
            {data.nextBestAction.why}
          </p>
          <div className="mt-5">
            <PrimaryControlRoomAction
              action={data.nextBestAction.kind}
              reportHref={reportHref}
              prdBlocked={prdStep?.status === "blocked"}
              prdMayBeOutdated={prdMayBeOutdated}
              onGeneratePrd={onGeneratePrd}
              isGeneratingPrd={isGeneratingPrd}
              onLinkPr={onLinkPr}
              onRunQa={onRunQa}
              isRunningQa={isRunningQa}
              onSubmitApproval={onSubmitApproval}
              onGenerateReport={onGenerateReport}
              isGeneratingReport={isGeneratingReport}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RiskSummaryPanel riskSummary={data.riskSummary} />
        <RequirementEvidencePanel summary={data.requirementEvidenceSummary} />
      </div>

    </section>
  );
}

function PrimaryControlRoomAction({
  action,
  reportHref,
  prdBlocked,
  prdMayBeOutdated,
  variant = "primary",
  onGeneratePrd,
  isGeneratingPrd,
  onLinkPr,
  onRunQa,
  isRunningQa,
  onSubmitApproval,
  onGenerateReport,
  isGeneratingReport
}: {
  action: NextActionKind;
  reportHref?: string;
  prdBlocked?: boolean;
  prdMayBeOutdated?: boolean;
  variant?: "primary" | "subtle";
  onGeneratePrd: () => void;
  isGeneratingPrd: boolean;
  onLinkPr: () => void;
  onRunQa: () => void;
  isRunningQa: boolean;
  onSubmitApproval: () => void;
  onGenerateReport: () => void;
  isGeneratingReport: boolean;
}) {
  const buttonClass =
    variant === "primary"
      ? "inline-flex rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      : "inline-flex rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

  if (action === "open_report" && reportHref) {
    return (
      <Link
        href={reportHref}
        target="_blank"
        className={buttonClass}
      >
        Open public report
      </Link>
    );
  }

  if (action === "generate_prd") {
    return prdBlocked && !prdMayBeOutdated ? (
      <button
        type="button"
        onClick={() =>
          document.getElementById("requirement-engine-section")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          })
        }
        className={buttonClass}
      >
        Review clarifications
      </button>
    ) : (
      <button
        type="button"
        onClick={onGeneratePrd}
        disabled={isGeneratingPrd}
        className={buttonClass}
      >
        {isGeneratingPrd
          ? "Generating..."
          : prdMayBeOutdated
            ? "Regenerate PRD"
            : "Generate PRD"}
      </button>
    );
  }

  if (action === "link_pr") {
    return (
      <button type="button" onClick={onLinkPr} className={buttonClass}>
        Link GitHub PR
      </button>
    );
  }

  if (action === "run_qa_review" || action === "rerun_qa") {
    return (
      <button
        type="button"
        onClick={onRunQa}
        disabled={isRunningQa || prdMayBeOutdated}
        className={buttonClass}
      >
        {isRunningQa
          ? "Running..."
          : action === "rerun_qa"
            ? "Re-run QA"
            : "Run AI QA Review"}
      </button>
    );
  }

  if (action === "review_risks") {
    return (
      <button
        type="button"
        onClick={() =>
          document.getElementById("risk-summary")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          })
        }
        className={buttonClass}
      >
        Review risks
      </button>
    );
  }

  if (action === "submit_approval") {
    return (
      <button
        type="button"
        onClick={onSubmitApproval}
        disabled={prdMayBeOutdated}
        className={buttonClass}
      >
        Submit approval decision
      </button>
    );
  }

  return (
    <button
      type="button"
    onClick={onGenerateReport}
    disabled={isGeneratingReport || prdMayBeOutdated}
      className={buttonClass}
    >
      {isGeneratingReport ? "Generating..." : "Generate release report"}
    </button>
  );
}

function InlineControlRoomAction(
  props: Parameters<typeof PrimaryControlRoomAction>[0]
) {
  return <PrimaryControlRoomAction {...props} variant="subtle" />;
}

function WorkflowStatusBadge({
  status
}: {
  status: "complete" | "current" | "blocked" | "pending";
}) {
  const classes =
    status === "complete"
      ? "border-emerald-800 bg-emerald-950/30 text-emerald-200"
      : status === "current"
        ? "border-blue-800 bg-blue-950/30 text-blue-200"
        : status === "blocked"
          ? "border-red-800 bg-red-950/30 text-red-200"
          : "border-neutral-700 text-neutral-400";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${classes}`}>
      {status}
    </span>
  );
}

function RiskSummaryPanel({
  riskSummary
}: {
  riskSummary: ReleaseControlRoomView["riskSummary"];
}) {
  return (
    <section
      id="risk-summary"
      className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"
    >
      <h3 className="text-base font-medium text-neutral-100">Risk Summary</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniMetric
          label="Unresolved findings"
          value={riskSummary.unresolvedFindingsCount}
        />
        <MiniMetric
          label="High/critical findings"
          value={riskSummary.highCriticalFindingsCount}
          tone={riskSummary.highCriticalFindingsCount > 0 ? "red" : "neutral"}
        />
        <MiniMetric
          label="Partial requirements"
          value={riskSummary.partialRequirementsCount}
          tone={riskSummary.partialRequirementsCount > 0 ? "amber" : "neutral"}
        />
        <MiniMetric
          label="Missing requirements"
          value={riskSummary.missingRequirementsCount}
          tone={riskSummary.missingRequirementsCount > 0 ? "red" : "neutral"}
        />
      </div>
      {riskSummary.approvalRiskNote ? (
        <p className="mt-4 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-100">
          Approval risk note: {riskSummary.approvalRiskNote}
        </p>
      ) : null}
      <StringList
        title="Remaining risks"
        items={riskSummary.remainingRisks}
        emptyText="No remaining risks recorded."
      />
    </section>
  );
}

function MiniMetric({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "amber" | "red";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-300"
      : tone === "amber"
        ? "text-amber-300"
        : "text-neutral-100";

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function RequirementEvidencePanel({
  summary
}: {
  summary: ReleaseControlRoomView["requirementEvidenceSummary"];
}) {
  const groups = [
    ["Covered", summary.covered],
    ["Partial", summary.partial],
    ["Missing", summary.missing],
    ["Risky", summary.risky],
    ["Not reviewed", summary.notReviewed]
  ] as const;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <h3 className="text-base font-medium text-neutral-100">
        Requirement Evidence Summary
      </h3>
      <div className="mt-4 space-y-4">
        {groups.map(([label, items]) => (
          <div key={label}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-neutral-200">{label}</p>
              <Badge>{items.length}</Badge>
            </div>
            {items.length > 0 ? (
              <div className="mt-2 space-y-2">
                {items.map((item) => (
                  <article
                    key={`${label}-${item.requirementKey}`}
                    className="rounded-md border border-neutral-800 bg-neutral-900 p-3"
                  >
                    <p className="text-sm font-medium text-blue-300">
                      {item.requirementKey}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-300">
                      {item.requirement}
                    </p>
                    {item.concern ? (
                      <p className="mt-2 text-xs text-amber-300">
                        {item.concern}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">None.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function PREvidencePanel({
  evidence,
  onLinkPr,
  onRefreshSnapshot,
  isRefreshingSnapshot
}: {
  evidence: ReleaseControlRoomView["prEvidence"];
  onLinkPr: () => void;
  onRefreshSnapshot: (pullRequestId: string) => void;
  isRefreshingSnapshot: boolean;
}) {
  return (
    <section
      id="trust-timeline-section"
      className="scroll-mt-28 rounded-lg border border-neutral-800 bg-neutral-950 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-medium text-neutral-100">PR Evidence</h3>
        {evidence ? <StatusBadge status={evidence.ciStatus} /> : null}
      </div>
      {evidence ? (
        <div className="mt-4 space-y-3">
          <div>
            <p className="font-medium text-neutral-100">{evidence.title}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {evidence.repo ?? "Repository"} #{evidence.prNumber}
            </p>
          </div>
          <div className="grid gap-2 text-sm text-neutral-400 sm:grid-cols-2">
            <p>
              Branch: {evidence.branch} {"->"} {evidence.baseBranch}
            </p>
            <p>Changed files: {evidence.changedFilesCount}</p>
            <p>Additions: {evidence.additions}</p>
            <p>Deletions: {evidence.deletions}</p>
            <p className="sm:col-span-2">
              Last snapshot:{" "}
              {evidence.lastSnapshotAt
                ? formatDate(evidence.lastSnapshotAt)
                : "Not captured"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={evidence.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
            >
              Open on GitHub
            </a>
            <button
              type="button"
              onClick={() => onRefreshSnapshot(evidence.pullRequestId)}
              disabled={isRefreshingSnapshot}
              className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRefreshingSnapshot ? "Refreshing..." : "Refresh snapshot"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-neutral-500">
            No GitHub pull request is linked yet.
          </p>
          <button
            type="button"
            onClick={onLinkPr}
            className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
          >
            Link PR
          </button>
        </div>
      )}
    </section>
  );
}

function AIQAReviewPanel({
  review,
  canRunQa,
  onRunQa,
  isRunningQa
}: {
  review: ReleaseControlRoomView["qaReview"];
  canRunQa: boolean;
  onRunQa: () => void;
  isRunningQa: boolean;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-medium text-neutral-100">AI QA Review</h3>
        <button
          type="button"
          onClick={onRunQa}
          disabled={!canRunQa || isRunningQa}
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunningQa ? "Running..." : review ? "Re-run review" : "Run review"}
        </button>
      </div>
      {review ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={review.verdict} />
            <Badge>v{review.reviewVersion}</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <MiniMetric
              label="Readiness score"
              value={review.readinessScore ?? 0}
            />
            <MiniMetric
              label="Confidence score"
              value={review.confidenceScore ?? 0}
            />
          </div>
          <p className="text-sm text-neutral-400">
            {review.summary ?? "No summary recorded."}
          </p>
          <p className="text-xs text-neutral-500">
            Generated {formatDate(review.createdAt)}
          </p>
          {review.topFindings.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-200">Top findings</p>
              {review.topFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="rounded-md border border-neutral-800 bg-neutral-900 p-3"
                >
                  <p className="text-sm text-neutral-100">{finding.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {finding.requirementKey ?? "No requirement"} -{" "}
                    {finding.severity} - {finding.status}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyText>
          {canRunQa
            ? "No AI QA review has been generated."
            : "Generate a PRD, link a GitHub PR, and refresh a PR snapshot before running QA."}
        </EmptyText>
      )}
    </section>
  );
}

function HumanApprovalPanel({
  approval,
  canSubmitApproval,
  onSubmitApproval
}: {
  approval: ReleaseControlRoomView["humanApproval"];
  canSubmitApproval: boolean;
  onSubmitApproval: () => void;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-medium text-neutral-100">
          Human Approval
        </h3>
        <button
          type="button"
          onClick={onSubmitApproval}
          disabled={!canSubmitApproval}
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit decision
        </button>
      </div>
      {approval.decision ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={approval.decision} />
            <Badge>{approval.historyCount} decision history</Badge>
          </div>
          <p className="text-sm text-neutral-400">
            {approval.note ?? "No decision note recorded."}
          </p>
          {approval.createdAt ? (
            <p className="text-xs text-neutral-500">
              Recorded {formatDate(approval.createdAt)}
            </p>
          ) : null}
          <StringList
            title="Remaining risks"
            items={approval.remainingRisks ?? []}
            emptyText="No remaining risks recorded."
          />
        </div>
      ) : (
        <EmptyText>
          {canSubmitApproval
            ? "No approval decision has been recorded."
            : "Run AI QA review before submitting an approval decision."}
        </EmptyText>
      )}
    </section>
  );
}

function ReleaseReportPanel({
  report,
  reportLabel,
  canGenerateReport,
  onGenerateReport,
  isGeneratingReport
}: {
  report: ReleaseControlRoomView["releaseReport"];
  reportLabel: string;
  canGenerateReport: boolean;
  onGenerateReport: () => void;
  isGeneratingReport: boolean;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-medium text-neutral-100">
          {reportLabel}
        </h3>
        {report ? <StatusBadge status={report.status} /> : null}
      </div>
      {report ? (
        <div className="mt-4 space-y-3">
          <p className="font-medium text-neutral-100">{report.title}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <MiniMetric
              label="Readiness score"
              value={report.readinessScore ?? 0}
            />
            <MiniMetric
              label="Generated"
              value={formatDate(report.generatedAt ?? report.createdAt)}
            />
          </div>
          <Link
            href={`/reports/${report.shareToken}`}
            target="_blank"
            className="inline-flex rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
          >
            Open public report
          </Link>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-neutral-500">
            {canGenerateReport
              ? `No ${reportLabel.toLowerCase()} has been generated.`
              : `Run QA and submit approval before generating a ${reportLabel.toLowerCase()}.`}
          </p>
          <button
            type="button"
            onClick={onGenerateReport}
            disabled={!canGenerateReport || isGeneratingReport}
            className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGeneratingReport ? "Generating..." : `Generate ${reportLabel}`}
          </button>
        </div>
      )}
    </section>
  );
}

function TrustTimeline({
  timeline
}: {
  timeline: ReleaseControlRoomView["timeline"];
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <h3 className="text-base font-medium text-neutral-100">Trust Timeline</h3>
      {timeline.length > 0 ? (
        <div className="mt-4 space-y-3">
          {timeline.map((item, index) => (
            <article
              key={`${item.title}-${item.timestamp}-${index}`}
              className="rounded-md border border-neutral-800 bg-neutral-900 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{item.source}</Badge>
                    <p className="font-medium text-neutral-100">{item.title}</p>
                  </div>
                  <p className="mt-2 text-sm text-neutral-400">
                    {item.description}
                  </p>
                </div>
                <p className="text-xs text-neutral-500">
                  {formatDate(item.timestamp)}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyText>No timeline events recorded yet.</EmptyText>
      )}
    </section>
  );
}

function PRDLists({ prd }: { prd: PRDView }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ListPanel title="Goals" items={prd.goals} emptyText="No goals." />
      <ListPanel title="Non-goals" items={prd.nonGoals} emptyText="No non-goals." />
      <ListPanel
        title="Edge cases"
        items={prd.edgeCases}
        emptyText="No edge cases."
      />
      <ListPanel title="Risks" items={prd.risks} emptyText="No risks." />
      <section className="rounded-md border border-neutral-800 bg-neutral-950 p-4 lg:col-span-2">
        <h3 className="font-medium text-neutral-100">User stories</h3>
        {prd.userStories.length > 0 ? (
          <div className="mt-3 space-y-2">
            {prd.userStories.map((story: unknown, index: number) => (
              <div
                key={index}
                className="rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-300"
              >
                {formatUserStory(story)}
              </div>
            ))}
          </div>
        ) : (
          <EmptyText>No user stories.</EmptyText>
        )}
      </section>
    </div>
  );
}

function ListPanel({
  title,
  items,
  emptyText
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
      <h3 className="font-medium text-neutral-100">{title}</h3>
      <StringList items={items} emptyText={emptyText} />
    </section>
  );
}

function StringList({
  title,
  items,
  emptyText
}: {
  title?: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className={title ? "mt-4" : "mt-3"}>
      {title ? (
        <p className="mb-2 text-xs font-medium uppercase text-neutral-500">
          {title}
        </p>
      ) : null}
      {items.length > 0 ? (
        <ul className="space-y-2 text-sm text-neutral-300">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="rounded-md bg-neutral-950 p-3">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyText>{emptyText}</EmptyText>
      )}
    </div>
  );
}

function AiRunUsage({ runs }: { runs: AiRunView[] }) {
  return (
    <section
      id="ai-run-usage"
      className="scroll-mt-28 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
    >
      <h2 className="text-lg font-medium">Token Usage</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Safe model and token usage metadata for this feature.
      </p>
      {runs.length > 0 ? (
        <div className="mt-4 space-y-3">
          {runs.map((run: AiRunView) => (
            <article
              key={run.id}
              className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{run.agentType}</Badge>
                <Badge>{run.model}</Badge>
                <Badge>{run.status}</Badge>
                <span className="text-xs text-neutral-500">
                  {formatDate(run.createdAt)}
                </span>
              </div>
              {run.tokenUsage ? (
                <p className="mt-3 text-sm text-neutral-400">
                  Tokens: input {run.tokenUsage.inputTokens ?? 0}, output{" "}
                  {run.tokenUsage.outputTokens ?? 0}, total{" "}
                  {run.tokenUsage.totalTokens ?? 0}
                </p>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">
                  No token usage recorded.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyText>No AI runs recorded for this feature yet.</EmptyText>
      )}
    </section>
  );
}

function GitHubPullRequestSection({
  data,
  isLoading,
  error,
  prUrl,
  setPrUrl,
  onLink,
  isLinking,
  linkError,
  onRefresh,
  isRefreshing,
  refreshError
}: {
  data:
    | {
        pullRequest: {
          id: string;
          githubPrNumber: number;
          title: string;
          author: string | null;
          branch: string;
          baseBranch: string;
          state: string;
          latestCommitSha: string | null;
          htmlUrl: string;
        };
        repository: {
          fullName: string;
        } | null;
        latestSnapshot: {
          commitSha: string;
          diffText: string | null;
          changedFiles: unknown[];
          ciStatus: string;
          createdAt: Date | string;
        } | null;
        changedFilesCount: number;
        diffTextLength: number;
      }
    | null
    | undefined;
  isLoading: boolean;
  error?: string;
  prUrl: string;
  setPrUrl: (value: string) => void;
  onLink: () => void;
  isLinking: boolean;
  linkError?: string;
  onRefresh: (pullRequestId: string) => void;
  isRefreshing: boolean;
  refreshError?: string;
}) {
  const canLink = prUrl.trim().length > 0 && !isLinking;

  return (
    <section
      id="github-pr-section"
      className="scroll-mt-28 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
    >
      <h2 className="text-lg font-medium">GitHub Pull Request</h2>

      {isLoading ? <EmptyText>Loading linked pull request...</EmptyText> : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      {!isLoading && !data ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-neutral-500">
            Paste a GitHub PR URL to capture the code snapshot for verification.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={prUrl}
              onChange={(event) => setPrUrl(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-blue-500"
              placeholder="https://github.com/owner/repo/pull/123"
              type="url"
            />
            <button
              type="button"
              disabled={!canLink}
              onClick={onLink}
              className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLinking ? "Linking..." : "Link Pull Request"}
            </button>
          </div>
          {linkError ? <p className="text-sm text-red-300">{linkError}</p> : null}
        </div>
      ) : null}

      {data ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-neutral-100">
                  {data.pullRequest.title}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {data.repository?.fullName ?? "Repository"} #
                  {data.pullRequest.githubPrNumber}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{data.pullRequest.state}</Badge>
                <Badge>{data.latestSnapshot?.ciStatus ?? "unknown"}</Badge>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-neutral-400 md:grid-cols-2">
              <p>
                <span className="text-neutral-500">Author:</span>{" "}
                {data.pullRequest.author ?? "Unknown"}
              </p>
              <p>
                <span className="text-neutral-500">Branch:</span>{" "}
                {data.pullRequest.branch} {"->"} {data.pullRequest.baseBranch}
              </p>
              <p>
                <span className="text-neutral-500">Commit:</span>{" "}
                {shortSha(data.pullRequest.latestCommitSha)}
              </p>
              <p>
                <span className="text-neutral-500">Changed files:</span>{" "}
                {data.changedFilesCount}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={data.pullRequest.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
              >
                Open on GitHub
              </a>
              <button
                type="button"
                onClick={() => onRefresh(data.pullRequest.id)}
                disabled={isRefreshing}
                className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRefreshing ? "Refreshing..." : "Refresh snapshot"}
              </button>
            </div>

            {refreshError ? (
              <p className="mt-3 text-sm text-red-300">{refreshError}</p>
            ) : null}
          </div>

          <details className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
            <summary className="cursor-pointer text-sm font-medium text-neutral-300">
              Snapshot details
            </summary>
            <div className="mt-3 grid gap-2 text-sm text-neutral-500 md:grid-cols-2">
              <p>Diff length: {data.diffTextLength}</p>
              <p>
                Snapshot created:{" "}
                {data.latestSnapshot
                  ? formatDate(data.latestSnapshot.createdAt)
                  : "None"}
              </p>
              <p>Snapshot commit: {shortSha(data.latestSnapshot?.commitSha)}</p>
              <p>Changed files: {data.latestSnapshot?.changedFiles.length ?? 0}</p>
            </div>
          </details>
        </div>
      ) : null}
    </section>
  );
}

type QAReviewBundle = {
  review: {
    id: string;
    reviewVersion: number;
    overallStatus: string;
    readinessScore: number | null;
    confidenceScore: number | null;
    summary: string | null;
    createdAt: Date | string;
  };
  coverage: Array<{
    id: string;
    requirementKey: string;
    status: string;
    evidence: {
      summary?: string;
      files?: string[];
      checks?: string[];
      notes?: string[];
    };
    concern: string | null;
  }>;
  findings: Array<{
    id: string;
    requirementKey: string | null;
    severity: string;
    category: string;
    title: string;
    description: string;
    file: string | null;
    line: number | null;
    suggestedFix: string | null;
    status: string;
  }>;
};

type ApprovalView = {
  id: string;
  decision: ApprovalDecision;
  note: string | null;
  remainingRisks: string[];
  createdAt: Date | string;
};

type ReleaseReportView = {
  id: string;
  title: string;
  status: string;
  shareToken: string;
  readinessScore: number | null;
  generatedAt: Date | string | null;
  createdAt: Date | string;
  reportData: {
    reportType?: "client_delivery" | "developer_fix" | "internal_release";
    audience?: string;
    visibility?: string;
    reportStatus?: string;
    approval?: {
      decision?: string;
    } | null;
  };
};

type ApprovalRiskSummary = {
  readinessScore: number | null;
  highCriticalFindings: number;
  missingRequirements: number;
  partialRequirements: number;
  riskyRequirements: number;
  hasUnresolvedRisk: boolean;
};

function parseRemainingRisks(value: string) {
  return value
    .split("\n")
    .map((risk) => risk.trim())
    .filter(Boolean);
}

function getApprovalRiskSummary(
  latestQaReview: QAReviewBundle | null | undefined
): ApprovalRiskSummary {
  const readinessScore = latestQaReview?.review.readinessScore ?? null;
  const highCriticalFindings =
    latestQaReview?.findings.filter(
      (finding) =>
        finding.status === "open" &&
        (finding.severity === "high" || finding.severity === "critical")
    ).length ?? 0;
  const missingRequirements =
    latestQaReview?.coverage.filter((coverage) => coverage.status === "missing")
      .length ?? 0;
  const partialRequirements =
    latestQaReview?.coverage.filter((coverage) => coverage.status === "partial")
      .length ?? 0;
  const riskyRequirements =
    latestQaReview?.coverage.filter((coverage) => coverage.status === "risky")
      .length ?? 0;
  const hasUnresolvedRisk =
    (readinessScore ?? 0) < 80 ||
    highCriticalFindings > 0 ||
    missingRequirements > 0 ||
    partialRequirements > 0 ||
    riskyRequirements > 0;

  return {
    readinessScore,
    highCriticalFindings,
    missingRequirements,
    partialRequirements,
    riskyRequirements,
    hasUnresolvedRisk
  };
}

function validateApprovalDecision(input: {
  decision: ApprovalDecision;
  note: string;
  remainingRisks: string[];
  riskSummary: ApprovalRiskSummary;
}) {
  const hasNote = input.note.length > 0;
  const hasRemainingRisks = input.remainingRisks.length > 0;

  if (
    input.decision === "approved" &&
    input.riskSummary.hasUnresolvedRisk &&
    !hasNote
  ) {
    return "This review has unresolved risks. Add an approval note before approving.";
  }

  if (
    input.decision === "approved_with_risk" &&
    !hasNote &&
    !hasRemainingRisks
  ) {
    return "Add an approval note or list remaining risks before approving with risk.";
  }

  if (input.decision === "changes_requested" && !hasNote) {
    return "Add a note explaining what changes are required.";
  }

  if (input.decision === "rejected" && !hasNote) {
    return "Add a note explaining why this release is rejected.";
  }

  return null;
}

function AIQAReviewSection({
  hasPrd,
  prdMayBeOutdated,
  requirementsCount,
  hasPullRequestSnapshot,
  reviewBundle,
  isLoading,
  error,
  onRun,
  isRunning,
  runError
}: {
  hasPrd: boolean;
  prdMayBeOutdated: boolean;
  requirementsCount: number;
  hasPullRequestSnapshot: boolean;
  reviewBundle: QAReviewBundle | null | undefined;
  isLoading: boolean;
  error?: string;
  onRun: () => void;
  isRunning: boolean;
  runError?: string;
}) {
  const ready =
    hasPrd && !prdMayBeOutdated && requirementsCount > 0 && hasPullRequestSnapshot;

  return (
    <section
      id="ai-qa-review"
      className="scroll-mt-28 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">AI QA Review</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Compare the latest PR snapshot against the PRD requirement set.
          </p>
        </div>
        {ready ? (
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning || prdMayBeOutdated}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning
              ? "Running..."
              : reviewBundle
                ? "Run re-review"
                : "Run AI QA Review"}
          </button>
        ) : null}
      </div>

      {prdMayBeOutdated ? (
        <p className="mt-4 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
          PRD may be outdated because clarification answers changed. Regenerate
          the PRD before running QA review.
        </p>
      ) : !hasPrd || requirementsCount === 0 ? (
        <EmptyText>Generate PRD and requirements before running QA review.</EmptyText>
      ) : !hasPullRequestSnapshot ? (
        <EmptyText>Link a GitHub pull request before running QA review.</EmptyText>
      ) : null}

      {isLoading ? <EmptyText>Loading latest QA review...</EmptyText> : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {runError ? <p className="mt-3 text-sm text-red-300">{runError}</p> : null}

      {reviewBundle ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={reviewBundle.review.overallStatus} />
                  <Badge>v{reviewBundle.review.reviewVersion}</Badge>
                </div>
                <p className="mt-3 text-sm text-neutral-400">
                  {reviewBundle.review.summary ?? "No summary recorded."}
                </p>
              </div>
              <p className="text-xs text-neutral-500">
                {formatDate(reviewBundle.review.createdAt)}
              </p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Score label="Readiness" value={reviewBundle.review.readinessScore} />
              <Score
                label="Confidence"
                value={reviewBundle.review.confidenceScore}
              />
            </div>
          </div>

          <section>
            <h3 className="text-base font-medium text-neutral-100">
              Requirement Coverage Matrix
            </h3>
            <div className="mt-3 space-y-3">
              {reviewBundle.coverage.map((coverage) => (
                <article
                  key={coverage.id}
                  className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-medium text-blue-300">
                      {coverage.requirementKey}
                    </p>
                    <StatusBadge status={coverage.status} />
                  </div>
                  <StringList
                    title="Evidence"
                    items={coverage.evidence.notes ?? []}
                    emptyText="No evidence recorded."
                  />
                  {coverage.concern ? (
                    <p className="mt-3 text-sm text-amber-300">
                      Concern: {coverage.concern}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-base font-medium text-neutral-100">Findings</h3>
            {reviewBundle.findings.length > 0 ? (
              <div className="mt-3 space-y-3">
                {reviewBundle.findings.map((finding) => (
                  <article
                    key={finding.id}
                    className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-medium text-neutral-100">
                          {finding.title}
                        </h4>
                        <p className="mt-1 text-sm text-neutral-500">
                          {finding.requirementKey ?? "No requirement"} -{" "}
                          {finding.category}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <SeverityBadge severity={finding.severity} />
                        <Badge>{finding.status}</Badge>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-neutral-400">
                      {finding.description}
                    </p>
                    {finding.file ? (
                      <p className="mt-3 text-sm text-neutral-500">
                        {finding.file}
                        {finding.line ? `:${finding.line}` : ""}
                      </p>
                    ) : null}
                    {finding.suggestedFix ? (
                      <p className="mt-3 text-sm text-blue-200">
                        Suggested fix: {finding.suggestedFix}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyText>No findings recorded.</EmptyText>
            )}
          </section>
        </div>
      ) : ready && !isLoading ? (
        <EmptyText>No QA review has been run yet.</EmptyText>
      ) : null}
    </section>
  );
}

function HumanApprovalGateSection({
  latestQaReview,
  prdMayBeOutdated,
  latestApproval,
  isLoadingApproval,
  approvalError,
  decision,
  setDecision,
  note,
  setNote,
  remainingRisks,
  setRemainingRisks,
  onSubmit,
  isSubmitting,
  submitError,
  validationError,
  confirmationVisible,
  onCancelConfirmation
}: {
  latestQaReview: QAReviewBundle | null | undefined;
  prdMayBeOutdated: boolean;
  latestApproval: ApprovalView | null | undefined;
  isLoadingApproval: boolean;
  approvalError?: string;
  decision: ApprovalDecision;
  setDecision: (decision: ApprovalDecision) => void;
  note: string;
  setNote: (note: string) => void;
  remainingRisks: string;
  setRemainingRisks: (risks: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitError?: string;
  validationError?: string | null;
  confirmationVisible: boolean;
  onCancelConfirmation: () => void;
}) {
  const riskSummary = getApprovalRiskSummary(latestQaReview);
  const canSubmit = Boolean(latestQaReview) && !prdMayBeOutdated && !isSubmitting;

  return (
    <section
      id="human-approval"
      className="scroll-mt-28 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Human Approval Gate</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Record the human release decision after reviewing AI QA evidence.
          </p>
        </div>
        {latestApproval ? <StatusBadge status={latestApproval.decision} /> : null}
      </div>

      {prdMayBeOutdated ? (
        <p className="mt-4 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
          PRD may be outdated. Regenerate the PRD and rerun QA before submitting
          an approval decision.
        </p>
      ) : !latestQaReview ? (
        <EmptyText>Run AI QA review before submitting an approval decision.</EmptyText>
      ) : null}

      {riskSummary.readinessScore !== null && riskSummary.readinessScore < 80 ? (
        <p className="mt-4 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
          Warning: readiness score is below 80. You can still submit a human
          override.
        </p>
      ) : null}

      {riskSummary.highCriticalFindings > 0 ? (
        <p className="mt-3 rounded-md border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">
          Warning: {riskSummary.highCriticalFindings} open high or critical
          finding{riskSummary.highCriticalFindings === 1 ? "" : "s"} exist.
          Approval is not blocked.
        </p>
      ) : null}

      {riskSummary.missingRequirements > 0 ||
      riskSummary.partialRequirements > 0 ||
      riskSummary.riskyRequirements > 0 ? (
        <p className="mt-3 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
          Warning: coverage has {riskSummary.missingRequirements} missing,{" "}
          {riskSummary.partialRequirements} partial, and{" "}
          {riskSummary.riskyRequirements} risky requirement
          {riskSummary.missingRequirements +
            riskSummary.partialRequirements +
            riskSummary.riskyRequirements ===
          1
            ? ""
            : "s"}
          .
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {approvalOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDecision(option.value)}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                decision === option.value
                  ? "border-blue-500 bg-blue-950/40 text-blue-100"
                  : "border-neutral-700 bg-neutral-950 text-neutral-200 hover:border-neutral-500"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="block text-sm">
          <span className="text-neutral-300">Note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-2 min-h-24 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            placeholder="Decision context, rationale, or release condition..."
          />
        </label>

        <label className="block text-sm">
          <span className="text-neutral-300">Remaining risks</span>
          <textarea
            value={remainingRisks}
            onChange={(event) => setRemainingRisks(event.target.value)}
            className="mt-2 min-h-24 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500"
            placeholder="One risk per line"
          />
        </label>

        {validationError ? (
          <p className="rounded-md border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">
            {validationError}
          </p>
        ) : null}

        {confirmationVisible ? (
          <div className="rounded-md border border-amber-800 bg-amber-950/30 p-4">
            <p className="text-sm font-medium text-amber-100">
              This review has unresolved risks. Are you sure you want to approve?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit}
                className="rounded-md bg-amber-200 px-4 py-2 text-sm font-medium text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Approve anyway"}
              </button>
              <button
                type="button"
                onClick={onCancelConfirmation}
                disabled={isSubmitting}
                className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || confirmationVisible}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Submitting..." : "Submit decision"}
        </button>

        {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}
        {approvalError ? (
          <p className="text-sm text-red-300">{approvalError}</p>
        ) : null}
      </div>

      {isLoadingApproval ? <EmptyText>Loading latest approval...</EmptyText> : null}

      {latestApproval ? (
        <div className="mt-5 rounded-md border border-neutral-800 bg-neutral-950 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-neutral-500">Latest decision</p>
              <h3 className="mt-1 font-medium text-neutral-100">
                {formatApprovalDecision(latestApproval.decision)}
              </h3>
            </div>
            <p className="text-xs text-neutral-500">
              {formatDate(latestApproval.createdAt)}
            </p>
          </div>
          {latestApproval.note ? (
            <p className="mt-3 text-sm text-neutral-400">{latestApproval.note}</p>
          ) : null}
          <StringList
            title="Remaining risks"
            items={latestApproval.remainingRisks}
            emptyText="No remaining risks recorded."
          />
        </div>
      ) : null}
    </section>
  );
}

function ReleaseReportSection({
  latestQaReview,
  prdMayBeOutdated,
  latestApproval,
  projectHasClient,
  latestClientReport,
  latestDeveloperFixReport,
  latestInternalReport,
  isLoadingReport,
  reportError,
  onGenerateClientReport,
  onGenerateDeveloperFixReport,
  onGenerateInternalReport,
  isGeneratingClientReport,
  isGeneratingDeveloperFixReport,
  isGeneratingInternalReport,
  clientGenerateError,
  developerGenerateError,
  internalGenerateError
}: {
  latestQaReview: QAReviewBundle | null | undefined;
  prdMayBeOutdated: boolean;
  latestApproval: ApprovalView | null | undefined;
  projectHasClient: boolean;
  latestClientReport: ReleaseReportView | null | undefined;
  latestDeveloperFixReport: ReleaseReportView | null | undefined;
  latestInternalReport: ReleaseReportView | null | undefined;
  isLoadingReport: boolean;
  reportError?: string;
  onGenerateClientReport: () => void;
  onGenerateDeveloperFixReport: () => void;
  onGenerateInternalReport: () => void;
  isGeneratingClientReport: boolean;
  isGeneratingDeveloperFixReport: boolean;
  isGeneratingInternalReport: boolean;
  clientGenerateError?: string;
  developerGenerateError?: string;
  internalGenerateError?: string;
}) {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const riskSummary = getApprovalRiskSummary(latestQaReview);
  const approvalDecision = latestApproval?.decision;
  const needsFixes =
    riskSummary.hasUnresolvedRisk ||
    approvalDecision === "rejected" ||
    approvalDecision === "changes_requested";
  const fixReportIsPrimary =
    needsFixes && approvalDecision !== "approved" && approvalDecision !== "approved_with_risk";
  const clientApproved =
    approvalDecision === "approved" || approvalDecision === "approved_with_risk";
  const canGenerateDeveloperFix =
    Boolean(latestQaReview) &&
    fixReportIsPrimary &&
    !prdMayBeOutdated &&
    !isGeneratingDeveloperFixReport;
  const canGenerateClient =
    Boolean(latestQaReview && latestApproval) &&
    clientApproved &&
    projectHasClient &&
    !prdMayBeOutdated &&
    !isGeneratingClientReport;
  const canGenerateInternal =
    Boolean(latestQaReview && latestApproval) &&
    clientApproved &&
    !projectHasClient &&
    !prdMayBeOutdated &&
    !isGeneratingInternalReport;

  async function copyReportLink(path: string, label: string) {
    setCopyError(null);
    try {
      const url = new URL(path, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setCopiedLink(label);
      window.setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      setCopyError("Could not copy link. Open the report and copy the URL.");
    }
  }

  return (
    <section
      id="release-report"
      className="scroll-mt-28 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Reports</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Generate the right artifact for the current audience: developer fix
            guidance or client delivery proof.
          </p>
        </div>
      </div>

      {prdMayBeOutdated ? (
        <p className="mt-4 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
          PRD may be outdated. Regenerate the PRD and rerun QA before generating
          reports.
        </p>
      ) : !latestQaReview ? (
        <EmptyText>Run AI QA Review before generating reports.</EmptyText>
      ) : null}

      {isLoadingReport ? <EmptyText>Loading latest release report...</EmptyText> : null}
      {reportError ? <p className="mt-3 text-sm text-red-300">{reportError}</p> : null}
      {copyError ? <p className="mt-3 text-sm text-red-300">{copyError}</p> : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <ReportActionCard
          title="Developer Fix Report"
          description="This report explains what needs to be fixed before this PR can be approved."
          report={latestDeveloperFixReport}
          primaryLabel={
            latestDeveloperFixReport
              ? "Share Fix Report"
              : "Generate Developer Fix Report"
          }
          openLabel="Open Fix Report"
          copyLabel="Copy Fix Report Link"
          copied={copiedLink === "developer_fix"}
          disabled={!canGenerateDeveloperFix}
          isGenerating={isGeneratingDeveloperFixReport}
          generateError={developerGenerateError}
          onGenerate={onGenerateDeveloperFixReport}
          onCopy={(path) => copyReportLink(path, "developer_fix")}
          unavailableText={
            !latestQaReview
              ? "Run AI QA review first."
              : clientApproved
                ? "Approved; existing fix reports remain available, but the client report is primary."
                : !needsFixes
                ? "Available when QA finds gaps or a reviewer requests fixes."
                : prdMayBeOutdated
                  ? "Regenerate PRD and rerun QA first."
                : undefined
          }
        />

        {projectHasClient ? (
          <ReportActionCard
            title="Client Delivery Report"
            description="This report summarizes what was requested, verified, and approved for delivery."
            report={latestClientReport}
            primaryLabel={
              latestClientReport
                ? "Share Client Report"
                : "Generate Client Delivery Report"
            }
            openLabel="Open Client Report"
            copyLabel="Copy Client Report Link"
            copied={copiedLink === "client_delivery"}
            disabled={!canGenerateClient}
            isGenerating={isGeneratingClientReport}
            generateError={clientGenerateError}
            onGenerate={onGenerateClientReport}
            onCopy={(path) => copyReportLink(path, "client_delivery")}
            unavailableText={
              !latestQaReview
                ? "Run AI QA review first."
                : !latestApproval
                  ? "Submit an approval decision first."
                  : !clientApproved
                    ? "Blocked because this PR is rejected or needs fixes."
                    : prdMayBeOutdated
                      ? "Regenerate PRD and rerun QA first."
                      : undefined
            }
          />
        ) : (
          <ReportActionCard
            title="Internal Release Report"
            description="This report explains why this PR is ready to merge, ship, or release."
            report={latestInternalReport}
            primaryLabel={
              latestInternalReport
                ? "Share Internal Report"
                : "Generate Internal Release Report"
            }
            openLabel="Open Internal Report"
            copyLabel="Copy Internal Report Link"
            copied={copiedLink === "internal_release"}
            disabled={!canGenerateInternal}
            isGenerating={isGeneratingInternalReport}
            generateError={internalGenerateError}
            onGenerate={onGenerateInternalReport}
            onCopy={(path) => copyReportLink(path, "internal_release")}
            unavailableText={
              !latestQaReview
                ? "Run AI QA review first."
                : !latestApproval
                  ? "Submit an approval decision first."
                  : !clientApproved
                    ? "Blocked because this PR is rejected or needs fixes."
                    : prdMayBeOutdated
                      ? "Regenerate PRD and rerun QA first."
                      : undefined
            }
          />
        )}
      </div>
    </section>
  );
}

function ReportActionCard({
  title,
  description,
  report,
  primaryLabel,
  openLabel,
  copyLabel,
  copied,
  disabled,
  isGenerating,
  generateError,
  onGenerate,
  onCopy,
  unavailableText
}: {
  title: string;
  description: string;
  report: ReleaseReportView | null | undefined;
  primaryLabel: string;
  openLabel: string;
  copyLabel: string;
  copied: boolean;
  disabled: boolean;
  isGenerating: boolean;
  generateError?: string;
  onGenerate: () => void;
  onCopy: (path: string) => void;
  unavailableText?: string;
}) {
  const sharePath = report ? `/reports/${report.shareToken}` : undefined;

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-neutral-100">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-neutral-500">{description}</p>
        </div>
        {report ? (
          <StatusBadge status={report.reportData.reportStatus ?? report.status} />
        ) : null}
      </div>

      {report ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
            <p className="text-xs text-neutral-500">Latest</p>
            <p className="mt-1 text-sm text-neutral-100">{report.title}</p>
          </div>
          <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
            <p className="text-xs text-neutral-500">Generated</p>
            <p className="mt-1 text-sm text-neutral-100">
              {formatDate(report.generatedAt ?? report.createdAt)}
            </p>
          </div>
        </div>
      ) : null}

      {unavailableText ? (
        <p className="mt-4 rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-400">
          {unavailableText}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={disabled}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGenerating ? "Generating..." : primaryLabel}
        </button>

        {sharePath ? (
          <>
            <Link
              href={sharePath}
              target="_blank"
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500"
            >
              {openLabel}
            </Link>
            <button
              type="button"
              onClick={() => onCopy(sharePath)}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500"
            >
              {copied ? "Copied" : copyLabel}
            </button>
          </>
        ) : null}
      </div>

      {generateError ? (
        <p className="mt-3 text-sm text-red-300">{generateError}</p>
      ) : null}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-100">
        {value ?? 0}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "covered" || status === "passed"
      ? "border-emerald-800 bg-emerald-950/30 text-emerald-200"
      : status === "partial" || status === "needs_changes"
        ? "border-amber-800 bg-amber-950/30 text-amber-200"
        : status === "missing" || status === "failed"
          ? "border-red-800 bg-red-950/30 text-red-200"
          : "border-violet-800 bg-violet-950/30 text-violet-200";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${classes}`}>
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const classes =
    severity === "critical" || severity === "high"
      ? "border-red-800 bg-red-950/30 text-red-200"
      : severity === "medium"
        ? "border-amber-800 bg-amber-950/30 text-amber-200"
        : "border-neutral-700 text-neutral-300";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${classes}`}>
      {severity}
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300">
      {children}
    </span>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-neutral-500">{children}</p>;
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <p className="text-sm text-neutral-400">{title}</p>
      <div className="mt-4 space-y-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-800" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-800" />
        <div className="h-16 animate-pulse rounded-md bg-neutral-950" />
      </div>
    </section>
  );
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString();
}

function formatUserStory(story: unknown) {
  if (isRecord(story)) {
    const typedStory = story as UserStory;
    if (typedStory.actor || typedStory.want || typedStory.benefit) {
      return [
        typedStory.actor ? `As ${String(typedStory.actor)}` : null,
        typedStory.want ? `I want ${String(typedStory.want)}` : null,
        typedStory.benefit ? `so that ${String(typedStory.benefit)}` : null
      ]
        .filter(Boolean)
        .join(", ");
    }
  }

  return JSON.stringify(story);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRequiredQuestionPriority(priority: string) {
  return priority === "high" || priority === "urgent";
}

function formatQuestionPriority(priority: string) {
  const labels: Record<string, string> = {
    must_answer: "Must have",
    must_have: "Must have",
    nice_to_have: "Nice to have",
    should_have: "Should have",
    could_have: "Could have",
    wont_have: "Won't have",
    required: "Required",
    optional: "Optional",
    high: "Required",
    urgent: "Required",
    medium: "Nice to have"
  };

  return (
    labels[priority] ??
    priority
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function formatApprovalDecision(decision: string) {
  if (decision === "approved") {
    return "Approved";
  }

  if (decision === "approved_with_risk") {
    return "Approved with risk";
  }

  if (decision === "changes_requested") {
    return "Changes requested";
  }

  return "Rejected";
}

function shortSha(sha?: string | null) {
  return sha ? sha.slice(0, 7) : "unknown";
}
