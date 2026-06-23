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

const approvalOptions: Array<{
  value: ApprovalDecision;
  label: string;
}> = [
  { value: "approved", label: "Approve" },
  { value: "approved_with_risk", label: "Approve with risk" },
  { value: "changes_requested", label: "Request changes" },
  { value: "rejected", label: "Reject" }
];

export function FeatureDetailClient({
  featureRequestId
}: {
  featureRequestId: string;
}) {
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
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
  const utils = trpc.useUtils();
  const workflow = trpc.requirementEngine.getWorkflow.useQuery({
    featureRequestId
  });
  const linkedPullRequest = trpc.github.getFeaturePullRequest.useQuery({
    featureRequestId
  });
  const latestQaReview = trpc.qaReview.getLatest.useQuery({
    featureRequestId
  });
  const latestApproval = trpc.approval.getLatest.useQuery({
    featureRequestId
  });
  const generateClarifications =
    trpc.requirementEngine.generateClarifications.useMutation({
      onSuccess: () =>
        utils.requirementEngine.getWorkflow.invalidate({ featureRequestId })
    });
  const generatePrd = trpc.requirementEngine.generatePrd.useMutation({
    onSuccess: () =>
      utils.requirementEngine.getWorkflow.invalidate({ featureRequestId })
  });
  const generateTasks =
    trpc.requirementEngine.generateEngineeringTasks.useMutation({
      onSuccess: () =>
        utils.requirementEngine.getWorkflow.invalidate({ featureRequestId })
    });
  const answerClarification =
    trpc.requirementEngine.answerClarification.useMutation({
      onSuccess: async (_data, variables) => {
        setAnswerDrafts((current) => {
          const next = { ...current };
          delete next[variables.questionId];
          return next;
        });
        await utils.requirementEngine.getWorkflow.invalidate({ featureRequestId });
      }
    });
  const linkPullRequest = trpc.github.linkPullRequest.useMutation({
    onSuccess: async () => {
      setPrUrl("");
      await utils.github.getFeaturePullRequest.invalidate({ featureRequestId });
      await utils.requirementEngine.getWorkflow.invalidate({ featureRequestId });
    }
  });
  const refreshSnapshot = trpc.github.refreshSnapshot.useMutation({
    onSuccess: async () => {
      await utils.github.getFeaturePullRequest.invalidate({ featureRequestId });
    }
  });
  const runQaReview = trpc.qaReview.run.useMutation({
    onSuccess: async () => {
      await utils.qaReview.getLatest.invalidate({ featureRequestId });
      await utils.requirementEngine.getWorkflow.invalidate({ featureRequestId });
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
    }
  });

  const feature = workflow.data?.featureRequest;
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
  const latestAiRuns = workflow.data?.latestAiRuns ?? [];

  const hasQuestions = clarificationQuestions.length > 0;
  const hasPrd = Boolean(prd);
  const hasTasks = engineeringTasks.length > 0;
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

  function submitApprovalDecision() {
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

  if (workflow.isLoading) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-400">
        Loading...
      </div>
    );
  }

  if (workflow.error || !feature) {
    return (
      <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-5">
        <p className="text-sm text-red-200">
          {workflow.error?.message ?? "Feature request not found."}
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

      <div className="grid gap-4 md:grid-cols-2">
        <DetailBlock title="Business goal" value={feature.businessGoal} />
        <DetailBlock
          title="Expected behavior"
          value={feature.expectedBehavior}
        />
      </div>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-medium">Acceptance criteria</h2>
        <StringList
          items={feature.acceptanceCriteria}
          emptyText="No acceptance criteria captured yet."
        />
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
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
              hasPrd || prdBlockedByClarifications || generatePrd.isPending
            }
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {hasPrd
              ? "PRD generated"
              : prdBlockedByClarifications
                ? "Answer required questions"
              : generatePrd.isPending
                ? "Generating..."
                : "Generate PRD"}
          </button>
          <button
            type="button"
            onClick={() => (prd ? generateTasks.mutate({ prdId: prd.id }) : null)}
            disabled={!prd || hasTasks || generateTasks.isPending}
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

        {prdBlockedByClarifications ? (
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

      <AiRunDebug runs={latestAiRuns} />

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-medium">Clarification questions</h2>
        {clarificationQuestions.length > 0 ? (
          <div className="mt-4 space-y-3">
            {clarificationQuestions.map((question) => (
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
                {question.answer ? (
                  <p className="mt-3 rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3 text-sm text-emerald-100">
                    <span className="text-emerald-400">Answered:</span>{" "}
                    {question.answer}
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {isRequiredQuestionPriority(question.priority) ? (
                      <p className="text-sm text-amber-300">
                        Required before PRD generation.
                      </p>
                    ) : null}
                    <textarea
                      value={answerDrafts[question.id] ?? ""}
                      onChange={(event) =>
                        setAnswerDraft(question.id, event.target.value)
                      }
                      className="min-h-24 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-blue-500"
                      placeholder="Answer this clarification..."
                    />
                    <button
                      type="button"
                      onClick={() => saveAnswer(question.id)}
                      disabled={
                        answerClarification.isPending ||
                        !(answerDrafts[question.id]?.trim().length > 0)
                      }
                      className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {answerClarification.isPending ? "Saving..." : "Save answer"}
                    </button>
                    {answerClarification.error ? (
                      <p className="text-sm text-red-300">
                        {answerClarification.error.message}
                      </p>
                    ) : null}
                  </div>
                )}
              </article>
            ))}
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

      <AIQAReviewSection
        hasPrd={Boolean(prd)}
        requirementsCount={prdRequirements.length}
        hasPullRequestSnapshot={Boolean(linkedPullRequest.data?.latestSnapshot)}
        reviewBundle={latestQaReview.data}
        isLoading={latestQaReview.isLoading}
        error={latestQaReview.error?.message}
        onRun={() => runQaReview.mutate({ featureRequestId })}
        isRunning={runQaReview.isPending}
        runError={runQaReview.error?.message}
      />

      <HumanApprovalGateSection
        latestQaReview={latestQaReview.data}
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

function AiRunDebug({ runs }: { runs: AiRunView[] }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="text-lg font-medium">AI run debug</h2>
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
              {run.error ? (
                <p className="mt-3 text-sm text-red-300">{run.error}</p>
              ) : null}
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
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
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
              Snapshot debug
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
  requirementsCount: number;
  hasPullRequestSnapshot: boolean;
  reviewBundle: QAReviewBundle | null | undefined;
  isLoading: boolean;
  error?: string;
  onRun: () => void;
  isRunning: boolean;
  runError?: string;
}) {
  const ready = hasPrd && requirementsCount > 0 && hasPullRequestSnapshot;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
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
            disabled={isRunning}
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

      {!hasPrd || requirementsCount === 0 ? (
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
  const canSubmit = Boolean(latestQaReview) && !isSubmitting;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Human Approval Gate</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Record the human release decision after reviewing AI QA evidence.
          </p>
        </div>
        {latestApproval ? <StatusBadge status={latestApproval.decision} /> : null}
      </div>

      {!latestQaReview ? (
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
  return isRequiredQuestionPriority(priority) ? "must_answer" : "nice_to_have";
}

function formatApprovalDecision(decision: ApprovalDecision) {
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
