import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  appUsers,
  approvals,
  auditLogs,
  db,
  featureRequests,
  prdRequirements,
  prds,
  prSnapshots,
  projects,
  pullRequests,
  qaFindings,
  qaRequirementCoverage,
  qaReviews,
  releaseReports,
  repositories,
  clarificationQuestions,
  type JsonObject
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

export type ReleaseReportData = {
  reportStatus: string;
  feature: {
    id: string;
    title: string;
    summary: string;
    status: string;
  };
  project: {
    id: string;
    name: string;
  };
  prd: {
    id: string;
    title: string;
    problem: string | null;
    goals: string[];
    nonGoals: string[];
  };
  requirements: Array<{
    key: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
    priority: string;
  }>;
  pullRequest: {
    id: string;
    provider: "github";
    repository: string;
    owner: string;
    repo: string;
    number: number;
    title: string;
    url: string;
    author: string | null;
    sourceBranch: string;
    targetBranch: string;
    state: string;
    merged: boolean;
    latestCommitSha: string | null;
  };
  qaReview: {
    id: string;
    overallStatus: string;
    readinessScore: number | null;
    confidenceScore: number | null;
    summary: string | null;
    reviewVersion: number;
    createdAt: string;
  };
  coverage: Array<{
    requirementKey: string;
    status: string;
    evidence: unknown;
    concern: string | null;
  }>;
  findings: Array<{
    severity: string;
    category: string;
    title: string;
    description: string;
    requirementKey: string | null;
    file: string | null;
    line: number | null;
    suggestedFix: string | null;
    status: string;
  }>;
  approval: {
    id: string;
    decision: string;
    note: string | null;
    remainingRisks: string[];
    approvedBy: string;
    createdAt: string;
  };
  generatedAt: string;
};

type PrivateReleaseReport = Omit<
  typeof releaseReports.$inferSelect,
  "reportData"
> & {
  reportData: ReleaseReportData;
};

export type PublicReleaseReport = Pick<
  PrivateReleaseReport,
  | "id"
  | "title"
  | "status"
  | "shareToken"
  | "reportData"
  | "readinessScore"
  | "generatedAt"
  | "createdAt"
>;

function toBootstrapInput(ctx: ProtectedContext) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function toTypedReport(report: typeof releaseReports.$inferSelect) {
  return {
    ...report,
    reportData: report.reportData as ReleaseReportData
  } satisfies PrivateReleaseReport;
}

function toPublicReport(report: PrivateReleaseReport): PublicReleaseReport {
  return {
    id: report.id,
    title: report.title,
    status: report.status,
    shareToken: report.shareToken,
    reportData: report.reportData,
    readinessScore: report.readinessScore,
    generatedAt: report.generatedAt,
    createdAt: report.createdAt
  };
}

function createShareToken() {
  return randomBytes(32).toString("base64url");
}

function getReportStatusFromDecision(decision: string) {
  if (decision === "approved") {
    return "approved";
  }

  if (decision === "approved_with_risk") {
    return "approved_with_risk";
  }

  if (decision === "rejected") {
    return "rejected";
  }

  return "changes_requested";
}

async function getScopedFeatureOrThrow(
  featureRequestId: string,
  organizationId: string
) {
  const [row] = await db
    .select({
      featureRequest: featureRequests,
      project: projects
    })
    .from(featureRequests)
    .innerJoin(projects, eq(featureRequests.projectId, projects.id))
    .where(
      and(
        eq(featureRequests.id, featureRequestId),
        eq(featureRequests.organizationId, organizationId),
        eq(projects.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Feature request not found."
    });
  }

  return row;
}

async function getLatestPrdOrThrow(featureRequestId: string) {
  const [prd] = await db
    .select()
    .from(prds)
    .where(eq(prds.featureRequestId, featureRequestId))
    .orderBy(desc(prds.version), desc(prds.createdAt))
    .limit(1);

  if (!prd) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Generate a PRD before generating a release report."
    });
  }

  return prd;
}

