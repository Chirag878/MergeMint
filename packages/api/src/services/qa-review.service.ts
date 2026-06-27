import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import {
  generateQAReview,
  getAIConfig,
  type AITokenUsage,
  type QAReviewInput,
  type QAReviewOutput
} from "@veriflow/ai";
import {
  aiRuns,
  auditLogs,
  clarificationQuestions,
  db,
  engineeringTasks,
  featureRequests,
  prSnapshots,
  prdRequirements,
  prds,
  pullRequests,
  qaFindings,
  qaRequirementCoverage,
  qaReviews,
  usageCounters,
  type JsonObject,
  type RequirementEvidence,
  type TokenUsage
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { normalizeDbTimestamp } from "./prd-staleness";
import { getLatestRepositoryContextForProject } from "./repository-intelligence.service";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

function toBootstrapInput(ctx: ProtectedContext) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function toDbTokenUsage(tokenUsage?: AITokenUsage): TokenUsage | undefined {
  if (!tokenUsage) {
    return undefined;
  }

  return {
    inputTokens: tokenUsage.inputTokens,
    outputTokens: tokenUsage.outputTokens,
    totalTokens: tokenUsage.totalTokens
  };
}

function getCurrentPeriodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

async function getScopedFeatureOrThrow(
  featureRequestId: string,
  organizationId: string
) {
  const [featureRequest] = await db
    .select()
    .from(featureRequests)
    .where(
      and(
        eq(featureRequests.id, featureRequestId),
        eq(featureRequests.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!featureRequest) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Feature request not found."
    });
  }

  return featureRequest;
}

async function createAIRun(input: {
  organizationId: string;
  featureRequestId: string;
  pullRequestId: string;
  payload: unknown;
}) {
  const [run] = await db
    .insert(aiRuns)
    .values({
      organizationId: input.organizationId,
      featureRequestId: input.featureRequestId,
      pullRequestId: input.pullRequestId,
      agentType: "qa_review",
      model: getAIConfig().OPENAI_MODEL ?? "gpt-4.1-mini",
      input: toJsonObject(input.payload),
      status: "running"
    })
    .returning();

  if (!run) {
    throw new Error("Unable to create AI run.");
  }

  return run;
}

async function completeAIRun(input: {
  runId: string;
  output: QAReviewOutput;
  model: string;
  tokenUsage?: AITokenUsage;
}) {
  await db
    .update(aiRuns)
    .set({
      status: "succeeded",
      model: input.model,
      output: toJsonObject(input.output),
      tokenUsage: toDbTokenUsage(input.tokenUsage)
    })
    .where(eq(aiRuns.id, input.runId));
}

async function failAIRun(runId: string, error: unknown) {
  await db
    .update(aiRuns)
    .set({
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    })
    .where(eq(aiRuns.id, runId));
}

async function writeAuditLog(input: {
  organizationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: JsonObject;
}) {
  await db.insert(auditLogs).values({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {}
  });
}

function mapOverallStatus(status: QAReviewOutput["overallStatus"]) {
  if (status === "approved") {
    return "passed" as const;
  }

  if (status === "changes_requested") {
    return "needs_changes" as const;
  }

  if (status === "blocked") {
    return "failed" as const;
  }

  return "needs_human_review" as const;
}

function mapCoverageStatus(
  status: QAReviewOutput["coverage"][number]["status"]
) {
  if (status === "covered") {
    return "covered" as const;
  }

  if (status === "missing") {
    return "missing" as const;
  }

  return "partial" as const;
}

function mapFindingCategory(
  category: QAReviewOutput["findings"][number]["category"]
) {
  if (category === "missing_requirement" || category === "partial_implementation") {
    return "requirement_gap" as const;
  }

  if (category === "security_risk") {
    return "security" as const;
  }

  if (category === "test_gap") {
    return "test_gap" as const;
  }

  if (category === "documentation_gap") {
    return "documentation" as const;
  }

  if (category === "edge_case_gap") {
    return "regression_risk" as const;
  }

  if (category === "bug_risk") {
    return "bug_risk" as const;
  }

  return "maintainability" as const;
}

function toRequirementEvidence(evidence: string[]): RequirementEvidence {
  return {
    summary: evidence[0],
    notes: evidence
  };
}

async function hasClarificationAnswerAfterPrd(input: {
  featureRequestId: string;
  prdCreatedAt: Date;
}) {
  const prdCreatedAt = normalizeDbTimestamp(input.prdCreatedAt);
  const [row] = await db
    .select({ id: clarificationQuestions.id })
    .from(clarificationQuestions)
    .where(
      and(
        eq(clarificationQuestions.featureRequestId, input.featureRequestId),
        gt(clarificationQuestions.answeredAt, prdCreatedAt)
      )
    )
    .limit(1);

  return Boolean(row);
}

