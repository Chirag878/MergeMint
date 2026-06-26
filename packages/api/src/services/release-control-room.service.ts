import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  aiRuns,
  approvals,
  clarificationQuestions,
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
  repositories
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { hasClarificationAnswerChangedAfterPrd } from "./prd-staleness";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

type TimelineSource = "user" | "AI" | "GitHub" | "system";
type ProgressStatus = "complete" | "current" | "blocked" | "pending";
type NextActionKind =
  | "generate_prd"
  | "link_pr"
  | "run_qa_review"
  | "review_risks"
  | "submit_approval"
  | "generate_report"
  | "open_report"
  | "rerun_qa";

function toBootstrapInput(ctx: ProtectedContext) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

function isOpenFinding(finding: typeof qaFindings.$inferSelect) {
  return finding.status === "open" || finding.status === "needs_human_review";
}

function isHighCritical(finding: typeof qaFindings.$inferSelect) {
  return finding.severity === "high" || finding.severity === "critical";
}

function isRiskyCoverage(status: string) {
  return status === "partial" || status === "missing" || status === "risky";
}

function isClientDeliveryReport(report: typeof releaseReports.$inferSelect) {
  const reportData = report.reportData as { reportType?: string };
  return !reportData.reportType || reportData.reportType === "client_delivery";
}

function getReleaseReadinessStatus(input: {
  prd: typeof prds.$inferSelect | null;
  pullRequest: typeof pullRequests.$inferSelect | null;
  qaReview: typeof qaReviews.$inferSelect | null;
  approval: typeof approvals.$inferSelect | null;
  releaseReport: typeof releaseReports.$inferSelect | null;
  prdMayBeOutdated: boolean;
  riskSummary: {
    unresolvedFindingsCount: number;
    highCriticalFindingsCount: number;
    partialRequirementsCount: number;
    missingRequirementsCount: number;
  };
}) {
  if (input.prdMayBeOutdated) {
    return "PRD Outdated";
  }

  if (
    input.approval?.decision === "changes_requested" ||
    input.approval?.decision === "rejected" ||
    input.riskSummary.highCriticalFindingsCount > 0 ||
    input.riskSummary.missingRequirementsCount > 0
  ) {
    return "Needs Attention";
  }

  if (input.releaseReport) {
    return "Report Generated";
  }

  if (
    input.approval?.decision === "approved" ||
    input.approval?.decision === "approved_with_risk"
  ) {
    return "Approved";
  }

  if (input.qaReview) {
    return "QA Reviewed";
  }

  if (input.pullRequest) {
    return "PR Linked";
  }

  if (input.prd) {
    return "PRD Ready";
  }

  return "Draft";
}

function getNextBestAction(input: {
  prd: typeof prds.$inferSelect | null;
  pullRequest: typeof pullRequests.$inferSelect | null;
  latestSnapshot: typeof prSnapshots.$inferSelect | null;
  qaReview: typeof qaReviews.$inferSelect | null;
  approval: typeof approvals.$inferSelect | null;
  releaseReport: typeof releaseReports.$inferSelect | null;
  hasUnresolvedRisk: boolean;
  prdMayBeOutdated: boolean;
}): { kind: NextActionKind; title: string; why: string } {
  if (!input.prd) {
    return {
      kind: "generate_prd",
      title: "Generate PRD",
      why: "The feature request is captured, but the requirement baseline has not been generated yet."
    };
  }

  if (input.prdMayBeOutdated) {
    return {
      kind: "generate_prd",
      title: "Regenerate PRD",
      why: "A clarification answer changed after the current PRD was generated, so downstream QA and release evidence may be outdated."
    };
  }

  if (!input.pullRequest) {
    return {
      kind: "link_pr",
      title: "Link GitHub PR",
      why: "A PRD exists. Link the implementation PR so MergeMint can collect code evidence."
    };
  }

  if (!input.qaReview) {
    return {
      kind: "run_qa_review",
      title: "Run AI QA Review",
      why: "The PR is linked. Run QA to compare the code snapshot against the requirement set."
    };
  }

  if (
    input.latestSnapshot &&
    input.latestSnapshot.createdAt > input.qaReview.createdAt
  ) {
    return {
      kind: "rerun_qa",
      title: "Re-run QA after PR changes",
      why: "The latest PR snapshot is newer than the latest QA review."
    };
  }

  if (
    input.hasUnresolvedRisk &&
    (!input.approval ||
      input.approval.decision === "changes_requested" ||
      input.approval.decision === "rejected")
  ) {
    return {
      kind: "review_risks",
      title: "Review risks",
      why: "The latest QA evidence still has unresolved findings or requirement gaps."
    };
  }

  if (!input.approval) {
    return {
      kind: "submit_approval",
      title: "Submit approval decision",
      why: "QA evidence is available. Record the human release decision."
    };
  }

  if (!input.releaseReport) {
    return {
      kind: "generate_report",
      title: "Generate release report",
      why: "The release decision is recorded. Generate the client-ready proof artifact."
    };
  }

  return {
    kind: "open_report",
    title: "Open public report",
    why: "The verification report has been generated and is ready to share."
  };
}

