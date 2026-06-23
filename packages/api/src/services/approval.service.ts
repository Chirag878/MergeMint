import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  approvals,
  auditLogs,
  db,
  featureRequests,
  pullRequests,
  qaFindings,
  qaRequirementCoverage,
  qaReviews,
  type JsonObject
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

export type ApprovalDecision =
  | "approved"
  | "approved_with_risk"
  | "changes_requested"
  | "rejected";

function toBootstrapInput(ctx: ProtectedContext) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
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

async function getLinkedPullRequestOrThrow(
  featureRequestId: string,
  organizationId: string
) {
  const [pullRequest] = await db
    .select()
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.featureRequestId, featureRequestId),
        eq(pullRequests.organizationId, organizationId)
      )
    )
    .orderBy(desc(pullRequests.updatedAt))
    .limit(1);

  if (!pullRequest) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Link a GitHub pull request before submitting approval."
    });
  }

  return pullRequest;
}

async function getLatestQaReviewOrThrow(
  featureRequestId: string,
  organizationId: string
) {
  const [review] = await db
    .select()
    .from(qaReviews)
    .where(
      and(
        eq(qaReviews.featureRequestId, featureRequestId),
        eq(qaReviews.organizationId, organizationId)
      )
    )
    .orderBy(desc(qaReviews.createdAt))
    .limit(1);

  if (!review) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Run AI QA review before submitting approval."
    });
  }

  return review;
}

async function getApprovalRiskSummary(qaReviewId: string) {
  const [coverage, findings] = await Promise.all([
    db
      .select()
      .from(qaRequirementCoverage)
      .where(eq(qaRequirementCoverage.qaReviewId, qaReviewId)),
    db.select().from(qaFindings).where(eq(qaFindings.qaReviewId, qaReviewId))
  ]);

  const highCriticalFindings = findings.filter(
    (finding) =>
      finding.status === "open" &&
      (finding.severity === "high" || finding.severity === "critical")
  ).length;
  const missingRequirements = coverage.filter(
    (item) => item.status === "missing"
  ).length;
  const partialRequirements = coverage.filter(
    (item) => item.status === "partial"
  ).length;
  const riskyRequirements = coverage.filter(
    (item) => String(item.status) === "risky"
  ).length;

  return {
    highCriticalFindings,
    missingRequirements,
    partialRequirements,
    riskyRequirements
  };
}

function validateApprovalDecision(input: {
  decision: ApprovalDecision;
  note?: string;
  remainingRisks: string[];
  readinessScore: number | null;
  highCriticalFindings: number;
  missingRequirements: number;
  partialRequirements: number;
  riskyRequirements: number;
}) {
  const hasNote = Boolean(input.note);
  const hasRemainingRisks = input.remainingRisks.length > 0;
  const hasUnresolvedRisk =
    (input.readinessScore ?? 0) < 80 ||
    input.highCriticalFindings > 0 ||
    input.missingRequirements > 0 ||
    input.partialRequirements > 0 ||
    input.riskyRequirements > 0;

  if (input.decision === "approved" && hasUnresolvedRisk && !hasNote) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "This review has unresolved risks. Add an approval note before approving."
    });
  }

  if (
    input.decision === "approved_with_risk" &&
    !hasNote &&
    !hasRemainingRisks
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Add an approval note or list remaining risks before approving with risk."
    });
  }

  if (input.decision === "changes_requested" && !hasNote) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Add a note explaining what changes are required."
    });
  }

  if (input.decision === "rejected" && !hasNote) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Add a note explaining why this release is rejected."
    });
  }
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

function mapFeatureStatus(decision: ApprovalDecision) {
  if (decision === "approved" || decision === "approved_with_risk") {
    return "approved" as const;
  }

  return "changes_requested" as const;
}

export async function createApprovalDecision(
  ctx: ProtectedContext,
  input: {
    featureRequestId: string;
    decision: ApprovalDecision;
    note?: string;
    remainingRisks?: string[];
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:write");

  const featureRequest = await getScopedFeatureOrThrow(
    input.featureRequestId,
    workspace.activeOrganization.id
  );
  const pullRequest = await getLinkedPullRequestOrThrow(
    featureRequest.id,
    workspace.activeOrganization.id
  );
  const qaReview = await getLatestQaReviewOrThrow(
    featureRequest.id,
    workspace.activeOrganization.id
  );
  const note = input.note?.trim() || undefined;
  const remainingRisks =
    input.remainingRisks?.map((risk) => risk.trim()).filter(Boolean) ?? [];
  const riskSummary = await getApprovalRiskSummary(qaReview.id);

  validateApprovalDecision({
    decision: input.decision,
    note,
    remainingRisks,
    readinessScore: qaReview.readinessScore,
    ...riskSummary
  });

  const [approval] = await db
    .insert(approvals)
    .values({
      organizationId: workspace.activeOrganization.id,
      featureRequestId: featureRequest.id,
      pullRequestId: pullRequest.id,
      approvedBy: workspace.appUser.id,
      decision: input.decision,
      note,
      remainingRisks
    })
    .returning();

  if (!approval) {
    throw new Error("Unable to create approval decision.");
  }

  await db
    .update(featureRequests)
    .set({
      status: mapFeatureStatus(input.decision),
      updatedAt: new Date()
    })
    .where(eq(featureRequests.id, featureRequest.id));

  await writeAuditLog({
    organizationId: workspace.activeOrganization.id,
    actorId: workspace.appUser.id,
    action: "approval_created",
    entityType: "feature_request",
    entityId: featureRequest.id,
    metadata: toJsonObject({
      approvalId: approval.id,
      pullRequestId: pullRequest.id,
      qaReviewId: qaReview.id,
      decision: approval.decision
    })
  });

  return approval;
}

export async function getLatestApprovalDecision(
  ctx: ProtectedContext,
  featureRequestId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  await getScopedFeatureOrThrow(featureRequestId, workspace.activeOrganization.id);

  const [approval] = await db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.featureRequestId, featureRequestId),
        eq(approvals.organizationId, workspace.activeOrganization.id)
      )
    )
    .orderBy(desc(approvals.createdAt))
    .limit(1);

  return approval ?? null;
}

export async function getApprovalDecisionById(
  ctx: ProtectedContext,
  approvalId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  const [approval] = await db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.id, approvalId),
        eq(approvals.organizationId, workspace.activeOrganization.id)
      )
    )
    .limit(1);

  if (!approval) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Approval decision not found."
    });
  }

  return approval;
}