async function throwIfPrdOutdated(input: {
  featureRequestId: string;
  prdCreatedAt: Date;
}) {
  const [row] = await db
    .select({ id: clarificationQuestions.id })
    .from(clarificationQuestions)
    .where(
      and(
        eq(clarificationQuestions.featureRequestId, input.featureRequestId),
        sql`${clarificationQuestions.answeredAt} > ${input.prdCreatedAt}`
      )
    )
    .limit(1);

  if (row) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "A clarification answer changed after the PRD was generated. Regenerate the PRD and rerun QA before generating a release report."
    });
  }
}

async function getRequirementsOrThrow(prdId: string) {
  const requirements = await db
    .select()
    .from(prdRequirements)
    .where(eq(prdRequirements.prdId, prdId))
    .orderBy(prdRequirements.requirementKey);

  if (requirements.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Generate PRD requirements before generating a release report."
    });
  }

  return requirements;
}

async function getLinkedPullRequestOrThrow(
  featureRequestId: string,
  organizationId: string
) {
  const [row] = await db
    .select({
      pullRequest: pullRequests,
      repository: repositories
    })
    .from(pullRequests)
    .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
    .where(
      and(
        eq(pullRequests.featureRequestId, featureRequestId),
        eq(pullRequests.organizationId, organizationId),
        eq(repositories.organizationId, organizationId)
      )
    )
    .orderBy(desc(pullRequests.updatedAt))
    .limit(1);

  if (!row) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Link a GitHub pull request before generating a release report."
    });
  }

  return row;
}

async function getLatestSnapshotOrThrow(pullRequestId: string) {
  const [snapshot] = await db
    .select()
    .from(prSnapshots)
    .where(eq(prSnapshots.pullRequestId, pullRequestId))
    .orderBy(desc(prSnapshots.createdAt))
    .limit(1);

  if (!snapshot) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Refresh the PR snapshot before generating a release report."
    });
  }

  return snapshot;
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
    .orderBy(desc(qaReviews.reviewVersion), desc(qaReviews.createdAt))
    .limit(1);

  if (!review) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Run AI QA review before generating a release report."
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

  return { review, coverage, findings };
}

async function getLatestApprovalOrThrow(
  featureRequestId: string,
  organizationId: string
) {
  const [approval] = await db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.featureRequestId, featureRequestId),
        eq(approvals.organizationId, organizationId)
      )
    )
    .orderBy(desc(approvals.createdAt))
    .limit(1);

  if (!approval) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Submit an approval decision before generating a release report."
    });
  }

  const [approver] = approval.approvedBy
    ? await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.id, approval.approvedBy))
        .limit(1)
    : [];

  return {
    approval,
    approvedBy: approver?.name ?? "Human reviewer"
  };
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