function buildStep(input: {
  id: string;
  label: string;
  completedAt?: Date | null;
  current: boolean;
  blocked?: boolean;
  blockedReason?: string;
  actionKind?: NextActionKind;
}) {
  const status: ProgressStatus = input.completedAt
    ? "complete"
    : input.blocked
      ? "blocked"
      : input.current
        ? "current"
        : "pending";

  return {
    id: input.id,
    label: input.label,
    status,
    timestamp: input.completedAt ?? null,
    blockedReason: status === "blocked" ? input.blockedReason : undefined,
    actionKind: status === "current" ? input.actionKind : undefined
  };
}

function addTimelineItem(
  items: Array<{
    title: string;
    timestamp: Date;
    source: TimelineSource;
    description: string;
  }>,
  item: {
    title: string;
    timestamp?: Date | null;
    source: TimelineSource;
    description: string;
  }
) {
  if (!item.timestamp) {
    return;
  }

  items.push({
    title: item.title,
    timestamp: item.timestamp,
    source: item.source,
    description: item.description
  });
}

export async function getReleaseControlRoom(
  ctx: ProtectedContext,
  featureRequestId: string,
  options: { includeTimeline?: boolean } = {}
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  const organizationId = workspace.activeOrganization.id;
  const [scoped] = await db
    .select({
      feature: featureRequests,
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

  if (!scoped) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Feature request not found."
    });
  }

  const [
    questions,
    prdRows,
    pullRequestRows,
    qaReviewRows,
    approvalRows,
    releaseReportRows,
    safeAiRuns
  ] = await Promise.all([
    db
      .select()
      .from(clarificationQuestions)
      .where(eq(clarificationQuestions.featureRequestId, scoped.feature.id))
      .orderBy(clarificationQuestions.createdAt),
    db
      .select()
      .from(prds)
      .where(eq(prds.featureRequestId, scoped.feature.id))
      .orderBy(desc(prds.version), desc(prds.createdAt)),
    db
      .select({
        pullRequest: pullRequests,
        repository: repositories
      })
      .from(pullRequests)
      .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
      .where(
        and(
          eq(pullRequests.featureRequestId, scoped.feature.id),
          eq(pullRequests.organizationId, organizationId),
          eq(repositories.organizationId, organizationId)
        )
      )
      .orderBy(desc(pullRequests.updatedAt)),
    db
      .select()
      .from(qaReviews)
      .where(
        and(
          eq(qaReviews.featureRequestId, scoped.feature.id),
          eq(qaReviews.organizationId, organizationId)
        )
      )
      .orderBy(desc(qaReviews.reviewVersion), desc(qaReviews.createdAt)),
    db
      .select()
      .from(approvals)
      .where(
        and(
          eq(approvals.featureRequestId, scoped.feature.id),
          eq(approvals.organizationId, organizationId)
        )
      )
      .orderBy(desc(approvals.createdAt)),
    db
      .select()
      .from(releaseReports)
      .where(
        and(
          eq(releaseReports.featureRequestId, scoped.feature.id),
          eq(releaseReports.organizationId, organizationId)
        )
      )
      .orderBy(desc(releaseReports.createdAt)),
    options.includeTimeline
      ? db
          .select({
            id: aiRuns.id,
            agentType: aiRuns.agentType,
            status: aiRuns.status,
            createdAt: aiRuns.createdAt
          })
          .from(aiRuns)
          .where(
            and(
              eq(aiRuns.featureRequestId, scoped.feature.id),
              eq(aiRuns.organizationId, organizationId)
            )
          )
          .orderBy(desc(aiRuns.createdAt))
      : Promise.resolve(
          [] as Array<{
            id: string;
            agentType: string;
            status: string;
            createdAt: Date;
          }>
        )
  ]);

  const latestPrd = prdRows[0] ?? null;
  const latestPullRequest = pullRequestRows[0]?.pullRequest ?? null;
  const latestRepository = pullRequestRows[0]?.repository ?? null;
  const latestQaReview = qaReviewRows[0] ?? null;
  const latestApproval = approvalRows[0] ?? null;
  const latestReleaseReport =
    releaseReportRows.find(isClientDeliveryReport) ?? null;
  const prdMayBeOutdated = hasClarificationAnswerChangedAfterPrd(
    questions,
    latestPrd
  );

  const [requirements, latestSnapshotRows, coverageRows, findingRows] =
    await Promise.all([
      latestPrd
        ? db
            .select()
            .from(prdRequirements)
            .where(eq(prdRequirements.prdId, latestPrd.id))
            .orderBy(prdRequirements.requirementKey)
        : Promise.resolve([] as Array<typeof prdRequirements.$inferSelect>),
      latestPullRequest
        ? db
            .select()
            .from(prSnapshots)
            .where(eq(prSnapshots.pullRequestId, latestPullRequest.id))
            .orderBy(desc(prSnapshots.createdAt))
            .limit(1)
        : Promise.resolve([] as Array<typeof prSnapshots.$inferSelect>),
      latestQaReview
        ? db
            .select()
            .from(qaRequirementCoverage)
            .where(eq(qaRequirementCoverage.qaReviewId, latestQaReview.id))
            .orderBy(qaRequirementCoverage.requirementKey)
        : Promise.resolve([] as Array<typeof qaRequirementCoverage.$inferSelect>),
      latestQaReview
        ? db
            .select()
            .from(qaFindings)
            .where(eq(qaFindings.qaReviewId, latestQaReview.id))
            .orderBy(desc(qaFindings.createdAt))
        : Promise.resolve([] as Array<typeof qaFindings.$inferSelect>)
    ]);

  const latestSnapshot = latestSnapshotRows[0] ?? null;
  const coverageByRequirementKey = new Map(
    coverageRows.map((coverage) => [coverage.requirementKey, coverage])
  );

  const requirementEvidence = requirements.map((requirement) => {
    const coverage = coverageByRequirementKey.get(requirement.requirementKey);
    const status = coverage?.status ?? "not_reviewed";

    return {
      requirementKey: requirement.requirementKey,
      requirement: requirement.requirement,
      priority: requirement.priority,
      status,
      concern: coverage?.concern ?? null,
      evidenceSummary: coverage?.evidence.summary ?? null
    };
  });

  const requirementEvidenceSummary = {
    covered: requirementEvidence.filter((item) => item.status === "covered"),
    partial: requirementEvidence.filter((item) => item.status === "partial"),
    missing: requirementEvidence.filter((item) => item.status === "missing"),
    risky: requirementEvidence.filter((item) => item.status === "risky"),
    notReviewed: requirementEvidence.filter(
      (item) => item.status === "not_reviewed" || item.status === "not_applicable"
    )
  };

  const openFindings = findingRows.filter(isOpenFinding);
  const partialRequirementsCount = coverageRows.filter(
    (coverage) => coverage.status === "partial"
  ).length;
  const missingRequirementsCount = coverageRows.filter(
    (coverage) => coverage.status === "missing"
  ).length;
  const riskyRequirementsCount = coverageRows.filter(
    (coverage) => String(coverage.status) === "risky"
  ).length;
  const riskSummary = {
    unresolvedFindingsCount: openFindings.length,
    highCriticalFindingsCount: openFindings.filter(isHighCritical).length,
    partialRequirementsCount,
    missingRequirementsCount,
    riskyRequirementsCount,
    approvalRiskNote:
      latestApproval?.decision === "approved_with_risk"
        ? latestApproval.note
        : null,
    remainingRisks: latestApproval?.remainingRisks ?? []
  };
  const hasUnresolvedRisk =
    openFindings.length > 0 ||
    coverageRows.some((coverage) => isRiskyCoverage(String(coverage.status))) ||
    (latestQaReview?.readinessScore ?? 100) < 80;

  const additions =
    latestSnapshot?.changedFiles.reduce(
      (total, file) => total + (file.additions ?? 0),
      0
    ) ?? 0;
  const deletions =
    latestSnapshot?.changedFiles.reduce(
      (total, file) => total + (file.deletions ?? 0),
      0
    ) ?? 0;

  const nextBestAction = getNextBestAction({
    prd: latestPrd,
    pullRequest: latestPullRequest,
    latestSnapshot,
    qaReview: latestQaReview,
    approval: latestApproval,
    releaseReport: latestReleaseReport,
    prdMayBeOutdated,
    hasUnresolvedRisk
  });

  const unansweredRequiredQuestions = questions.filter(
    (question) =>
      (question.priority === "high" || question.priority === "urgent") &&
      !question.answer
  );
  const progress = [
    buildStep({
      id: "feature_request",
      label: "Feature request captured",
      completedAt: scoped.feature.createdAt,
      current: false
    }),
    buildStep({
      id: "prd",
      label: "PRD generated",
      completedAt: latestPrd?.createdAt ?? null,
      current: !latestPrd,
      blocked:
        (!latestPrd && unansweredRequiredQuestions.length > 0) ||
        prdMayBeOutdated,
      blockedReason: prdMayBeOutdated
        ? "Clarification answers changed after this PRD was generated."
        : "Required clarification questions must be answered first.",
      actionKind: "generate_prd"
    }),
    buildStep({
      id: "pr",
      label: "PR linked",
      completedAt: latestPullRequest?.createdAt ?? null,
      current: Boolean(latestPrd && !prdMayBeOutdated && !latestPullRequest),
      actionKind: "link_pr"
    }),
    buildStep({
      id: "qa",
      label: "AI QA reviewed",
      completedAt: latestQaReview?.createdAt ?? null,
      current: Boolean(
        latestPrd &&
          !prdMayBeOutdated &&
          latestPullRequest &&
          latestSnapshot &&
          !latestQaReview
      ),
      blocked: Boolean(
        latestPrd &&
          latestPullRequest &&
          (prdMayBeOutdated || !latestSnapshot)
      ),
      blockedReason: prdMayBeOutdated
        ? "Regenerate the PRD before running QA."
        : "A PR snapshot is required before QA can run.",
      actionKind: "run_qa_review"
    }),
    buildStep({
      id: "approval",
      label: "Human decision recorded",
      completedAt: latestApproval?.createdAt ?? null,
      current: Boolean(latestQaReview && !latestApproval),
      actionKind: "submit_approval"
    }),
    buildStep({
      id: "report",
      label: "Release report generated",
      completedAt: latestReleaseReport?.generatedAt ?? latestReleaseReport?.createdAt ?? null,
      current: Boolean(latestQaReview && latestApproval && !latestReleaseReport),
      actionKind: "generate_report"
    })
  ];

  const timeline: Array<{
    title: string;
    timestamp: Date;
    source: TimelineSource;
    description: string;
  }> = [];
  if (options.includeTimeline) {
    addTimelineItem(timeline, {
      title: "Feature created",
      timestamp: scoped.feature.createdAt,
      source: "user",
      description: "The original client feature request was captured."
    });
    addTimelineItem(timeline, {
      title: "Clarification questions generated",
      timestamp: questions[0]?.createdAt,
      source: "AI",
      description: `${questions.length} clarification question${
        questions.length === 1 ? "" : "s"
      } generated.`
    });
    addTimelineItem(timeline, {
      title: "PRD generated",
      timestamp: latestPrd?.createdAt,
      source: "AI",
      description: latestPrd
        ? `PRD v${latestPrd.version} established the release baseline.`
        : ""
    });
    addTimelineItem(timeline, {
      title: "Requirements generated",
      timestamp: requirements[0]?.createdAt,
      source: "AI",
      description: `${requirements.length} requirement${
        requirements.length === 1 ? "" : "s"
      } generated from the PRD.`
    });
    addTimelineItem(timeline, {
      title: "GitHub PR linked",
      timestamp: latestPullRequest?.createdAt,
      source: "GitHub",
      description: latestPullRequest
        ? `${latestRepository?.fullName ?? "Repository"} #${
            latestPullRequest.githubPrNumber
          } linked.`
        : ""
    });
    addTimelineItem(timeline, {
      title: "PR snapshot refreshed",
      timestamp: latestSnapshot?.createdAt,
      source: "GitHub",
      description: latestSnapshot
        ? `${latestSnapshot.changedFiles.length} changed file${
            latestSnapshot.changedFiles.length === 1 ? "" : "s"
          } captured.`
        : ""
    });
    addTimelineItem(timeline, {
      title: "AI QA review generated",
      timestamp: latestQaReview?.createdAt,
      source: "AI",
      description: latestQaReview
        ? `Review v${latestQaReview.reviewVersion} returned ${latestQaReview.overallStatus}.`
        : ""
    });
    for (const approval of approvalRows) {
      addTimelineItem(timeline, {
        title: "Approval decision recorded",
        timestamp: approval.createdAt,
        source: "user",
        description: `Human decision: ${approval.decision}.`
      });
    }
    addTimelineItem(timeline, {
      title: "Release report generated",
      timestamp: latestReleaseReport?.generatedAt ?? latestReleaseReport?.createdAt,
      source: "system",
      description: latestReleaseReport
        ? `Shareable report "${latestReleaseReport.title}" was generated.`
        : ""
    });

    const clarificationRun = safeAiRuns.find(
      (run) => run.agentType === "clarification"
    );
    if (clarificationRun && questions.length === 0) {
      addTimelineItem(timeline, {
        title: "Clarification run recorded",
        timestamp: clarificationRun.createdAt,
        source: "AI",
        description: `Clarification agent ${clarificationRun.status}.`
      });
    }

    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  return {
    feature: {
      id: scoped.feature.id,
      title: scoped.feature.title,
      description: scoped.feature.description,
      status: scoped.feature.status,
      priority: scoped.feature.priority,
      createdAt: scoped.feature.createdAt,
      updatedAt: scoped.feature.updatedAt
    },
    project: {
      id: scoped.project.id,
      name: scoped.project.name,
      clientId: scoped.project.clientId,
      clientName: scoped.project.clientName
    },
    client: scoped.client
      ? {
          id: scoped.client.id,
          name: scoped.client.name,
          companyName: scoped.client.companyName,
          status: scoped.client.status
        }
      : null,
    releaseReadinessStatus: getReleaseReadinessStatus({
      prd: latestPrd,
      pullRequest: latestPullRequest,
      qaReview: latestQaReview,
      approval: latestApproval,
      releaseReport: latestReleaseReport,
      prdMayBeOutdated,
      riskSummary
    }),
    nextBestAction,
    prdMayBeOutdated,
    progress,
    riskSummary,
    requirementEvidenceSummary,
    prEvidence: latestPullRequest
      ? {
          pullRequestId: latestPullRequest.id,
          title: latestPullRequest.title,
          repo: latestRepository?.fullName ?? null,
          prNumber: latestPullRequest.githubPrNumber,
          branch: latestPullRequest.branch,
          baseBranch: latestPullRequest.baseBranch,
          htmlUrl: latestPullRequest.htmlUrl,
          changedFilesCount: latestSnapshot?.changedFiles.length ?? 0,
          additions,
          deletions,
          ciStatus: latestSnapshot?.ciStatus ?? "unknown",
          lastSnapshotAt: latestSnapshot?.createdAt ?? null
        }
      : null,
    qaReview: latestQaReview
      ? {
          id: latestQaReview.id,
          reviewVersion: latestQaReview.reviewVersion,
          readinessScore: latestQaReview.readinessScore,
          confidenceScore: latestQaReview.confidenceScore,
          verdict: latestQaReview.overallStatus,
          summary: latestQaReview.summary,
          createdAt: latestQaReview.createdAt,
          topFindings: findingRows.slice(0, 3).map((finding) => ({
            id: finding.id,
            title: finding.title,
            severity: finding.severity,
            status: finding.status,
            requirementKey: finding.requirementKey
          }))
        }
      : null,
    humanApproval: latestApproval
      ? {
          id: latestApproval.id,
          decision: latestApproval.decision,
          note: latestApproval.note,
          remainingRisks: latestApproval.remainingRisks,
          createdAt: latestApproval.createdAt,
          historyCount: approvalRows.length,
          history: approvalRows.map((approval) => ({
            id: approval.id,
            decision: approval.decision,
            note: approval.note,
            remainingRisks: approval.remainingRisks,
            createdAt: approval.createdAt
          }))
        }
      : {
          historyCount: approvalRows.length,
          history: approvalRows.map((approval) => ({
            id: approval.id,
            decision: approval.decision,
            note: approval.note,
            remainingRisks: approval.remainingRisks,
            createdAt: approval.createdAt
          }))
        },
    releaseReport: latestReleaseReport
      ? {
          id: latestReleaseReport.id,
          title: latestReleaseReport.title,
          status: latestReleaseReport.status,
          shareToken: latestReleaseReport.shareToken,
          readinessScore: latestReleaseReport.readinessScore,
          generatedAt: latestReleaseReport.generatedAt,
          createdAt: latestReleaseReport.createdAt
        }
      : null,
    timeline
  };
}