async function getReviewBundle(reviewId: string, organizationId: string) {
  const [review] = await db
    .select()
    .from(qaReviews)
    .where(
      and(eq(qaReviews.id, reviewId), eq(qaReviews.organizationId, organizationId))
    )
    .limit(1);

  if (!review) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "QA review not found."
    });
  }

  const [coverage, findings] = await Promise.all([
    db
      .select()
      .from(qaRequirementCoverage)
      .where(eq(qaRequirementCoverage.qaReviewId, review.id))
      .orderBy(qaRequirementCoverage.requirementKey),
    db
      .select()
      .from(qaFindings)
      .where(eq(qaFindings.qaReviewId, review.id))
      .orderBy(desc(qaFindings.createdAt))
  ]);

  return {
    review,
    coverage,
    findings
  };
}

export async function runQaReviewForFeatureRequest(
  ctx: ProtectedContext,
  input: {
    featureRequestId: string;
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "create_feature_request");

  const featureRequest = await getScopedFeatureOrThrow(
    input.featureRequestId,
    workspace.activeOrganization.id
  );

  const [prd] = await db
    .select()
    .from(prds)
    .where(eq(prds.featureRequestId, featureRequest.id))
    .orderBy(desc(prds.version))
    .limit(1);

  if (!prd) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Generate PRD and requirements before running QA review."
    });
  }

  let prdOutdated = false;
  try {
    prdOutdated = await hasClarificationAnswerAfterPrd({
      featureRequestId: featureRequest.id,
      prdCreatedAt: prd.createdAt
    });
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Your PRD is outdated or could not be validated. Please regenerate the PRD and try again.",
      cause: error
    });
  }

  if (prdOutdated) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "PRD is outdated. Regenerate PRD before QA review."
    });
  }

  const requirements = await db
    .select()
    .from(prdRequirements)
    .where(eq(prdRequirements.prdId, prd.id))
    .orderBy(prdRequirements.requirementKey);

  if (requirements.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Generate PRD and requirements before running QA review."
    });
  }

  const [pullRequest] = await db
    .select()
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.featureRequestId, featureRequest.id),
        eq(pullRequests.organizationId, workspace.activeOrganization.id)
      )
    )
    .orderBy(desc(pullRequests.updatedAt))
    .limit(1);

  if (!pullRequest) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Link a GitHub pull request before running QA review."
    });
  }

  const [snapshot] = await db
    .select()
    .from(prSnapshots)
    .where(eq(prSnapshots.pullRequestId, pullRequest.id))
    .orderBy(desc(prSnapshots.createdAt))
    .limit(1);

  if (!snapshot) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Refresh the pull request snapshot before running QA review."
    });
  }

  const tasks = await db
    .select()
    .from(engineeringTasks)
    .where(eq(engineeringTasks.prdId, prd.id))
    .orderBy(engineeringTasks.createdAt);

  const diffText = snapshot.diffText ?? "";
  const repositoryContext = await getLatestRepositoryContextForProject({
    organizationId: workspace.activeOrganization.id,
    projectId: featureRequest.projectId
  });
  const qaInput: QAReviewInput = {
    featureRequest: {
      title: featureRequest.title,
      description: featureRequest.description,
      businessGoal: featureRequest.businessGoal,
      expectedBehavior: featureRequest.expectedBehavior
    },
    prd: {
      title: prd.title,
      problem: prd.problem,
      goals: prd.goals
    },
    requirements: requirements.map((requirement) => ({
      requirementKey: requirement.requirementKey,
      requirement: requirement.requirement,
      priority: requirement.priority,
      acceptanceCriteria: requirement.acceptanceCriteria
    })),
    engineeringTasks: tasks.map((task) => ({
      title: task.title,
      description: task.description,
      type: task.type,
      status: task.status,
      priority: task.priority,
      riskLevel: task.riskLevel,
      suggestedFiles: task.suggestedFiles,
      suggestedModules: task.suggestedModules,
      relatedRequirementKeys: task.relatedRequirementKeys,
      relatedAcceptanceCriteria: task.acceptanceCriteriaRefs,
      acceptanceChecklist: task.acceptanceChecklist,
      implementationNotes: task.implementationNotes,
      verificationNotes: task.verificationNotes
    })),
    pullRequest: {
      title: pullRequest.title,
      author: pullRequest.author,
      branch: pullRequest.branch,
      baseBranch: pullRequest.baseBranch,
      state: pullRequest.state,
      latestCommitSha: pullRequest.latestCommitSha
    },
    changedFiles: snapshot.changedFiles.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes
    })),
    diffText: diffText.slice(0, 120_000),
    diffTruncated:
      diffText.length > 120_000 ||
      diffText.includes("[TRUNCATED: diff exceeded maximum snapshot size]"),
    repositoryContext
  };

  const aiRun = await createAIRun({
    organizationId: workspace.activeOrganization.id,
    featureRequestId: featureRequest.id,
    pullRequestId: pullRequest.id,
    payload: qaInput
  });

  try {
    const aiResult = await generateQAReview(qaInput);
    await completeAIRun({
      runId: aiRun.id,
      output: aiResult.data,
      model: aiResult.model,
      tokenUsage: aiResult.tokenUsage
    });

    const [latestReview] = await db
      .select()
      .from(qaReviews)
      .where(eq(qaReviews.pullRequestId, pullRequest.id))
      .orderBy(desc(qaReviews.reviewVersion))
      .limit(1);
    const nextReviewVersion = (latestReview?.reviewVersion ?? 0) + 1;

    const created = await db.transaction(async (tx) => {
      const [review] = await tx
        .insert(qaReviews)
        .values({
          organizationId: workspace.activeOrganization.id,
          featureRequestId: featureRequest.id,
          pullRequestId: pullRequest.id,
          prdId: prd.id,
          aiRunId: aiRun.id,
          reviewVersion: nextReviewVersion,
          overallStatus: mapOverallStatus(aiResult.data.overallStatus),
          confidenceScore: aiResult.data.confidenceScore,
          readinessScore: aiResult.data.readinessScore,
          summary: aiResult.data.summary,
          taskCoverage: aiResult.data.taskCoverage.map((coverageItem) => ({
            title: coverageItem.title,
            status: coverageItem.status,
            evidence: coverageItem.evidence,
            suggestedFiles: coverageItem.suggestedFiles,
            concern: coverageItem.concern
          }))
        })
        .returning();

      if (!review) {
        throw new Error("Unable to create QA review.");
      }

      const coverage = await tx
        .insert(qaRequirementCoverage)
        .values(
          aiResult.data.coverage.map((coverageItem) => ({
            qaReviewId: review.id,
            requirementKey: coverageItem.requirementKey,
            status: mapCoverageStatus(coverageItem.status),
            evidence: toRequirementEvidence(coverageItem.evidence),
            concern: coverageItem.concern ?? null
          }))
        )
        .returning();

      const findings =
        aiResult.data.findings.length > 0
          ? await tx
              .insert(qaFindings)
              .values(
                aiResult.data.findings.map((finding) => ({
                  qaReviewId: review.id,
                  pullRequestId: pullRequest.id,
                  requirementKey: finding.requirementKey ?? null,
                  severity: finding.severity,
                  category: mapFindingCategory(finding.category),
                  title: finding.title,
                  description: finding.description,
                  file: finding.file ?? null,
                  line: finding.line ?? null,
                  suggestedFix: finding.suggestedFix ?? null,
                  status: "open" as const
                }))
              )
              .returning()
          : [];

      await tx
        .update(featureRequests)
        .set({
          status: "qa_reviewed",
          boardStage: "completing",
          updatedAt: new Date()
        })
        .where(eq(featureRequests.id, featureRequest.id));

      await tx
        .update(usageCounters)
        .set({
          aiReviewsUsed: sql`${usageCounters.aiReviewsUsed} + 1`,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(usageCounters.organizationId, workspace.activeOrganization.id),
            eq(usageCounters.periodKey, getCurrentPeriodKey())
          )
        );

      return {
        review,
        coverage,
        findings
      };
    });

    await writeAuditLog({
      organizationId: workspace.activeOrganization.id,
      actorId: workspace.appUser.id,
      action: "qa_review_generated",
      entityType: "qa_review",
      entityId: created.review.id,
      metadata: toJsonObject({
        featureRequestId: featureRequest.id,
        pullRequestId: pullRequest.id,
        reviewVersion: created.review.reviewVersion,
        aiRunId: aiRun.id
      })
    });

    return created;
  } catch (error) {
    await failAIRun(aiRun.id, error);
    throw error;
  }
}

export async function getLatestQaReviewForFeatureRequest(
  ctx: ProtectedContext,
  featureRequestId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  await getScopedFeatureOrThrow(featureRequestId, workspace.activeOrganization.id);

  const [review] = await db
    .select()
    .from(qaReviews)
    .where(
      and(
        eq(qaReviews.featureRequestId, featureRequestId),
        eq(qaReviews.organizationId, workspace.activeOrganization.id)
      )
    )
    .orderBy(desc(qaReviews.reviewVersion), desc(qaReviews.createdAt))
    .limit(1);

  if (!review) {
    return null;
  }

  return getReviewBundle(review.id, workspace.activeOrganization.id);
}

export async function getQaReviewById(ctx: ProtectedContext, qaReviewId: string) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  return getReviewBundle(qaReviewId, workspace.activeOrganization.id);
}