export async function generateReleaseReport(
  ctx: ProtectedContext,
  input: {
    featureRequestId: string;
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:write");

  const organizationId = workspace.activeOrganization.id;
  const { featureRequest, project } = await getScopedFeatureOrThrow(
    input.featureRequestId,
    organizationId
  );
  const prd = await getLatestPrdOrThrow(featureRequest.id);
  await throwIfPrdOutdated({
    featureRequestId: featureRequest.id,
    prdCreatedAt: prd.createdAt
  });
  const requirements = await getRequirementsOrThrow(prd.id);
  const { pullRequest, repository } = await getLinkedPullRequestOrThrow(
    featureRequest.id,
    organizationId
  );
  const snapshot = await getLatestSnapshotOrThrow(pullRequest.id);
  const qaReviewBundle = await getLatestQaReviewOrThrow(
    featureRequest.id,
    organizationId
  );
  const { approval, approvedBy } = await getLatestApprovalOrThrow(
    featureRequest.id,
    organizationId
  );
  const generatedAt = new Date();
  const reportStatus = getReportStatusFromDecision(approval.decision);
  const reportData: ReleaseReportData = {
    reportStatus,
    feature: {
      id: featureRequest.id,
      title: featureRequest.title,
      summary: featureRequest.description,
      status: featureRequest.status
    },
    project: {
      id: project.id,
      name: project.name
    },
    prd: {
      id: prd.id,
      title: prd.title,
      problem: prd.problem,
      goals: prd.goals,
      nonGoals: prd.nonGoals
    },
    requirements: requirements.map((requirement) => ({
      key: requirement.requirementKey,
      title: requirement.requirementKey,
      description: requirement.requirement,
      acceptanceCriteria: requirement.acceptanceCriteria,
      priority: requirement.priority
    })),
    pullRequest: {
      id: pullRequest.id,
      provider: "github",
      repository: repository.fullName,
      owner: repository.owner,
      repo: repository.name,
      number: pullRequest.githubPrNumber,
      title: pullRequest.title,
      url: pullRequest.htmlUrl,
      author: pullRequest.author,
      sourceBranch: pullRequest.branch,
      targetBranch: pullRequest.baseBranch,
      state: pullRequest.state,
      merged: Boolean(pullRequest.mergedAt),
      latestCommitSha: snapshot.commitSha ?? pullRequest.latestCommitSha
    },
    qaReview: {
      id: qaReviewBundle.review.id,
      overallStatus: qaReviewBundle.review.overallStatus,
      readinessScore: qaReviewBundle.review.readinessScore,
      confidenceScore: qaReviewBundle.review.confidenceScore,
      summary: qaReviewBundle.review.summary,
      reviewVersion: qaReviewBundle.review.reviewVersion,
      createdAt: qaReviewBundle.review.createdAt.toISOString()
    },
    coverage: qaReviewBundle.coverage.map((coverage) => ({
      requirementKey: coverage.requirementKey,
      status: coverage.status,
      evidence: coverage.evidence,
      concern: coverage.concern
    })),
    findings: qaReviewBundle.findings.map((finding) => ({
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      description: finding.description,
      requirementKey: finding.requirementKey,
      file: finding.file,
      line: finding.line,
      suggestedFix: finding.suggestedFix,
      status: finding.status
    })),
    approval: {
      id: approval.id,
      decision: approval.decision,
      note: approval.note,
      remainingRisks: approval.remainingRisks,
      approvedBy,
      createdAt: approval.createdAt.toISOString()
    },
    generatedAt: generatedAt.toISOString()
  };

  const [report] = await db
    .insert(releaseReports)
    .values({
      organizationId,
      projectId: project.id,
      featureRequestId: featureRequest.id,
      pullRequestId: pullRequest.id,
      approvalId: approval.id,
      title: featureRequest.title,
      status: "generated",
      shareToken: createShareToken(),
      reportData: toJsonObject(reportData),
      readinessScore: qaReviewBundle.review.readinessScore,
      generatedBy: workspace.appUser.id,
      generatedAt
    })
    .returning();

  if (!report) {
    throw new Error("Unable to generate release report.");
  }

  await writeAuditLog({
    organizationId,
    actorId: workspace.appUser.id,
    action: "release_report_generated",
    entityType: "release_report",
    entityId: report.id,
    metadata: toJsonObject({
      featureRequestId: featureRequest.id,
      pullRequestId: pullRequest.id,
      approvalId: approval.id,
      shareToken: report.shareToken
    })
  });

  return toTypedReport(report);
}

export async function getLatestReleaseReportForFeature(
  ctx: ProtectedContext,
  featureRequestId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  await getScopedFeatureOrThrow(featureRequestId, workspace.activeOrganization.id);

  const [report] = await db
    .select()
    .from(releaseReports)
    .where(
      and(
        eq(releaseReports.featureRequestId, featureRequestId),
        eq(releaseReports.organizationId, workspace.activeOrganization.id)
      )
    )
    .orderBy(desc(releaseReports.createdAt))
    .limit(1);

  return report ? toTypedReport(report) : null;
}

export async function getReleaseReportById(
  ctx: ProtectedContext,
  releaseReportId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  const [report] = await db
    .select()
    .from(releaseReports)
    .where(
      and(
        eq(releaseReports.id, releaseReportId),
        eq(releaseReports.organizationId, workspace.activeOrganization.id)
      )
    )
    .limit(1);

  if (!report) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Release report not found."
    });
  }

  return toTypedReport(report);
}

export async function getReleaseReportByShareToken(shareToken: string) {
  const [report] = await db
    .select()
    .from(releaseReports)
    .where(eq(releaseReports.shareToken, shareToken))
    .limit(1);

  return report ? toPublicReport(toTypedReport(report)) : null;
}
