import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt } from "drizzle-orm";
import {
  appUsers,
  approvals,
  auditLogs,
  clients,
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
import { normalizeDbTimestamp } from "./prd-staleness";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

export type ReleaseReportType = "client_delivery" | "developer_fix";

type ReportVisibility = "public" | "private" | "internal";

type ReportTimelineItem = {
  label: string;
  at: string | null;
};

export type ClientDeliveryReportData = {
  reportType: "client_delivery";
  audience: "client";
  visibility: "public";
  reportStatus: string;
  summary: string;
  deliveryVerdict: "Ready to Release" | "Approved" | "Approved with Notes";
  client: {
    id: string | null;
    name: string | null;
    companyName: string | null;
  };
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
  timeline: ReportTimelineItem[];
  generatedAt: string;
};

export type DeveloperFixReportData = {
  reportType: "developer_fix";
  audience: "developer";
  visibility: "private";
  reportStatus: "needs_fixes" | "rejected" | "partially_delivered";
  summary: string;
  instruction: string;
  feature: {
    id: string;
    title: string;
    summary: string;
  };
  project: {
    id: string;
    name: string;
  };
  pullRequest: ClientDeliveryReportData["pullRequest"];
  qaReview: ClientDeliveryReportData["qaReview"];
  requirements: ClientDeliveryReportData["requirements"];
  coverage: ClientDeliveryReportData["coverage"];
  findings: ClientDeliveryReportData["findings"];
  failedRequirements: ClientDeliveryReportData["requirements"];
  partialRequirements: ClientDeliveryReportData["requirements"];
  highRiskGaps: Array<{
    title: string;
    severity: string;
    requirementKey: string | null;
    suggestedFix: string | null;
  }>;
  suggestedNextActions: string[];
  approval: {
    id: string;
    decision: string;
    note: string | null;
    remainingRisks: string[];
    reviewer: string;
    createdAt: string;
  } | null;
  generatedAt: string;
};

export type ReleaseReportData =
  | ClientDeliveryReportData
  | DeveloperFixReportData;

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
  const reportData = report.reportData as Partial<ReleaseReportData>;
  return {
    ...report,
    reportData: reportData.reportType
      ? (reportData as ReleaseReportData)
      : ({
          ...(reportData as Record<string, unknown>),
          reportType: "client_delivery"
        } as ReleaseReportData)
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

function getReportType(report: typeof releaseReports.$inferSelect) {
  const reportData = report.reportData as Partial<ReleaseReportData>;
  return reportData.reportType ?? "client_delivery";
}

function isClientApprovedDecision(decision: string) {
  return decision === "approved" || decision === "approved_with_risk";
}

function isRejectedDecision(decision: string | null | undefined) {
  return decision === "rejected" || decision === "changes_requested";
}

function isRiskyCoverageStatus(status: string) {
  return status === "partial" || status === "missing" || status === "risky";
}

function isOpenFindingStatus(status: string) {
  return status === "open" || status === "needs_human_review";
}

async function getScopedFeatureOrThrow(
  featureRequestId: string,
  organizationId: string
) {
  const [row] = await db
    .select({
      featureRequest: featureRequests,
      project: projects,
      client: clients
    })
    .from(featureRequests)
    .innerJoin(projects, eq(featureRequests.projectId, projects.id))
    .leftJoin(
      clients,
      and(eq(projects.clientId, clients.id), eq(clients.organizationId, organizationId))
    )
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

async function getLatestApproval(
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
    return null;
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

function mapRequirements(requirements: Array<typeof prdRequirements.$inferSelect>) {
  return requirements.map((requirement) => ({
    key: requirement.requirementKey,
    title: requirement.requirementKey,
    description: requirement.requirement,
    acceptanceCriteria: requirement.acceptanceCriteria,
    priority: requirement.priority
  }));
}

function mapPullRequest(input: {
  pullRequest: typeof pullRequests.$inferSelect;
  repository: typeof repositories.$inferSelect;
  snapshot: typeof prSnapshots.$inferSelect;
}): ClientDeliveryReportData["pullRequest"] {
  return {
    id: input.pullRequest.id,
    provider: "github",
    repository: input.repository.fullName,
    owner: input.repository.owner,
    repo: input.repository.name,
    number: input.pullRequest.githubPrNumber,
    title: input.pullRequest.title,
    url: input.pullRequest.htmlUrl,
    author: input.pullRequest.author,
    sourceBranch: input.pullRequest.branch,
    targetBranch: input.pullRequest.baseBranch,
    state: input.pullRequest.state,
    merged: Boolean(input.pullRequest.mergedAt),
    latestCommitSha: input.snapshot.commitSha ?? input.pullRequest.latestCommitSha
  };
}

function mapQaReview(
  review: typeof qaReviews.$inferSelect
): ClientDeliveryReportData["qaReview"] {
  return {
    id: review.id,
    overallStatus: review.overallStatus,
    readinessScore: review.readinessScore,
    confidenceScore: review.confidenceScore,
    summary: review.summary,
    reviewVersion: review.reviewVersion,
    createdAt: review.createdAt.toISOString()
  };
}

function mapCoverage(
  coverageRows: Array<typeof qaRequirementCoverage.$inferSelect>
): ClientDeliveryReportData["coverage"] {
  return coverageRows.map((coverage) => ({
    requirementKey: coverage.requirementKey,
    status: coverage.status,
    evidence: coverage.evidence,
    concern: coverage.concern
  }));
}

function mapFindings(
  findingRows: Array<typeof qaFindings.$inferSelect>
): ClientDeliveryReportData["findings"] {
  return findingRows.map((finding) => ({
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
    description: finding.description,
    requirementKey: finding.requirementKey,
    file: finding.file,
    line: finding.line,
    suggestedFix: finding.suggestedFix,
    status: finding.status
  }));
}

function buildTimeline(input: {
  featureCreatedAt: Date;
  prdCreatedAt: Date;
  firstRequirementCreatedAt: Date | null;
  pullRequestCreatedAt: Date;
  qaReviewCreatedAt: Date;
  approvalCreatedAt: Date | null;
  generatedAt: Date;
}): ReportTimelineItem[] {
  return [
    { label: "Feature created", at: input.featureCreatedAt.toISOString() },
    { label: "PRD generated", at: input.prdCreatedAt.toISOString() },
    {
      label: "Requirements generated",
      at: input.firstRequirementCreatedAt?.toISOString() ?? null
    },
    { label: "PR linked", at: input.pullRequestCreatedAt.toISOString() },
    { label: "QA review completed", at: input.qaReviewCreatedAt.toISOString() },
    {
      label: "Approval completed",
      at: input.approvalCreatedAt?.toISOString() ?? null
    },
    { label: "Report generated", at: input.generatedAt.toISOString() }
  ];
}

function coverageSummaryText(
  coverage: ClientDeliveryReportData["coverage"]
) {
  const covered = coverage.filter((item) => item.status === "covered").length;
  const partial = coverage.filter((item) => item.status === "partial").length;
  const missing = coverage.filter((item) => item.status === "missing").length;
  const risky = coverage.filter((item) => item.status === "risky").length;

  return `${covered} covered, ${partial} partial, ${missing} missing, ${risky} risky.`;
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
  const { featureRequest, project, client } = await getScopedFeatureOrThrow(
    input.featureRequestId,
    organizationId
  );
  const prd = await getLatestPrdOrThrow(featureRequest.id);
  try {
    await throwIfPrdOutdated({
      featureRequestId: featureRequest.id,
      prdCreatedAt: prd.createdAt
    });
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Your PRD is outdated or could not be validated. Please regenerate the PRD and try again.",
      cause: error
    });
  }
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

  if (!isClientApprovedDecision(approval.decision)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Client Delivery Report can only be generated after approval. Generate a Developer Fix Report for rejected or needs-fixes work."
    });
  }

  const generatedAt = new Date();
  const reportStatus = getReportStatusFromDecision(approval.decision);
  const mappedRequirements = mapRequirements(requirements);
  const mappedCoverage = mapCoverage(qaReviewBundle.coverage);
  const mappedFindings = mapFindings(qaReviewBundle.findings);
  const reportData: ClientDeliveryReportData = {
    reportType: "client_delivery",
    audience: "client",
    visibility: "public",
    reportStatus,
    summary: `This report summarizes what was requested, verified, and approved for ${featureRequest.title}.`,
    deliveryVerdict:
      approval.decision === "approved_with_risk"
        ? "Approved with Notes"
        : "Ready to Release",
    client: {
      id: client?.id ?? null,
      name: client?.name ?? project.clientName ?? null,
      companyName: client?.companyName ?? null
    },
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
    requirements: mappedRequirements,
    pullRequest: mapPullRequest({ pullRequest, repository, snapshot }),
    qaReview: mapQaReview(qaReviewBundle.review),
    coverage: mappedCoverage,
    findings: mappedFindings,
    approval: {
      id: approval.id,
      decision: approval.decision,
      note: approval.note,
      remainingRisks: approval.remainingRisks,
      approvedBy,
      createdAt: approval.createdAt.toISOString()
    },
    timeline: buildTimeline({
      featureCreatedAt: featureRequest.createdAt,
      prdCreatedAt: prd.createdAt,
      firstRequirementCreatedAt: requirements[0]?.createdAt ?? null,
      pullRequestCreatedAt: pullRequest.createdAt,
      qaReviewCreatedAt: qaReviewBundle.review.createdAt,
      approvalCreatedAt: approval.createdAt,
      generatedAt
    }),
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
      title: `Client Delivery Report - ${featureRequest.title}`,
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

export async function generateDeveloperFixReport(
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
  try {
    await throwIfPrdOutdated({
      featureRequestId: featureRequest.id,
      prdCreatedAt: prd.createdAt
    });
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Your PRD is outdated or could not be validated. Please regenerate the PRD and try again.",
      cause: error
    });
  }

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
  const latestApproval = await getLatestApproval(featureRequest.id, organizationId);
  const mappedRequirements = mapRequirements(requirements);
  const mappedCoverage = mapCoverage(qaReviewBundle.coverage);
  const mappedFindings = mapFindings(qaReviewBundle.findings);
  const riskyCoverage = mappedCoverage.filter((coverage) =>
    isRiskyCoverageStatus(coverage.status)
  );
  const openFindings = mappedFindings.filter((finding) =>
    isOpenFindingStatus(finding.status)
  );
  const highRiskGaps = openFindings.filter(
    (finding) => finding.severity === "high" || finding.severity === "critical"
  );
  const hasQaGaps = riskyCoverage.length > 0 || openFindings.length > 0;
  const wasRejected = isRejectedDecision(latestApproval?.approval.decision);

  if (!hasQaGaps && !wasRejected) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Developer Fix Report can only be generated when QA found gaps or the human reviewer requested fixes."
    });
  }

  const requirementByKey = new Map(
    mappedRequirements.map((requirement) => [requirement.key, requirement])
  );
  const failedRequirements = riskyCoverage
    .filter((coverage) => coverage.status === "missing" || coverage.status === "risky")
    .map((coverage) => requirementByKey.get(coverage.requirementKey))
    .filter((requirement): requirement is ClientDeliveryReportData["requirements"][number] =>
      Boolean(requirement)
    );
  const partialRequirements = riskyCoverage
    .filter((coverage) => coverage.status === "partial")
    .map((coverage) => requirementByKey.get(coverage.requirementKey))
    .filter((requirement): requirement is ClientDeliveryReportData["requirements"][number] =>
      Boolean(requirement)
    );
  const generatedAt = new Date();
  const verdict = wasRejected
    ? "rejected"
    : failedRequirements.length > 0
      ? "needs_fixes"
      : "partially_delivered";
  const reportData: DeveloperFixReportData = {
    reportType: "developer_fix",
    audience: "developer",
    visibility: "private",
    reportStatus: verdict,
    summary: `QA found ${coverageSummaryText(mappedCoverage)} Fix the listed gaps, push updates to the same PR, then rerun QA review.`,
    instruction:
      "Fix these gaps, push updates to the same PR, then rerun QA review.",
    feature: {
      id: featureRequest.id,
      title: featureRequest.title,
      summary: featureRequest.description
    },
    project: {
      id: project.id,
      name: project.name
    },
    pullRequest: mapPullRequest({ pullRequest, repository, snapshot }),
    qaReview: mapQaReview(qaReviewBundle.review),
    requirements: mappedRequirements,
    coverage: mappedCoverage,
    findings: mappedFindings,
    failedRequirements,
    partialRequirements,
    highRiskGaps: highRiskGaps.map((finding) => ({
      title: finding.title,
      severity: finding.severity,
      requirementKey: finding.requirementKey,
      suggestedFix: finding.suggestedFix
    })),
    suggestedNextActions: [
      "Review each missing or partial requirement below.",
      "Apply the suggested fixes in the linked GitHub PR.",
      "Push updates to the same PR branch.",
      "Refresh the PR snapshot and rerun AI QA review."
    ],
    approval: latestApproval
      ? {
          id: latestApproval.approval.id,
          decision: latestApproval.approval.decision,
          note: latestApproval.approval.note,
          remainingRisks: latestApproval.approval.remainingRisks,
          reviewer: latestApproval.approvedBy,
          createdAt: latestApproval.approval.createdAt.toISOString()
        }
      : null,
    generatedAt: generatedAt.toISOString()
  };

  const [report] = await db
    .insert(releaseReports)
    .values({
      organizationId,
      projectId: project.id,
      featureRequestId: featureRequest.id,
      pullRequestId: pullRequest.id,
      approvalId: latestApproval?.approval.id ?? null,
      title: `Developer Fix Report - ${featureRequest.title}`,
      status: "generated",
      shareToken: createShareToken(),
      reportData: toJsonObject(reportData),
      readinessScore: qaReviewBundle.review.readinessScore,
      generatedBy: workspace.appUser.id,
      generatedAt
    })
    .returning();

  if (!report) {
    throw new Error("Unable to generate developer fix report.");
  }

  await writeAuditLog({
    organizationId,
    actorId: workspace.appUser.id,
    action: "developer_fix_report_generated",
    entityType: "release_report",
    entityId: report.id,
    metadata: toJsonObject({
      featureRequestId: featureRequest.id,
      pullRequestId: pullRequest.id,
      approvalId: latestApproval?.approval.id ?? null,
      shareToken: report.shareToken
    })
  });

  return toTypedReport(report);
}

export async function getLatestReleaseReportForFeature(
  ctx: ProtectedContext,
  featureRequestId: string,
  reportType?: ReleaseReportType
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  await getScopedFeatureOrThrow(featureRequestId, workspace.activeOrganization.id);

  const reports = await db
    .select()
    .from(releaseReports)
    .where(
      and(
        eq(releaseReports.featureRequestId, featureRequestId),
        eq(releaseReports.organizationId, workspace.activeOrganization.id)
      )
    )
    .orderBy(desc(releaseReports.createdAt))
    .limit(reportType ? 50 : 1);

  const report = reportType
    ? reports.find((candidate) => getReportType(candidate) === reportType)
    : reports[0];

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
