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
  | "engineering_tasks"
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
    state: string;
    changedFilesCount: number;
    additions: number;
    deletions: number;
    ciStatus: string;
    lastSnapshotAt: Date | string | null;
    latestReviewAt: Date | string | null;
    prUpdatedAfterLastReview: boolean;
    rereviewRequired: boolean;
    latestWebhookEvent: {
      eventType: string;
      action: string | null;
      status: string;
      receivedAt: Date | string;
      processedAt: Date | string | null;
    } | null;
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
  { id: "engineering_tasks", label: "Engineering Tasks" },
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
  const [prSearch, setPrSearch] = useState("");
  const [prStateFilter, setPrStateFilter] = useState<"open" | "closed" | "all">(
    "open"
  );
  const [approvalDecision, setApprovalDecision] =
    useState<ApprovalDecision>("approved");
  const [approvalNote, setApprovalNote] = useState("");
  const [remainingRisks, setRemainingRisks] = useState("");
  const [approvalValidationError, setApprovalValidationError] = useState<
    string | null
  >(null);
  const [showApprovalConfirmation, setShowApprovalConfirmation] =
    useState(false);
  const [taskCopyMessage, setTaskCopyMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FeatureDetailTab>("overview");
  const [requirementsNestedTab, setRequirementsNestedTab] = useState<
    "review" | "prd" | "scope" | "acceptance_criteria"
  >("review");
  const utils = trpc.useUtils();
  const featureQuery = trpc.featureRequests.getById.useQuery({
    id: featureRequestId
  });
  const controlRoom = trpc.featureRequests.getReleaseControlRoom.useQuery({
    featureRequestId
  });
  const guidedWorkflow = trpc.guidedWorkflow.getFeatureWorkflow.useQuery({
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
    enabled: activeTab === "requirements" || activeTab === "engineering_tasks"
  });
  const aiRunUsage = trpc.requirementEngine.getAiRunUsage.useQuery({
    featureRequestId
  }, {
    enabled: activeTab === "token_usage"
  });
  const engineeringTaskCenter = trpc.engineeringTasks.listByFeature.useQuery({
    featureRequestId
  });
  const developerBrief = trpc.engineeringTasks.getDeveloperBrief.useQuery(
    { featureRequestId },
    { enabled: false }
  );
  const agentPayload = trpc.engineeringTasks.copyPayloadForAgent.useQuery(
    { featureRequestId },
    { enabled: false }
  );
  const linkedPullRequest = trpc.github.getFeaturePullRequest.useQuery({
    featureRequestId
  }, {
    enabled: activeTab === "pr" || activeTab === "qa"
  });
  const pullRequestPicker = trpc.pullRequests.listForProjectRepository.useQuery(
    {
      projectId: featureQuery.data?.projectId ?? "",
      state: prStateFilter,
      search: prSearch.trim() || undefined,
      limit: 50
    },
    {
      enabled:
        activeTab === "pr" &&
        Boolean(featureQuery.data?.projectId) &&
        !linkedPullRequest.data
    }
  );
  const latestQaReview = trpc.qaReview.getLatest.useQuery({
    featureRequestId
  }, {
    enabled:
      activeTab === "qa" ||
      activeTab === "approval" ||
      activeTab === "report"
  });
  const proofGate = trpc.proofGate.getProofGateStatus.useQuery({
    featureRequestId
  }, {
    enabled: activeTab === "qa" || activeTab === "report"
  });
  const billingEntitlement = trpc.billing.getCurrentEntitlement.useQuery(undefined, {
    enabled: activeTab === "qa"
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
    const projectId = featureQuery.data?.projectId;
    await Promise.all([
      utils.featureRequests.getById.invalidate({ id: featureRequestId }),
      utils.requirementEngine.getWorkflow.invalidate({ featureRequestId }),
      utils.featureRequests.getReleaseControlRoom.invalidate({
        featureRequestId
      }),
      utils.featureRequests.getReleaseControlRoom.invalidate({
        featureRequestId,
        includeTimeline: true
      }),
      utils.guidedWorkflow.getFeatureWorkflow.invalidate({
        featureRequestId
      }),
      utils.engineeringTasks.listByFeature.invalidate({
        featureRequestId
      }),
      projectId
        ? utils.projects.getControlRoom.invalidate({ projectId })
        : Promise.resolve(),
      utils.dashboard.getSummary.invalidate(),
      utils.projects.list.invalidate(),
      utils.releaseBoard.getBoard.invalidate()
    ]);
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
        await utils.engineeringTasks.listByFeature.invalidate({ featureRequestId });
        await invalidateReleaseControlRoom();
      }
    });
  const regenerateTasks =
    trpc.engineeringTasks.regenerateForFeature.useMutation({
      onSuccess: async () => {
        await utils.requirementEngine.getWorkflow.invalidate({ featureRequestId });
        await utils.engineeringTasks.listByFeature.invalidate({ featureRequestId });
        await invalidateReleaseControlRoom();
      }
    });
  const updateTaskStatus = trpc.engineeringTasks.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.engineeringTasks.listByFeature.invalidate({ featureRequestId });
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
  const linkSelectedPullRequest =
    trpc.pullRequests.linkSelectedPullRequest.useMutation({
      onSuccess: async () => {
        await utils.github.getFeaturePullRequest.invalidate({ featureRequestId });
        await utils.pullRequests.listForProjectRepository.invalidate();
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
      await utils.proofGate.getProofGateStatus.invalidate({ featureRequestId });
      await utils.billing.getCurrentEntitlement.invalidate();
      await utils.requirementEngine.getWorkflow.invalidate({ featureRequestId });
      await invalidateReleaseControlRoom();
    }
  });
  const publishGitHubProof = trpc.proofGate.publishGitHubProof.useMutation({
    onSuccess: async () => {
      await utils.proofGate.getProofGateStatus.invalidate({ featureRequestId });
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
  const controlRoomRequirementsCount = controlRoom.data
    ? Object.values(controlRoom.data.requirementEvidenceSummary).reduce(
        (total, items) => total + items.length,
        0
      )
    : 0;
  const controlRoomHasPrd = Boolean(
    controlRoom.data?.progress.some(
      (step) => step.id === "prd" && step.status === "complete"
    )
  );

  const hasQuestions = clarificationQuestions.length > 0;
  const hasPrd = Boolean(prd) || controlRoomHasPrd;
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
  const qaRequirementsCount =
    prdRequirements.length > 0 ? prdRequirements.length : controlRoomRequirementsCount;

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

    if (tab === "requirements") {
      if (sectionId === "clarifications-section" || sectionId === "answer_clarifications") {
        setRequirementsNestedTab("review");
      } else if (sectionId === "requirement-engine-section" || sectionId === "generate_prd" || sectionId === "prd-section") {
        setRequirementsNestedTab("prd");
      } else if (sectionId === "scope-section") {
        setRequirementsNestedTab("scope");
      } else if (sectionId === "acceptance-criteria-section") {
        setRequirementsNestedTab("acceptance_criteria");
      }
    }

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

  function runGuidedAction(actionKey?: string) {
    if (!actionKey) {
      return;
    }

    if (actionKey === "answer_clarifications") {
      openTab("requirements", "clarifications-section");
      return;
    }

    if (actionKey === "generate_prd") {
      openTab("requirements", "requirement-engine-section");
      generatePrd.mutate({ featureRequestId });
      return;
    }

    if (actionKey === "generate_tasks") {
      openTab("engineering_tasks", "engineering-tasks-command-center");
      if (prd) {
        generateTasks.mutate({ prdId: prd.id });
      }
      return;
    }

    if (actionKey === "review_engineering_tasks") {
      openTab("engineering_tasks", "engineering-tasks-command-center");
      return;
    }

    if (actionKey === "link_pr") {
      openTab("pr", "github-pr-section");
      return;
    }

    if (actionKey === "run_qa") {
      openTab("qa", "ai-qa-review");
      if (!prdMayBeOutdated) {
        runQaReview.mutate({ featureRequestId });
      }
      return;
    }

    if (
      actionKey === "approve_release" ||
      actionKey === "review_approval" ||
      actionKey === "review_risks"
    ) {
      openTab("approval", "human-approval");
      return;
    }

    if (actionKey === "generate_report") {
      openTab("report", "release-report");
      if (!prdMayBeOutdated) {
        if (projectHasClient) {
          generateReleaseReport.mutate({ featureRequestId });
        } else {
          generateInternalReleaseReport.mutate({ featureRequestId });
        }
      }
    }
  }

  async function copyDeveloperBrief() {
    setTaskCopyMessage(null);
    const result = await developerBrief.refetch();
    const markdown = result.data?.markdown;

    if (markdown) {
      await navigator.clipboard.writeText(markdown);
      setTaskCopyMessage("Developer handoff copied.");
    }
  }

  async function copyAgentPayload() {
    setTaskCopyMessage(null);
    const result = await agentPayload.refetch();
    const payload = result.data?.payload;

    if (payload) {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setTaskCopyMessage("Coding agent prompt copied.");
    }
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
      <FeatureHierarchyHeader
        feature={{
          title: feature.title,
          description: feature.description,
          priority: feature.priority,
          status: feature.status
        }}
        controlRoom={controlRoom.data}
        prdMayBeOutdated={prdMayBeOutdated}
      />

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

      {guidedWorkflow.data ? (
        <FeatureWorkflowGuide
          workflow={guidedWorkflow.data}
          onAction={runGuidedAction}
          isBusy={
            generatePrd.isPending ||
            generateTasks.isPending ||
            runQaReview.isPending ||
            generateReleaseReport.isPending ||
            generateInternalReleaseReport.isPending
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
        <section id="requirements-section" className="space-y-4 scroll-mt-28">
          {/* Nested Tabs Header & Status Chips */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
              <nav className="flex flex-wrap gap-2" aria-label="Requirements section tabs">
                {[
                  { id: "review", label: "1. Review" },
                  { id: "prd", label: "2. PRD" },
                  { id: "scope", label: "3. Scope" },
                  { id: "acceptance_criteria", label: "4. Acceptance Criteria" }
                ].map((tab) => {
                  const isSelected = requirementsNestedTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        setRequirementsNestedTab(
                          tab.id as "review" | "prd" | "scope" | "acceptance_criteria"
                        )
                      }
                      className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                        isSelected
                          ? "bg-neutral-100 text-neutral-950 shadow-sm"
                          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>

              {/* Status Chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {clarificationQuestions.length === 0 ? (
                  <span className="rounded-full border border-emerald-900/70 bg-emerald-950/40 px-2.5 py-0.5 font-medium text-emerald-300">
                    Review complete
                  </span>
                ) : unansweredRequiredClarificationQuestions.length > 0 ? (
                  <span className="rounded-full border border-amber-900/70 bg-amber-950/40 px-2.5 py-0.5 font-medium text-amber-300">
                    Review needed
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-900/70 bg-emerald-950/40 px-2.5 py-0.5 font-medium text-emerald-300">
                    Answers saved
                  </span>
                )}

                {hasPrd ? (
                  <span className="rounded-full border border-emerald-900/70 bg-emerald-950/40 px-2.5 py-0.5 font-medium text-emerald-300">
                    PRD generated
                  </span>
                ) : prdBlockedByClarifications ? (
                  <span className="rounded-full border border-red-900/70 bg-red-950/40 px-2.5 py-0.5 font-medium text-red-300">
                    PRD missing
                  </span>
                ) : (
                  <span className="rounded-full border border-blue-900/70 bg-blue-950/40 px-2.5 py-0.5 font-medium text-blue-300">
                    Ready to generate
                  </span>
                )}

                {prdRequirements.length > 0 ? (
                  <span className="rounded-full border border-emerald-900/70 bg-emerald-950/40 px-2.5 py-0.5 font-medium text-emerald-300">
                    Scope generated
                  </span>
                ) : null}

                {prdRequirements.some(
                  (r) => r.acceptanceCriteria && r.acceptanceCriteria.length > 0
                ) ? (
                  <span className="rounded-full border border-emerald-900/70 bg-emerald-950/40 px-2.5 py-0.5 font-medium text-emerald-300">
                    Criteria generated
                  </span>
                ) : null}
              </div>
            </div>

            {/* NESTED TAB 1: REVIEW */}
            {requirementsNestedTab === "review" ? (
              <div id="clarifications-section" className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium text-neutral-100">Requirement Review</h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      Review feature details and answer clarification questions before PRD generation.
                    </p>
                  </div>
                </div>

                {clarificationQuestions.length > 0 ? (
                  <div className="space-y-4">
                    {unansweredRequiredClarificationQuestions.length > 0 ? (
                      <div className="rounded-md border border-amber-900/60 bg-amber-950/30 p-3.5 text-sm text-amber-200">
                        <span className="font-semibold text-amber-400">Requirement Review needed:</span> Complete required open questions below to unlock PRD generation.
                      </div>
                    ) : (
                      <div className="rounded-md border border-emerald-900/60 bg-emerald-950/30 p-3.5 text-sm text-emerald-200 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-emerald-400">Requirement Review complete.</span> All required answers saved. MergeMint has enough context for PRD generation.
                        </div>
                        <button
                          type="button"
                          onClick={() => setRequirementsNestedTab("prd")}
                          className="rounded bg-emerald-400 px-3 py-1 text-xs font-medium text-neutral-950 transition hover:bg-emerald-300"
                        >
                          Go to PRD &rarr;
                        </button>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h3 className="text-sm font-medium uppercase tracking-wider text-neutral-400">
                        Open questions ({clarificationQuestions.length})
                      </h3>
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
                              <h4 className="font-medium text-neutral-100">
                                {question.question}
                              </h4>
                              <Badge>{formatQuestionPriority(question.priority)}</Badge>
                            </div>
                            {question.reason ? (
                              <p className="mt-2 text-sm text-neutral-400">
                                <span className="text-neutral-500">Reason:</span>{" "}
                                {question.reason}
                              </p>
                            ) : null}
                            {question.answer && !isEditing ? (
                              <div className="mt-3 space-y-2 rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3">
                                <p className="text-sm text-emerald-100">
                                  <span className="font-semibold text-emerald-400">Saved Answer:</span>{" "}
                                  {question.answer}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => editAnswer(question.id, question.answer ?? "")}
                                  disabled={answerClarification.isPending}
                                  className="rounded-md border border-emerald-800 px-2.5 py-1 text-xs font-medium text-emerald-200 transition hover:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Edit answer
                                </button>
                              </div>
                            ) : (
                              <div className="mt-3 space-y-3">
                                {isRequiredQuestionPriority(question.priority) ? (
                                  <p className="text-xs font-medium text-amber-400">
                                    &bull; Required before PRD generation
                                  </p>
                                ) : (
                                  <p className="text-xs text-neutral-500">
                                    &bull; Optional clarification context
                                  </p>
                                )}
                                {isEditing && prd ? (
                                  <p className="rounded-md border border-amber-800 bg-amber-950/30 p-2.5 text-xs text-amber-200">
                                    Updating this answer will mark the current PRD as outdated until regenerated.
                                  </p>
                                ) : null}
                                <textarea
                                  value={draft}
                                  onChange={(event) =>
                                    setAnswerDraft(question.id, event.target.value)
                                  }
                                  className="min-h-20 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-blue-500"
                                  placeholder="Type your answer here..."
                                />
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => saveAnswer(question.id)}
                                    disabled={!canSave}
                                    className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
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
                                      className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  ) : null}
                                </div>
                                {answerClarification.error &&
                                answerClarification.variables?.questionId === question.id ? (
                                  <p className="text-xs text-red-400">
                                    {answerClarification.error.message}
                                  </p>
                                ) : null}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-emerald-900/60 bg-emerald-950/20 p-4 text-sm text-emerald-200">
                    <p className="font-medium text-emerald-400">
                      Requirement Review complete. MergeMint has enough context to generate the PRD.
                    </p>
                    <p className="mt-1 text-xs text-emerald-300/80">
                      No further clarification questions are needed for this feature request.
                    </p>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setRequirementsNestedTab("prd")}
                        className="rounded bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-950 transition hover:bg-white"
                      >
                        Proceed to PRD Generation &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* NESTED TAB 2: PRD */}
            {requirementsNestedTab === "prd" ? (
              <div id="requirement-engine-section" className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium text-neutral-100">PRD</h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      Generate and inspect the Product Requirement Document artifact.
                    </p>
                  </div>
                  {latestAiRuns[0] ? (
                    <span className="rounded-full border border-blue-900/70 bg-blue-950/30 px-3 py-1 text-xs text-blue-200">
                      Latest AI: {latestAiRuns[0].model}
                    </span>
                  ) : null}
                </div>

                {/* Compact Blocked State / Warning Banners */}
                {prdMayBeOutdated ? (
                  <div className="rounded-md border border-amber-800 bg-amber-950/30 p-3.5 text-sm text-amber-200">
                    PRD may be outdated because a clarification answer changed. Regenerate the PRD before running QA or generating release evidence.
                  </div>
                ) : prdBlockedByClarifications ? (
                  <div className="rounded-md border border-red-900/70 bg-red-950/40 p-3.5 text-sm text-red-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-red-300">Blocked by Requirement Review:</span> Complete Requirement Review before generating PRD.
                    </div>
                    <button
                      type="button"
                      onClick={() => setRequirementsNestedTab("review")}
                      className="rounded bg-red-900 px-3 py-1 text-xs font-medium text-red-100 hover:bg-red-800"
                    >
                      Go to Requirement Review
                    </button>
                  </div>
                ) : null}

                {/* PRD Generation Controls */}
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => generatePrd.mutate({ featureRequestId: feature.id })}
                    disabled={
                      (hasPrd && !prdMayBeOutdated) ||
                      prdBlockedByClarifications ||
                      generatePrd.isPending
                    }
                    className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {hasPrd
                      ? prdMayBeOutdated
                        ? "Regenerate PRD"
                        : "PRD generated"
                      : prdBlockedByClarifications
                        ? "Blocked by Requirement Review"
                        : generatePrd.isPending
                          ? "Generating PRD..."
                          : "Generate PRD"}
                  </button>

                  <button
                    type="button"
                    onClick={() => (prd ? generateTasks.mutate({ prdId: prd.id }) : null)}
                    disabled={!prd || prdMayBeOutdated || hasTasks || generateTasks.isPending}
                    className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {hasTasks
                      ? "Engineering tasks generated"
                      : generateTasks.isPending
                        ? "Generating tasks..."
                        : "Generate engineering tasks"}
                  </button>
                </div>

                {generatePrd.error ? (
                  <p className="text-xs text-red-400">{generatePrd.error.message}</p>
                ) : null}

                {/* PRD Content View */}
                {prd ? (
                  <div className="mt-4 space-y-4 border-t border-neutral-800 pt-4">
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
                  <div className="rounded-md border border-neutral-800/80 bg-neutral-950 p-6 text-center">
                    <EmptyText>No PRD generated yet.</EmptyText>
                  </div>
                )}
              </div>
            ) : null}

            {/* NESTED TAB 3: SCOPE */}
            {requirementsNestedTab === "scope" ? (
              <div id="scope-section" className="mt-4 space-y-4">
                <div>
                  <h2 className="text-lg font-medium text-neutral-100">Scope & Structured Requirements</h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    High-level functional requirements categorized by priority and scope boundaries.
                  </p>
                </div>

                {prdRequirements.length > 0 || (prd && prd.nonGoals.length > 0) ? (
                  <div className="space-y-6">
                    {/* Must have */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-400" />
                        <h3 className="text-sm font-semibold text-neutral-200">Must have</h3>
                      </div>
                      {prdRequirements.filter((r) => r.priority === "P0" || r.priority === "high" || r.priority === "urgent").length > 0 ? (
                        <div className="space-y-2.5">
                          {prdRequirements
                            .filter((r) => r.priority === "P0" || r.priority === "high" || r.priority === "urgent")
                            .map((req) => (
                              <article key={req.id} className="rounded-md border border-neutral-800 bg-neutral-950 p-3.5">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-medium text-blue-400">{req.requirementKey}</p>
                                  <span className="rounded bg-red-950/80 px-2 py-0.5 text-[10px] font-semibold text-red-300 border border-red-900/60">Must have</span>
                                </div>
                                <p className="mt-1.5 text-sm text-neutral-100">{req.requirement}</p>
                              </article>
                            ))}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500 italic">No Must have requirements defined.</p>
                      )}
                    </div>

                    {/* Nice to have */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-400" />
                        <h3 className="text-sm font-semibold text-neutral-200">Nice to have</h3>
                      </div>
                      {prdRequirements.filter((r) => r.priority !== "P0" && r.priority !== "high" && r.priority !== "urgent").length > 0 ? (
                        <div className="space-y-2.5">
                          {prdRequirements
                            .filter((r) => r.priority !== "P0" && r.priority !== "high" && r.priority !== "urgent")
                            .map((req) => (
                              <article key={req.id} className="rounded-md border border-neutral-800 bg-neutral-950 p-3.5">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-medium text-blue-400">{req.requirementKey}</p>
                                  <span className="rounded bg-blue-950/80 px-2 py-0.5 text-[10px] font-semibold text-blue-300 border border-blue-900/60">Nice to have</span>
                                </div>
                                <p className="mt-1.5 text-sm text-neutral-100">{req.requirement}</p>
                              </article>
                            ))}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500 italic">No Nice to have requirements defined.</p>
                      )}
                    </div>

                    {/* Out of scope */}
                    {prd && prd.nonGoals && prd.nonGoals.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-neutral-500" />
                          <h3 className="text-sm font-semibold text-neutral-200">Out of scope</h3>
                        </div>
                        <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3.5">
                          <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-300">
                            {prd.nonGoals.map((item, index) => (
                              <li key={index}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : null}

                    {/* User stories */}
                    {prd && prd.userStories && prd.userStories.length > 0 ? (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-neutral-200">User stories</h3>
                        <div className="space-y-2.5">
                          {prd.userStories.map((story, index) => {
                            if (isRecord(story)) {
                              return (
                                <article key={index} className="rounded-md border border-neutral-800 bg-neutral-950 p-3.5 text-sm">
                                  <p className="text-neutral-200">
                                    <span className="font-medium text-neutral-400">As a</span>{" "}
                                    <span className="text-blue-300">{String(story.actor ?? "user")}</span>,{" "}
                                    <span className="font-medium text-neutral-400">I want</span>{" "}
                                    <span className="text-neutral-100">{String(story.want ?? "")}</span>{" "}
                                    <span className="font-medium text-neutral-400">so that</span>{" "}
                                    <span className="text-emerald-300">{String(story.benefit ?? "")}</span>.
                                  </p>
                                </article>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-md border border-neutral-800/80 bg-neutral-950 p-6 text-center">
                    <EmptyText>No scope or requirements generated yet.</EmptyText>
                  </div>
                )}
              </div>
            ) : null}

            {/* NESTED TAB 4: ACCEPTANCE CRITERIA */}
            {requirementsNestedTab === "acceptance_criteria" ? (
              <div id="acceptance-criteria-section" className="mt-4 space-y-4">
                <div>
                  <h2 className="text-lg font-medium text-neutral-100">Acceptance Criteria</h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    Testable verification criteria grouped by requirement ID.
                  </p>
                </div>

                {prdRequirements.length > 0 ? (
                  <div className="space-y-4">
                    {prdRequirements.map((requirement) => (
                      <article
                        key={requirement.id}
                        className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-900 pb-2.5">
                          <span className="rounded bg-blue-950/80 px-2 py-0.5 text-xs font-semibold text-blue-300 border border-blue-900/60">
                            {requirement.requirementKey}
                          </span>
                          <span className="text-xs text-neutral-400 font-medium">
                            {formatQuestionPriority(requirement.priority)}
                          </span>
                        </div>
                        <h3 className="mt-2.5 font-medium text-neutral-100 text-sm">
                          {requirement.requirement}
                        </h3>
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                            Testable Criteria:
                          </p>
                          {requirement.acceptanceCriteria && requirement.acceptanceCriteria.length > 0 ? (
                            <ul className="space-y-1.5">
                              {requirement.acceptanceCriteria.map((criterion, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-neutral-300">
                                  <span className="text-emerald-400 mt-0.5 text-xs">&check;</span>
                                  <span>{criterion}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-neutral-500 italic">No criteria specified for this requirement.</p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-neutral-800/80 bg-neutral-950 p-6 text-center">
                    <EmptyText>No acceptance criteria generated yet.</EmptyText>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "engineering_tasks" ? (
        <EngineeringTasksCommandCenter
          data={engineeringTaskCenter.data}
          fallbackTasks={engineeringTasks}
          hasPrd={hasPrd}
          prdMayBeOutdated={prdMayBeOutdated}
          isLoading={engineeringTaskCenter.isLoading}
          error={engineeringTaskCenter.error?.message}
          isGenerating={generateTasks.isPending || regenerateTasks.isPending}
          generateError={generateTasks.error?.message ?? regenerateTasks.error?.message}
          taskCopyMessage={taskCopyMessage}
          onGenerate={() => (prd ? generateTasks.mutate({ prdId: prd.id }) : null)}
          onRegenerate={() => regenerateTasks.mutate({ featureRequestId })}
          onUpdateStatus={(taskId, status) =>
            updateTaskStatus.mutate({
              taskId,
              status
            })
          }
          isUpdatingStatus={updateTaskStatus.isPending}
          onCopyDeveloperBrief={copyDeveloperBrief}
          onCopyAgentPayload={copyAgentPayload}
          isCopying={developerBrief.isFetching || agentPayload.isFetching}
        />
      ) : null}

      {activeTab === "pr" ? (
      <GitHubPullRequestSection
        data={linkedPullRequest.data}
        isLoading={linkedPullRequest.isLoading}
        error={linkedPullRequest.error?.message}
        projectId={feature.projectId}
        projectName={controlRoom.data?.project.name ?? "Project"}
        featureTitle={feature.title}
        pickerData={pullRequestPicker.data}
        pickerLoading={pullRequestPicker.isLoading}
        pickerError={pullRequestPicker.error?.message}
        prSearch={prSearch}
        setPrSearch={setPrSearch}
        prStateFilter={prStateFilter}
        setPrStateFilter={setPrStateFilter}
        onRefreshPicker={() => pullRequestPicker.refetch()}
        onSelectPullRequest={(prNumber) =>
          linkSelectedPullRequest.mutate({
            projectId: feature.projectId,
            featureRequestId,
            prNumber
          })
        }
        selectingPrNumber={
          linkSelectedPullRequest.isPending
            ? linkSelectedPullRequest.variables?.prNumber ?? null
            : null
        }
        selectError={linkSelectedPullRequest.error?.message}
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
        <>
          <AIQAReviewSection
            hasPrd={hasPrd}
            prdMayBeOutdated={prdMayBeOutdated}
            requirementsCount={qaRequirementsCount}
            hasPullRequestSnapshot={Boolean(linkedPullRequest.data?.latestSnapshot)}
            reviewBundle={latestQaReview.data}
            isLoading={latestQaReview.isLoading}
            error={latestQaReview.error?.message}
            onRun={() => runQaReview.mutate({ featureRequestId })}
            isRunning={runQaReview.isPending}
            runError={getFriendlyQaRunError(runQaReview.error?.message)}
            entitlement={billingEntitlement.data}
          />
          <ProofGatePanel
            data={proofGate.data}
            isLoading={proofGate.isLoading}
            error={proofGate.error?.message}
            onPublish={() => publishGitHubProof.mutate({ featureRequestId })}
            isPublishing={publishGitHubProof.isPending}
            publishError={publishGitHubProof.error?.message}
          />
        </>
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

function EngineeringTasksCommandCenter({
  data,
  fallbackTasks,
  hasPrd,
  prdMayBeOutdated,
  isLoading,
  error,
  isGenerating,
  generateError,
  taskCopyMessage,
  onGenerate,
  onRegenerate,
  onUpdateStatus,
  isUpdatingStatus,
  onCopyDeveloperBrief,
  onCopyAgentPayload,
  isCopying
}: {
  data:
    | {
        tasks: EngineeringTaskCardView[];
        grouped: Record<string, EngineeringTaskCardView[]>;
        summary: {
          total: number;
          done: number;
          blocked: number;
          highRisk: number;
        };
        repoAware: boolean;
      }
    | undefined;
  fallbackTasks: EngineeringTaskCardView[];
  hasPrd: boolean;
  prdMayBeOutdated: boolean;
  isLoading: boolean;
  error?: string;
  isGenerating: boolean;
  generateError?: string;
  taskCopyMessage: string | null;
  onGenerate: () => void;
  onRegenerate: () => void;
  onUpdateStatus: (
    taskId: string,
    status: "todo" | "in_progress" | "blocked" | "done" | "skipped"
  ) => void;
  isUpdatingStatus: boolean;
  onCopyDeveloperBrief: () => void;
  onCopyAgentPayload: () => void;
  isCopying: boolean;
}) {
  const tasks = data?.tasks ?? fallbackTasks;
  const grouped = data?.grouped ?? groupTaskCards(tasks);
  const summary =
    data?.summary ?? {
      total: tasks.length,
      done: tasks.filter((task) => task.status === "done").length,
      blocked: tasks.filter((task) => task.status === "blocked").length,
      highRisk: tasks.filter((task) => task.riskLevel === "high").length
    };
  const groups: Array<{
    id: "todo" | "in_progress" | "blocked" | "done" | "skipped";
    label: string;
  }> = [
    { id: "todo", label: "To do" },
    { id: "in_progress", label: "In progress" },
    { id: "blocked", label: "Blocked" },
    { id: "done", label: "Done" },
    { id: "skipped", label: "Skipped" }
  ];

  return (
    <section
      id="engineering-tasks-command-center"
      className="space-y-5 scroll-mt-28"
    >
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-blue-300">
              Engineering Tasks Command Center
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-100">
              Build plan
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
              Track what needs to be built before PR review, how each task maps
              to requirements, and which files or modules are likely involved.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tasks.length === 0 ? (
              <button
                type="button"
                onClick={onGenerate}
                disabled={!hasPrd || prdMayBeOutdated || isGenerating}
                className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? "Generating..." : "Generate tasks"}
              </button>
            ) : (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={!hasPrd || prdMayBeOutdated || isGenerating}
                className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? "Regenerating..." : "Regenerate tasks"}
              </button>
            )}
            <button
              type="button"
              onClick={onCopyDeveloperBrief}
              disabled={tasks.length === 0 || isCopying}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Copy Developer Handoff
            </button>
            <button
              type="button"
              onClick={onCopyAgentPayload}
              disabled={tasks.length === 0 || isCopying}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Copy Coding Agent Prompt
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-neutral-400 border-t border-neutral-800/60 pt-2.5">
            <p><span className="font-semibold text-neutral-300">Developer Handoff:</span> plain-language task brief for a human engineer.</p>
            <p><span className="font-semibold text-neutral-300">Coding Agent Prompt:</span> structured prompt for Codex, Cursor, Copilot, or Antigravity.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-5">
          <MiniMetric label="Total" value={summary.total} />
          <MiniMetric label="Done" value={summary.done} />
          <MiniMetric label="Blocked" value={summary.blocked} />
          <MiniMetric label="High risk" value={summary.highRisk} />
          <MiniMetric label="Repo-aware" value={data?.repoAware ? "Yes" : "No" } />
        </div>

        {taskCopyMessage ? (
          <p className="mt-4 text-sm text-emerald-300">{taskCopyMessage}</p>
        ) : null}
        {isLoading ? <p className="mt-4 text-sm text-neutral-500">Loading tasks...</p> : null}
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        {generateError ? (
          <p className="mt-4 text-sm text-red-300">{generateError}</p>
        ) : null}
        {!hasPrd ? (
          <p className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">
            Generate the PRD before creating engineering tasks.
          </p>
        ) : null}
        {prdMayBeOutdated ? (
          <p className="mt-4 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
            PRD is outdated. Regenerate the PRD before regenerating tasks.
          </p>
        ) : null}
      </div>

      {tasks.length === 0 && !isLoading ? (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
          <EmptyText>
            Generate engineering tasks from the PRD to create a build plan.
          </EmptyText>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((group) => (
          <section
            key={group.id}
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium text-neutral-100">{group.label}</h3>
              <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400">
                {(grouped[group.id] ?? []).length}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {(grouped[group.id] ?? []).map((task) => (
                <EngineeringTaskCard
                  key={task.id}
                  task={task}
                  onUpdateStatus={onUpdateStatus}
                  isUpdatingStatus={isUpdatingStatus}
                />
              ))}
              {(grouped[group.id] ?? []).length === 0 ? (
                <p className="text-sm text-neutral-500">No tasks.</p>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

type EngineeringTaskCardView = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  status: string;
  priority?: string;
  riskLevel?: string;
  relatedRequirementKeys: string[];
  acceptanceCriteriaRefs?: string[];
  acceptanceChecklist: string[];
  suggestedFiles?: string[];
  suggestedModules?: string[];
  implementationNotes?: string | null;
  verificationNotes?: string | null;
  complexity?: string;
};

function EngineeringTaskCard({
  task,
  onUpdateStatus,
  isUpdatingStatus
}: {
  task: EngineeringTaskCardView;
  onUpdateStatus: (
    taskId: string,
    status: "todo" | "in_progress" | "blocked" | "done" | "skipped"
  ) => void;
  isUpdatingStatus: boolean;
}) {
  return (
    <article className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-medium text-neutral-100">{task.title}</h4>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            {task.description || "No description."}
          </p>
        </div>
        <select
          value={task.status === "canceled" ? "skipped" : task.status}
          onChange={(event) =>
            onUpdateStatus(
              task.id,
              event.target.value as
                | "todo"
                | "in_progress"
                | "blocked"
                | "done"
                | "skipped"
            )
          }
          disabled={isUpdatingStatus}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{task.type}</Badge>
        <Badge>{task.priority ?? "must_have"}</Badge>
        <Badge>{task.riskLevel ?? task.complexity ?? "medium"} risk</Badge>
        {task.relatedRequirementKeys.map((key) => (
          <Badge key={key}>{key}</Badge>
        ))}
      </div>
      <StringList
        title="Suggested files"
        items={task.suggestedFiles ?? []}
        emptyText="No suggested files."
      />
      <StringList
        title="Suggested modules"
        items={task.suggestedModules ?? []}
        emptyText="No suggested modules."
      />
      <StringList
        title="Related acceptance criteria"
        items={task.acceptanceCriteriaRefs ?? []}
        emptyText="No acceptance criteria mapped."
      />
      {task.implementationNotes ? (
        <p className="mt-3 text-sm text-neutral-400">
          Implementation: {task.implementationNotes}
        </p>
      ) : null}
      {task.verificationNotes ? (
        <p className="mt-2 text-sm text-neutral-400">
          Verification: {task.verificationNotes}
        </p>
      ) : null}
      <StringList
        title="Acceptance checklist"
        items={task.acceptanceChecklist}
        emptyText="No acceptance checklist."
      />
    </article>
  );
}

function groupTaskCards(tasks: EngineeringTaskCardView[]) {
  return {
    todo: tasks.filter((task) => task.status === "todo"),
    in_progress: tasks.filter((task) => task.status === "in_progress"),
    blocked: tasks.filter((task) => task.status === "blocked"),
    done: tasks.filter((task) => task.status === "done"),
    skipped: tasks.filter(
      (task) => task.status === "skipped" || task.status === "canceled"
    )
  };
}

function FeatureWorkflowGuide({
  workflow,
  onAction,
  isBusy
}: {
  workflow: {
    status: string;
    title: string;
    description: string;
    primaryActionLabel: string;
    primaryActionHref?: string;
    primaryActionKey?: string;
    blockedReason?: string;
    completionPercentage: number;
    steps: Array<{
      id: string;
      label: string;
      status: "completed" | "current" | "blocked" | "upcoming";
    }>;
  };
  onAction: (actionKey?: string) => void;
  isBusy: boolean;
}) {
  return (
    <section className="rounded-lg border border-emerald-300/25 bg-emerald-300/[0.055] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-emerald-200">
              Guided release workflow
            </p>
            <span className="rounded-full border border-emerald-300/25 px-2.5 py-1 text-xs text-emerald-100">
              {workflow.status.replaceAll("_", " ")}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-100">
            {workflow.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
            {workflow.description}
          </p>
          {workflow.blockedReason ? (
            <p className="mt-3 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
              {workflow.blockedReason}
            </p>
          ) : null}
        </div>

        {workflow.primaryActionHref ? (
          <Link
            href={workflow.primaryActionHref}
            className="shrink-0 rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-neutral-950 transition hover:bg-neutral-100"
          >
            {workflow.primaryActionLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onAction(workflow.primaryActionKey)}
            disabled={isBusy}
            className="shrink-0 rounded-md bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? "Working..." : workflow.primaryActionLabel}
          </button>
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Release Checklist progress</span>
          <span>{workflow.completionPercentage}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-black/40">
          <div
            className="h-2 rounded-full bg-emerald-300"
            style={{ width: `${workflow.completionPercentage}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {workflow.steps.map((step) => (
          <div
            key={step.id}
            className={
              step.status === "current"
                ? "rounded-md border border-blue-400/35 bg-blue-400/10 p-3"
                : step.status === "blocked"
                  ? "rounded-md border border-amber-500/35 bg-amber-500/10 p-3"
                  : step.status === "completed"
                    ? "rounded-md border border-emerald-400/25 bg-emerald-400/10 p-3"
                    : "rounded-md border border-neutral-800 bg-neutral-950/70 p-3"
            }
          >
            <p className="text-sm font-medium text-neutral-100">{step.label}</p>
            <p className="mt-1 text-xs capitalize text-neutral-500">
              {step.status}
            </p>
          </div>
        ))}
      </div>
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

function FeatureHierarchyHeader({
  feature,
  controlRoom,
  prdMayBeOutdated
}: {
  feature: {
    title: string;
    description: string;
    priority: string;
    status: string;
  };
  controlRoom?: ReleaseControlRoomView;
  prdMayBeOutdated: boolean;
}) {
  const projectName = controlRoom?.project.name ?? "Project loading";
  const projectHref = controlRoom?.project.id
    ? `/app/projects/${controlRoom.project.id}`
    : "/app/projects";
  const clientName =
    controlRoom?.client?.companyName ??
    controlRoom?.client?.name ??
    controlRoom?.project.clientName ??
    null;
  const repositoryName = controlRoom?.prEvidence?.repo ?? "No PR linked yet";
  const currentStep =
    controlRoom?.progress.find((step) => step.status === "current") ??
    controlRoom?.progress.find((step) => step.status === "blocked");
  const readiness = prdMayBeOutdated
    ? "PRD outdated"
    : controlRoom?.releaseReadinessStatus ?? "Preparing";
  const nextAction = controlRoom?.nextBestAction.title ?? "Load release workflow";

  return (
    <header className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <Link href="/app/projects" className="transition hover:text-neutral-300">
          Projects
        </Link>
        <span>/</span>
        <Link href={projectHref} className="transition hover:text-neutral-300">
          {projectName}
        </Link>
        <span>/</span>
        <Link href="/app/features" className="transition hover:text-neutral-300">
          Features
        </Link>
        <span>/</span>
        <span className="text-neutral-300">{feature.title}</span>
      </nav>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-blue-400">
            Feature release workflow
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-100">
            {feature.title}
          </h1>
          <p className="mt-3 max-w-3xl text-neutral-400">
            {feature.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{feature.priority}</Badge>
          <Badge>{feature.status}</Badge>
          <StatusBadge status={readiness} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ContextTile label="Project" value={projectName} detail={clientName ?? "No client ledger"} />
        <ContextTile label="Repository / PR" value={repositoryName} detail="Project repo drives PR evidence" />
        <ContextTile
          label="Workflow step"
          value={currentStep?.label ?? "Not started"}
          detail={currentStep?.blockedReason ?? currentStep?.status ?? "Ready for setup"}
        />
        <ContextTile label="Next action" value={nextAction} detail={readiness} />
      </div>
    </header>
  );
}

function ContextTile({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-medium text-neutral-100">
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{detail}</p>
    </div>
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

  const hasPrd = Boolean(
    data.progress.find((s) => s.id === "prd" && s.status === "complete")
  );
  const hasPr = Boolean(
    data.prEvidence?.pullRequestId ||
      data.progress.find((s) => s.id === "pr" && s.status === "complete")
  );
  const hasQa = Boolean(
    data.qaReview ||
      data.progress.find((s) => s.id === "qa_review" && s.status === "complete")
  );
  const hasApproval = Boolean(
    data.humanApproval?.decision === "approved" ||
      data.humanApproval?.decision === "approved_with_risk"
  );
  const hasReport = Boolean(
    data.releaseReport ||
      data.progress.find(
        (s) => s.id === "release_report" && s.status === "complete"
      )
  );

  const releaseChecklistGroups = [
    {
      title: "Setup",
      items: [
        {
          label: "Repository connected",
          complete: Boolean(data.prEvidence?.repo || data.project.name)
        },
        { label: "Repository analyzed", complete: true }
      ]
    },
    {
      title: "Requirement",
      items: [
        {
          label: "Requirement Review complete",
          complete:
            !prdStep?.blockedReason?.includes("Requirement Review") &&
            !prdMayBeOutdated
        },
        { label: "PRD generated", complete: hasPrd },
        { label: "Acceptance criteria ready", complete: hasPrd }
      ]
    },
    {
      title: "Build",
      items: [
        { label: "Engineering tasks generated", complete: hasPrd },
        { label: "PR linked", complete: hasPr }
      ]
    },
    {
      title: "Verify",
      items: [
        { label: "QA review complete", complete: hasQa },
        {
          label: "Risks resolved",
          complete:
            hasQa &&
            data.riskSummary.unresolvedFindingsCount === 0 &&
            !data.prEvidence?.rereviewRequired
        }
      ]
    },
    {
      title: "Ship",
      items: [
        { label: "Human approval complete", complete: hasApproval },
        { label: "Release report generated", complete: hasReport }
      ]
    }
  ];

  const totalChecklistItems = releaseChecklistGroups.flatMap((g) => g.items).length;
  const readyChecklistItems = releaseChecklistGroups
    .flatMap((g) => g.items)
    .filter((i) => i.complete).length;

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
            {data.prEvidence?.rereviewRequired ? (
              <StatusBadge status="Re-review required" />
            ) : null}
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

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
            <h3 className="text-base font-medium text-neutral-100">
              Release Checklist
            </h3>
            <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-0.5 text-xs text-neutral-400 font-medium">
              {readyChecklistItems} of {totalChecklistItems} ready
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {releaseChecklistGroups.map((group) => (
              <div
                key={group.title}
                className="rounded-md border border-neutral-800 bg-neutral-900/80 p-3"
              >
                <h4 className="border-b border-neutral-800/80 pb-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
                  {group.title}
                </h4>
                <ul className="mt-2.5 space-y-2">
                  {group.items.map((item) => (
                    <li key={item.label} className="flex items-start gap-1.5 text-xs">
                      <span
                        className={
                          item.complete
                            ? "font-bold text-emerald-400 shrink-0"
                            : "font-bold text-neutral-600 shrink-0"
                        }
                      >
                        {item.complete ? "✓" : "○"}
                      </span>
                      <span
                        className={
                          item.complete
                            ? "text-neutral-200"
                            : "text-neutral-400"
                        }
                      >
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-blue-900/50 bg-blue-950/20 p-4">
          <p className="text-sm text-blue-300">Release Focus</p>
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
        {evidence ? (
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={evidence.state} />
            <StatusBadge status={evidence.ciStatus} />
            {evidence.rereviewRequired ? (
              <StatusBadge status="Re-review required" />
            ) : null}
          </div>
        ) : null}
      </div>
      {evidence ? (
        <div className="mt-4 space-y-3">
          {evidence.rereviewRequired ? (
            <p className="rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
              PR updated after last QA review. Re-review required before approval
              or release reporting.
            </p>
          ) : null}
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
            <p className="sm:col-span-2">
              Latest QA review:{" "}
              {evidence.latestReviewAt
                ? formatDate(evidence.latestReviewAt)
                : "Not reviewed"}
            </p>
          </div>
          {evidence.latestWebhookEvent ? (
            <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm">
              <p className="font-medium text-neutral-200">GitHub activity</p>
              <p className="mt-1 text-neutral-500">
                {evidence.latestWebhookEvent.action ??
                  evidence.latestWebhookEvent.eventType}{" "}
                webhook {evidence.latestWebhookEvent.status} at{" "}
                {formatDate(evidence.latestWebhookEvent.receivedAt)}
              </p>
            </div>
          ) : null}
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
  projectId,
  projectName,
  featureTitle,
  pickerData,
  pickerLoading,
  pickerError,
  prSearch,
  setPrSearch,
  prStateFilter,
  setPrStateFilter,
  onRefreshPicker,
  onSelectPullRequest,
  selectingPrNumber,
  selectError,
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
        latestWebhookEvent: {
          eventType: string;
          action: string | null;
          status: string;
          receivedAt: Date | string;
          processedAt: Date | string | null;
          errorMessage: string | null;
          payloadSummary: Record<string, unknown> | null;
        } | null;
        latestQaReview: {
          id: string;
          reviewVersion: number;
          createdAt: Date | string;
        } | null;
        prUpdatedAfterLastReview: boolean;
        rereviewRequired: boolean;
      }
    | null
    | undefined;
  isLoading: boolean;
  error?: string;
  projectId: string;
  projectName: string;
  featureTitle: string;
  pickerData:
    | {
        repository: {
          fullName: string;
          defaultBranch: string;
        };
        pullRequests: Array<{
          number: number;
          title: string;
          state: string;
          draft: boolean;
          authorLogin: string | null;
          headBranch: string;
          baseBranch: string;
          createdAt: string | null;
          updatedAt: string | null;
          htmlUrl: string;
          changedFiles: number | null;
          additions: number | null;
          deletions: number | null;
        }>;
      }
    | undefined;
  pickerLoading: boolean;
  pickerError?: string;
  prSearch: string;
  setPrSearch: (value: string) => void;
  prStateFilter: "open" | "closed" | "all";
  setPrStateFilter: (value: "open" | "closed" | "all") => void;
  onRefreshPicker: () => void;
  onSelectPullRequest: (prNumber: number) => void;
  selectingPrNumber?: number | null;
  selectError?: string;
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
          <div>
            <h3 className="font-medium text-neutral-100">Select pull request</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Choose the PR from this project&apos;s connected repository.
            </p>
          </div>
          <div className="grid gap-3 rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400 md:grid-cols-2">
            <p>Project: {projectName}</p>
            <p>Feature: {featureTitle}</p>
            <p>
              Repository: {pickerData?.repository.fullName ?? "Connect a repo first"}
            </p>
            <p>
              Default branch: {pickerData?.repository.defaultBranch ?? "unknown"}
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              value={prSearch}
              onChange={(event) => setPrSearch(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-blue-500"
              placeholder="Search PR title, number, branch, or author"
            />
            <select
              value={prStateFilter}
              onChange={(event) =>
                setPrStateFilter(event.target.value as "open" | "closed" | "all")
              }
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-blue-500"
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="all">All</option>
            </select>
            <button
              type="button"
              onClick={onRefreshPicker}
              disabled={pickerLoading}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pickerLoading ? "Refreshing..." : "Refresh PRs"}
            </button>
          </div>

          {pickerLoading ? <EmptyText>Loading pull requests...</EmptyText> : null}
          {pickerError ? <p className="text-sm text-red-300">{pickerError}</p> : null}
          {selectError ? <p className="text-sm text-red-300">{selectError}</p> : null}

          {!pickerLoading && pickerData?.pullRequests.length === 0 ? (
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
              No pull requests matched. Try another filter or use the advanced URL
              fallback if GitHub App access is unavailable.
            </div>
          ) : null}

          <div className="space-y-3">
            {pickerData?.pullRequests.map((pullRequest) => {
              const isThisCardSelecting = selectingPrNumber === pullRequest.number;
              return (
                <article
                  key={pullRequest.number}
                  className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-neutral-100">
                        #{pullRequest.number} {pullRequest.title}
                      </h3>
                      <p className="mt-1 text-sm text-neutral-500">
                        {pullRequest.headBranch} {"->"} {pullRequest.baseBranch}
                        {pullRequest.authorLogin ? ` by ${pullRequest.authorLogin}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Updated{" "}
                        {pullRequest.updatedAt
                          ? formatDate(pullRequest.updatedAt)
                          : "unknown"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{pullRequest.state}</Badge>
                      {pullRequest.draft ? <Badge>draft</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectPullRequest(pullRequest.number)}
                      disabled={selectingPrNumber != null}
                      className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isThisCardSelecting ? "Linking..." : "Link PR"}
                    </button>
                    <a
                      href={pullRequest.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:border-neutral-500"
                    >
                      Open on GitHub
                    </a>
                  </div>
                </article>
              );
            })}
          </div>

          <details className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
            <summary className="cursor-pointer text-sm font-medium text-neutral-300">
              Advanced: paste PR URL manually
            </summary>
            <p className="mt-3 text-sm text-neutral-500">
              Use this only if the PR is outside the connected repository or
              GitHub App access is unavailable.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
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
                className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLinking ? "Linking..." : "Link manually"}
              </button>
            </div>
            {linkError ? <p className="mt-3 text-sm text-red-300">{linkError}</p> : null}
          </details>
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
                {data.rereviewRequired ? (
                  <StatusBadge status="Re-review required" />
                ) : null}
              </div>
            </div>

            {data.rereviewRequired ? (
              <p className="mt-4 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
                PR updated after last QA review. Re-review required; webhook
                sync does not run AI automatically.
              </p>
            ) : null}

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
              <p>
                <span className="text-neutral-500">Last PR sync:</span>{" "}
                {data.latestSnapshot
                  ? formatDate(data.latestSnapshot.createdAt)
                  : "Not captured"}
              </p>
              <p>
                <span className="text-neutral-500">Latest QA review:</span>{" "}
                {data.latestQaReview
                  ? formatDate(data.latestQaReview.createdAt)
                  : "Not reviewed"}
              </p>
            </div>

            {data.latestWebhookEvent ? (
              <div className="mt-4 rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-neutral-200">
                      Latest GitHub webhook
                    </p>
                    <p className="mt-1 text-neutral-500">
                      {data.latestWebhookEvent.action ??
                        data.latestWebhookEvent.eventType}{" "}
                      from GitHub at{" "}
                      {formatDate(data.latestWebhookEvent.receivedAt)}
                    </p>
                  </div>
                  <StatusBadge status={data.latestWebhookEvent.status} />
                </div>
              </div>
            ) : null}

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

type ProofGateView = {
  pullRequest: {
    number: number;
    title: string;
    url: string;
    latestCommitSha: string | null;
    repository: string | null;
  } | null;
  latestQaReview: {
    id: string;
    overallStatus: string;
    readinessScore: number | null;
    confidenceScore: number | null;
    reviewVersion: number;
    createdAt: Date | string;
  } | null;
  coverageMap: {
    summary: {
      total: number;
      covered: number;
      partial: number;
      missing: number;
      notApplicable: number;
      needsHumanApproval: number;
    };
    rows: Array<{
      requirementId: string;
      requirementText: string;
      status: string;
      evidenceSummary: string;
      relatedEngineeringTask: {
        id: string;
        title: string;
        status: string;
      } | null;
      relatedFiles: string[];
      severity: string;
      suggestedNextAction: string;
      confidence: number | null;
    }>;
  };
  developerFixPack: {
    summary: string;
    whyItMatters: string;
    impactedRequirements: string[];
    likelyFiles: string[];
    blocking: Array<{
      title: string;
      requirementKey: string | null;
      description: string;
      suggestedFix: string | null;
      file: string | null;
      line: number | null;
    }>;
    nonBlocking: Array<{
      title: string;
      requirementKey: string | null;
      description: string;
      suggestedFix: string | null;
      file: string | null;
      line: number | null;
    }>;
    suggestedTests: string[];
    fixPrompt: string;
    reReviewChecklist: string[];
  };
  evidenceGraph: Array<{
    id: string;
    label: string;
    status: string;
    timestamp: Date | string | null;
    href: string | null;
  }>;
  findingCounts: {
    blocking: number;
    nonBlocking: number;
    open: number;
  };
  mergeRecommendation: string;
  verdict: string;
  githubAccess: {
    ok: boolean;
    reason:
      | "github_app_not_installed"
      | "repo_not_selected"
      | "missing_permissions"
      | "pr_not_found"
      | "token_resolution_failed"
      | "github_api_error"
      | null;
    message: string | null;
    connectUrl: string | null;
    updateUrl: string | null;
    canUseDevFallback: boolean;
  };
  stale: boolean;
  reportUrl: string | null;
  proof: {
    commentId: number | null;
    statusContext: string | null;
    lastPublishStatus: string;
    lastPublishReason: string | null;
    lastPublishError: string | null;
    lastPublishedCommitSha: string | null;
    lastPublishedAt: Date | string | null;
  } | null;
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

function ProofGatePanel({
  data,
  isLoading,
  error,
  onPublish,
  isPublishing,
  publishError
}: {
  data: ProofGateView | null | undefined;
  isLoading: boolean;
  error?: string;
  onPublish: () => void;
  isPublishing: boolean;
  publishError?: string;
}) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  async function copyFixPrompt() {
    if (!data?.developerFixPack.fixPrompt) {
      return;
    }

    await navigator.clipboard.writeText(data.developerFixPack.fixPrompt);
    setCopyMessage("Fix prompt copied");
    window.setTimeout(() => setCopyMessage(null), 1800);
  }

  const canPublish = Boolean(
    data?.pullRequest &&
      data.latestQaReview &&
      data.githubAccess.ok &&
      !isPublishing
  );
  const publishLabel = data?.proof?.commentId
    ? "Update GitHub Proof"
    : "Publish Proof to GitHub";
  const showConnectCta =
    data?.githubAccess.reason === "github_app_not_installed" ||
    (!data?.githubAccess.updateUrl && Boolean(data?.githubAccess.connectUrl));
  const showUpdateCta =
    data?.githubAccess.reason === "repo_not_selected" ||
    data?.githubAccess.reason === "missing_permissions" ||
    data?.githubAccess.reason === "token_resolution_failed";

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">GitHub Proof Gate</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Publish the latest MergeMint verification as one sticky GitHub PR
            comment and commit status.
          </p>
        </div>
        <button
          type="button"
          onClick={onPublish}
          disabled={!canPublish}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPublishing ? "Publishing..." : publishLabel}
        </button>
      </div>

      {isLoading ? <EmptyText>Loading proof gate...</EmptyText> : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {publishError ? (
        <p className="mt-3 text-sm text-red-300">{publishError}</p>
      ) : null}

      {data ? (
        <div className="mt-5 space-y-5">
          {!data.githubAccess.ok ? (
            <div className="rounded-md border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-100">
              <p className="font-semibold">
                {data.githubAccess.message ??
                  "GitHub access needs attention before proof can be published."}
              </p>
              <p className="mt-2 text-xs text-amber-200/80">
                Reason: {data.githubAccess.reason ?? "unknown"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {showConnectCta && data.githubAccess.connectUrl ? (
                  <a
                    href={data.githubAccess.connectUrl}
                    className="rounded-md bg-amber-200 px-3 py-2 text-xs font-semibold text-amber-950"
                  >
                    Connect GitHub App
                  </a>
                ) : null}
                {showUpdateCta && data.githubAccess.updateUrl ? (
                  <a
                    href={data.githubAccess.updateUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-amber-200 px-3 py-2 text-xs font-semibold text-amber-950"
                  >
                    Update GitHub App Access
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={onPublish}
                  disabled={isPublishing}
                  className="rounded-md border border-amber-700 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-900/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPublishing ? "Retrying..." : "Retry Publish Proof"}
                </button>
              </div>
            </div>
          ) : null}

          {data.stale ? (
            <p className="rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
              This PR changed after the latest MergeMint review. Re-run QA
              before publishing proof.
            </p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-4">
            <Score label="Readiness" value={data.latestQaReview?.readinessScore ?? null} />
            <MetricCard label="Verdict" value={data.verdict} />
            <MetricCard label="Merge" value={data.mergeRecommendation} />
            <MetricCard
              label="Proof"
              value={data.proof?.lastPublishStatus ?? "Not posted"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-neutral-100">
                    Requirement Coverage Map
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    REQ-ID to task, PR evidence, status, and next action.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{data.coverageMap.summary.covered} covered</Badge>
                  <Badge>{data.coverageMap.summary.partial} partial</Badge>
                  <Badge>{data.coverageMap.summary.missing} missing</Badge>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {data.coverageMap.rows.length > 0 ? (
                  data.coverageMap.rows.map((row) => (
                    <div
                      key={row.requirementId}
                      className="rounded-md border border-neutral-800 bg-neutral-900/70 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-blue-300">
                            {row.requirementId}
                          </p>
                          <p className="mt-1 text-sm text-neutral-300">
                            {row.requirementText}
                          </p>
                        </div>
                        <StatusBadge status={row.status} />
                      </div>
                      <p className="mt-3 text-sm text-neutral-400">
                        Evidence: {row.evidenceSummary}
                      </p>
                      {row.relatedEngineeringTask ? (
                        <p className="mt-2 text-xs text-neutral-500">
                          Task: {row.relatedEngineeringTask.title}
                        </p>
                      ) : null}
                      {row.relatedFiles.length > 0 ? (
                        <p className="mt-2 text-xs text-neutral-500">
                          Files: {row.relatedFiles.slice(0, 4).join(", ")}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-amber-200">
                        Next: {row.suggestedNextAction}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyText>No PRD requirements found for coverage mapping.</EmptyText>
                )}
              </div>
            </article>

            <div className="space-y-4">
              <article className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
                <h3 className="font-medium text-neutral-100">Developer Fix Pack</h3>
                <p className="mt-2 text-sm text-neutral-400">
                  {data.developerFixPack.summary}
                </p>
                <div className="mt-3 grid gap-2 text-sm text-neutral-400">
                  <p>Blocking: {data.developerFixPack.blocking.length}</p>
                  <p>Non-blocking: {data.developerFixPack.nonBlocking.length}</p>
                  <p>
                    Impacted requirements:{" "}
                    {data.developerFixPack.impactedRequirements.join(", ") ||
                      "None"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyFixPrompt}
                  className="mt-4 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 transition hover:bg-neutral-800"
                >
                  Copy Fix Prompt
                </button>
                {copyMessage ? (
                  <p className="mt-2 text-xs text-emerald-300">{copyMessage}</p>
                ) : null}
                <StringList
                  title="Suggested tests"
                  items={data.developerFixPack.suggestedTests}
                  emptyText="No suggested tests recorded."
                />
              </article>

              <article className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
                <h3 className="font-medium text-neutral-100">
                  Release Evidence Graph
                </h3>
                <div className="mt-3 space-y-2">
                  {data.evidenceGraph.map((node) => (
                    <div
                      key={node.id}
                      className="flex items-center justify-between gap-3 rounded-md bg-neutral-900 px-3 py-2 text-sm"
                    >
                      <span className="text-neutral-200">{node.label}</span>
                      <Badge>{node.status}</Badge>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>

          <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
            <div className="grid gap-2 md:grid-cols-2">
              <p>
                Linked PR:{" "}
                {data.pullRequest ? (
                  <Link
                    href={data.pullRequest.url}
                    target="_blank"
                    className="text-blue-300 hover:text-blue-200"
                  >
                    #{data.pullRequest.number} {data.pullRequest.title}
                  </Link>
                ) : (
                  "Not linked"
                )}
              </p>
              <p>
                GitHub check/status:{" "}
                {data.proof?.statusContext
                  ? `${data.proof.statusContext} (${data.proof.lastPublishStatus})`
                  : "Not created"}
              </p>
              <p>
                Last published:{" "}
                {data.proof?.lastPublishedAt
                  ? formatDate(data.proof.lastPublishedAt)
                  : "Never"}
              </p>
              <p>
                Report:{" "}
                {data.reportUrl ? (
                  <Link
                    href={data.reportUrl}
                    className="text-blue-300 hover:text-blue-200"
                  >
                    Open report
                  </Link>
                ) : (
                  "Not generated"
                )}
              </p>
            </div>
            {data.proof?.lastPublishError ? (
              <p className="mt-3 text-red-300">
                {data.proof.lastPublishReason
                  ? `${data.proof.lastPublishReason}: `
                  : ""}
                {data.proof.lastPublishError}
              </p>
            ) : null}
          </div>
        </div>
      ) : !isLoading ? (
        <EmptyText>Run QA review to prepare GitHub proof.</EmptyText>
      ) : null}
    </section>
  );
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
  runError,
  entitlement
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
  entitlement?: {
    planKey: string;
    status: string;
    prLimit: number;
    prUsed: number;
    remainingCredits: number;
    upgradeRequired: boolean;
  };
}) {
  const ready =
    hasPrd && !prdMayBeOutdated && requirementsCount > 0 && hasPullRequestSnapshot;
  const hasExistingReview = Boolean(reviewBundle);
  const creditsExhausted = Boolean(entitlement?.upgradeRequired && !hasExistingReview);
  const canRun = ready && !isRunning && !prdMayBeOutdated && !creditsExhausted;

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
        {entitlement ? (
          <div className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-right text-xs text-neutral-400">
            <p className="font-semibold text-neutral-100">
              {entitlement.remainingCredits} PR review credits remaining
            </p>
            <p>
              {entitlement.planKey === "free"
                ? "1 free PR review included"
                : `${entitlement.prUsed}/${entitlement.prLimit} used`}
            </p>
          </div>
        ) : null}
        {ready ? (
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning
              ? "Running..."
              : hasExistingReview
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
      ) : creditsExhausted ? (
        <div className="mt-4 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-100">
          <p>
            You've used your available PR review credits. Upgrade your plan or
            contact us for manual access.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/app/billing"
              className="rounded-md bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-950"
            >
              Upgrade
            </Link>
            <Link
              href="/pricing"
              className="rounded-md border border-amber-700 px-3 py-1.5 text-xs font-semibold text-amber-100"
            >
              View pricing
            </Link>
          </div>
        </div>
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-neutral-100">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();
  const classes =
    normalizedStatus === "covered" ||
    normalizedStatus === "passed" ||
    normalizedStatus === "success" ||
    normalizedStatus === "processed" ||
    normalizedStatus === "open" ||
    normalizedStatus === "merged"
      ? "border-emerald-800 bg-emerald-950/30 text-emerald-200"
      : normalizedStatus === "partial" ||
          normalizedStatus === "needs_changes" ||
          normalizedStatus === "pending" ||
          normalizedStatus === "ignored" ||
          normalizedStatus === "re-review required"
        ? "border-amber-800 bg-amber-950/30 text-amber-200"
        : normalizedStatus === "missing" ||
            normalizedStatus === "failed" ||
            normalizedStatus === "failure" ||
            normalizedStatus === "closed"
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
