import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  approvals,
  db,
  engineeringTasks,
  featureRequests,
  githubAppInstallations,
  githubProofPublications,
  prSnapshots,
  prdRequirements,
  prds,
  projects,
  pullRequests,
  qaFindings,
  qaRequirementCoverage,
  qaReviews,
  releaseReports,
  repositories,
  type JsonObject
} from "@veriflow/db";
import {
  createCommitStatus,
  getGitHubAppInstallUrl,
  hasFallbackGitHubToken,
  hasGitHubAppConfig,
  upsertPullRequestComment
} from "@veriflow/github";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

const PROOF_COMMENT_MARKER = "<!-- mergemint-verification -->";
const PROOF_STATUS_CONTEXT = "MergeMint Verification";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

type CoverageStatus =
  | "covered"
  | "partial"
  | "missing"
  | "not_applicable"
  | "needs_human_approval";

type CoverageSeverity = "blocking" | "warning" | "info";
type GitHubAccessReason =
  | "github_app_not_installed"
  | "repo_not_selected"
  | "missing_permissions"
  | "pr_not_found"
  | "token_resolution_failed"
  | "github_api_error";

type GitHubAccessState = {
  ok: boolean;
  reason: GitHubAccessReason | null;
  message: string | null;
  connectUrl: string | null;
  updateUrl: string | null;
  canUseDevFallback: boolean;
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

function toIso(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL;
}

function getGitHubInstallationManageUrl(installationId?: number | null) {
  return installationId
    ? `https://github.com/settings/installations/${installationId}`
    : null;
}

function readPermission(
  installation: typeof githubAppInstallations.$inferSelect | null,
  name: string
) {
  const permissions = installation?.permissions;

  if (!permissions || typeof permissions !== "object") {
    return null;
  }

  const value = (permissions as Record<string, unknown>)[name];
  return typeof value === "string" ? value : null;
}

function hasWritePermission(
  installation: typeof githubAppInstallations.$inferSelect | null,
  name: string
) {
  const value = readPermission(installation, name);
  return value === "write" || value === "admin";
}

function hasReadPermission(
  installation: typeof githubAppInstallations.$inferSelect | null,
  name: string
) {
  const value = readPermission(installation, name);
  return value === "read" || value === "write" || value === "admin";
}

function getMissingPermissionNames(
  installation: typeof githubAppInstallations.$inferSelect | null
) {
  if (!installation) {
    return [];
  }

  const missing: string[] = [];

  if (!hasReadPermission(installation, "pull_requests")) {
    missing.push("Pull requests: read");
  }

  if (
    !hasWritePermission(installation, "issues") &&
    !hasWritePermission(installation, "pull_requests")
  ) {
    missing.push("Issues or pull requests: write");
  }

  if (!hasWritePermission(installation, "statuses")) {
    missing.push("Commit statuses: write");
  }

  return missing;
}

function buildGitHubAccessState(input: {
  repository: typeof repositories.$inferSelect | null;
  installation: typeof githubAppInstallations.$inferSelect | null;
}): GitHubAccessState {
  const installUrl = getGitHubAppInstallUrl();
  const appConfigured = hasGitHubAppConfig();
  const devFallback = hasFallbackGitHubToken() && !appConfigured;

  if (!input.repository) {
    return {
      ok: false,
      reason: "pr_not_found",
      message: "Linked GitHub repository was not found.",
      connectUrl: installUrl,
      updateUrl: null,
      canUseDevFallback: devFallback
    };
  }

  if (!input.repository.githubAppInstallationId) {
    return {
      ok: devFallback,
      reason: devFallback ? null : "github_app_not_installed",
      message: devFallback
        ? null
        : "GitHub access is not connected for this repository. Install or update the MergeMint GitHub App for this repo, then try again.",
      connectUrl: installUrl,
      updateUrl: null,
      canUseDevFallback: devFallback
    };
  }

  const updateUrl = getGitHubInstallationManageUrl(
    input.repository.githubAppInstallationId
  );

  if (!input.installation) {
    return {
      ok: false,
      reason: "token_resolution_failed",
      message:
        "GitHub App installation metadata was not found for this workspace. Reconnect the MergeMint GitHub App, then try again.",
      connectUrl: installUrl,
      updateUrl,
      canUseDevFallback: devFallback
    };
  }

  if (!input.repository.githubAppSelected) {
    return {
      ok: false,
      reason: "repo_not_selected",
      message:
        "GitHub access is not connected for this repository. Install or update the MergeMint GitHub App for this repo, then try again.",
      connectUrl: installUrl,
      updateUrl,
      canUseDevFallback: devFallback
    };
  }

  const missingPermissions = getMissingPermissionNames(input.installation);
  if (missingPermissions.length > 0) {
    return {
      ok: false,
      reason: "missing_permissions",
      message:
        "MergeMint GitHub App is installed but missing required permissions for PR comments/status checks. Update app permissions and reinstall/approve access.",
      connectUrl: installUrl,
      updateUrl,
      canUseDevFallback: devFallback
    };
  }

  return {
    ok: true,
    reason: null,
    message: null,
    connectUrl: installUrl,
    updateUrl,
    canUseDevFallback: devFallback
  };
}

function summarizeEvidence(value: unknown) {
  const evidence = value as
    | { summary?: string | null; notes?: string[] | null }
    | null
    | undefined;
  const notes = Array.isArray(evidence?.notes) ? evidence.notes.filter(Boolean) : [];

  return evidence?.summary || notes[0] || "Evidence not found.";
}

function mapCoverageStatus(status: string, hasHumanReviewFinding: boolean): CoverageStatus {
  if (hasHumanReviewFinding) {
    return "needs_human_approval";
  }

  if (
    status === "covered" ||
    status === "partial" ||
    status === "missing" ||
    status === "not_applicable"
  ) {
    return status;
  }

  return "partial";
}

function severityForStatus(status: CoverageStatus, hasBlockingFinding: boolean): CoverageSeverity {
  if (hasBlockingFinding || status === "missing") {
    return "blocking";
  }

  if (status === "partial" || status === "needs_human_approval") {
    return "warning";
  }

  return "info";
}

function nextActionForStatus(status: CoverageStatus, hasBlockingFinding: boolean) {
  if (status === "covered" || status === "not_applicable") {
    return "No action needed.";
  }

  if (status === "needs_human_approval") {
    return "Ask the reviewer to approve, reject, or request changes.";
  }

  if (status === "missing") {
    return "Implement this requirement or mark it explicitly out of scope.";
  }

  if (hasBlockingFinding) {
    return "Fix the blocking review finding, then run QA again.";
  }

  return "Add missing evidence or complete the partial implementation.";
}

function getFindingCounts(findings: Array<typeof qaFindings.$inferSelect>) {
  const openFindings = findings.filter(
    (finding) => finding.status === "open" || finding.status === "needs_human_review"
  );
  const blocking = openFindings.filter(
    (finding) => finding.severity === "high" || finding.severity === "critical"
  );

  return {
    blocking: blocking.length,
    nonBlocking: openFindings.length - blocking.length,
    open: openFindings.length
  };
}

function getVerdict(input: {
  review: typeof qaReviews.$inferSelect;
  coverageSummary: { missing: number; partial: number; needsHumanApproval: number };
  blockingFindings: number;
}) {
  if (input.blockingFindings > 0 || input.coverageSummary.missing > 0) {
    return "Needs Changes";
  }

  if (
    input.review.overallStatus === "failed" ||
    input.review.overallStatus === "needs_changes"
  ) {
    return "Blocked";
  }

  if (input.coverageSummary.partial > 0 || input.coverageSummary.needsHumanApproval > 0) {
    return "Ready with Risks";
  }

  if ((input.review.readinessScore ?? 0) >= 85) {
    return "Verified";
  }

  return "Ready with Risks";
}

function getMergeRecommendation(input: {
  missing: number;
  partial: number;
  blockingFindings: number;
  nonBlockingFindings: number;
}) {
  if (input.blockingFindings > 0 || input.missing > 0) {
    return "Do not merge yet";
  }

  if (input.partial > 0 || input.nonBlockingFindings > 0) {
    return "Merge with caution";
  }

  return "Safe to merge";
}

async function getScopedFeatureGraph(featureRequestId: string, organizationId: string) {
  const [row] = await db
    .select({
      feature: featureRequests,
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

  const [prd, pullRequest, latestApproval, latestClientReport] = await Promise.all([
    db
      .select()
      .from(prds)
      .where(eq(prds.featureRequestId, featureRequestId))
      .orderBy(desc(prds.version))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(pullRequests)
      .where(
        and(
          eq(pullRequests.featureRequestId, featureRequestId),
          eq(pullRequests.organizationId, organizationId)
        )
      )
      .orderBy(desc(pullRequests.updatedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(approvals)
      .where(eq(approvals.featureRequestId, featureRequestId))
      .orderBy(desc(approvals.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(releaseReports)
      .where(eq(releaseReports.featureRequestId, featureRequestId))
      .orderBy(desc(releaseReports.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null)
  ]);

  const [latestReview, requirements, tasks] = await Promise.all([
    pullRequest
      ? db
          .select()
          .from(qaReviews)
          .where(
            and(
              eq(qaReviews.featureRequestId, featureRequestId),
              eq(qaReviews.pullRequestId, pullRequest.id),
              eq(qaReviews.organizationId, organizationId)
            )
          )
          .orderBy(desc(qaReviews.reviewVersion), desc(qaReviews.createdAt))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    prd
      ? db
          .select()
          .from(prdRequirements)
          .where(eq(prdRequirements.prdId, prd.id))
          .orderBy(prdRequirements.requirementKey)
      : Promise.resolve([]),
    prd
      ? db
          .select()
          .from(engineeringTasks)
          .where(eq(engineeringTasks.prdId, prd.id))
          .orderBy(engineeringTasks.orderIndex, engineeringTasks.createdAt)
      : Promise.resolve([])
  ]);

  const [coverage, findings, snapshot, proof, repository] = await Promise.all([
    latestReview
      ? db
          .select()
          .from(qaRequirementCoverage)
          .where(eq(qaRequirementCoverage.qaReviewId, latestReview.id))
          .orderBy(qaRequirementCoverage.requirementKey)
      : Promise.resolve([]),
    latestReview
      ? db
          .select()
          .from(qaFindings)
          .where(eq(qaFindings.qaReviewId, latestReview.id))
          .orderBy(desc(qaFindings.createdAt))
      : Promise.resolve([]),
    pullRequest
      ? db
          .select()
          .from(prSnapshots)
          .where(eq(prSnapshots.pullRequestId, pullRequest.id))
          .orderBy(desc(prSnapshots.createdAt))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    pullRequest
      ? db
          .select()
          .from(githubProofPublications)
          .where(
            and(
              eq(githubProofPublications.featureRequestId, featureRequestId),
              eq(githubProofPublications.pullRequestId, pullRequest.id)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    pullRequest
      ? db
          .select()
          .from(repositories)
          .where(eq(repositories.id, pullRequest.repositoryId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null)
  ]);
  const installation = repository?.githubAppInstallationId
    ? await db
        .select()
        .from(githubAppInstallations)
        .where(
          and(
            eq(
              githubAppInstallations.organizationId,
              row.feature.organizationId
            ),
            eq(
              githubAppInstallations.installationId,
              repository.githubAppInstallationId
            )
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  return {
    ...row,
    prd,
    pullRequest,
    latestReview,
    latestApproval,
    latestClientReport,
    requirements,
    tasks,
    coverage,
    findings,
    snapshot,
    proof,
    repository,
    installation
  };
}

function buildCoverageMap(graph: Awaited<ReturnType<typeof getScopedFeatureGraph>>) {
  const tasksByRequirement = new Map<string, Array<typeof engineeringTasks.$inferSelect>>();
  for (const task of graph.tasks) {
    for (const key of task.relatedRequirementKeys) {
      const list = tasksByRequirement.get(key) ?? [];
      list.push(task);
      tasksByRequirement.set(key, list);
    }
  }

  const coverageByRequirement = new Map(
    graph.coverage.map((coverage) => [coverage.requirementKey, coverage])
  );
  const findingsByRequirement = new Map<string, Array<typeof qaFindings.$inferSelect>>();
  for (const finding of graph.findings) {
    if (!finding.requirementKey) {
      continue;
    }
    const list = findingsByRequirement.get(finding.requirementKey) ?? [];
    list.push(finding);
    findingsByRequirement.set(finding.requirementKey, list);
  }

  const changedFileNames =
    graph.snapshot?.changedFiles.map((file) => file.filename).filter(Boolean) ?? [];

  const rows = graph.requirements.map((requirement, index) => {
    const requirementKey = requirement.requirementKey || `REQ-${String(index + 1).padStart(3, "0")}`;
    const coverage = coverageByRequirement.get(requirementKey);
    const relatedFindings = findingsByRequirement.get(requirementKey) ?? [];
    const hasHumanReviewFinding = relatedFindings.some(
      (finding) => finding.status === "needs_human_review"
    );
    const hasBlockingFinding = relatedFindings.some(
      (finding) =>
        finding.status === "open" &&
        (finding.severity === "high" || finding.severity === "critical")
    );
    const status = mapCoverageStatus(
      coverage?.status ?? "missing",
      hasHumanReviewFinding
    );
    const relatedTasks = tasksByRequirement.get(requirementKey) ?? [];
    const suggestedFiles = new Set<string>();

    for (const task of relatedTasks) {
      for (const file of task.suggestedFiles) {
        suggestedFiles.add(file);
      }
    }

    for (const finding of relatedFindings) {
      if (finding.file) {
        suggestedFiles.add(finding.file);
      }
    }

    const relatedFiles = [...suggestedFiles].filter((file) =>
      changedFileNames.length === 0 ? true : changedFileNames.includes(file)
    );

    return {
      requirementId: requirementKey,
      requirementText: requirement.requirement,
      status,
      evidenceSummary: coverage ? summarizeEvidence(coverage.evidence) : "Evidence not found.",
      relatedEngineeringTask: relatedTasks[0]
        ? {
            id: relatedTasks[0].id,
            title: relatedTasks[0].title,
            status: relatedTasks[0].status
          }
        : null,
      relatedFiles,
      severity: severityForStatus(status, hasBlockingFinding),
      suggestedNextAction: nextActionForStatus(status, hasBlockingFinding),
      confidence: graph.latestReview?.confidenceScore ?? null
    };
  });

  const summary = {
    total: rows.length,
    covered: rows.filter((row) => row.status === "covered").length,
    partial: rows.filter((row) => row.status === "partial").length,
    missing: rows.filter((row) => row.status === "missing").length,
    notApplicable: rows.filter((row) => row.status === "not_applicable").length,
    needsHumanApproval: rows.filter((row) => row.status === "needs_human_approval").length
  };

  return {
    rows,
    summary
  };
}

function buildDeveloperFixPack(input: {
  feature: typeof featureRequests.$inferSelect;
  pullRequest: typeof pullRequests.$inferSelect | null;
  coverageMap: ReturnType<typeof buildCoverageMap>;
  findings: Array<typeof qaFindings.$inferSelect>;
}) {
  const blockingFindings = input.findings.filter(
    (finding) =>
      finding.status === "open" &&
      (finding.severity === "high" || finding.severity === "critical")
  );
  const nonBlockingFindings = input.findings.filter(
    (finding) =>
      finding.status === "open" &&
      finding.severity !== "high" &&
      finding.severity !== "critical"
  );
  const missingRows = input.coverageMap.rows.filter(
    (row) => row.status === "missing" || row.status === "partial"
  );
  const likelyFiles = [
    ...new Set([
      ...missingRows.flatMap((row) => row.relatedFiles),
      ...input.findings.map((finding) => finding.file).filter(Boolean)
    ])
  ] as string[];
  const checklist = [
    "Address every blocking finding.",
    "Confirm each missing or partial requirement has implementation evidence.",
    "Add or update tests for changed behavior.",
    "Re-run MergeMint QA after pushing fixes."
  ];

  const fixPrompt = [
    `You are fixing ${input.feature.title}.`,
    input.pullRequest
      ? `Use GitHub PR #${input.pullRequest.githubPrNumber}: ${input.pullRequest.title}.`
      : "A linked PR was not available in this context.",
    "Do not invent requirements. Work only from the listed MergeMint gaps.",
    "",
    "Missing or partial requirements:",
    ...missingRows.map(
      (row) => `- ${row.requirementId}: ${row.requirementText} (${row.status})`
    ),
    "",
    "Blocking findings:",
    ...blockingFindings.map((finding) => `- ${finding.title}: ${finding.description}`),
    "",
    "Suggested tests:",
    "- Add regression coverage for each fixed requirement.",
    "- Verify the user-facing acceptance criteria still pass."
  ].join("\n");

  return {
    summary:
      missingRows.length > 0 || blockingFindings.length > 0
        ? "Fix required before this PR should be treated as verified."
        : "No blocking fix pack items were found in the latest review.",
    whyItMatters:
      "MergeMint proof depends on matching the implementation to the original request, PRD acceptance criteria, and engineering tasks.",
    impactedRequirements: missingRows.map((row) => row.requirementId),
    likelyFiles,
    blocking: blockingFindings.map((finding) => ({
      title: finding.title,
      requirementKey: finding.requirementKey,
      description: finding.description,
      suggestedFix: finding.suggestedFix,
      file: finding.file,
      line: finding.line
    })),
    nonBlocking: nonBlockingFindings.map((finding) => ({
      title: finding.title,
      requirementKey: finding.requirementKey,
      description: finding.description,
      suggestedFix: finding.suggestedFix,
      file: finding.file,
      line: finding.line
    })),
    suggestedImplementationApproach:
      "Fix the blocking requirement gaps first, then tighten evidence and tests for partial coverage.",
    suggestedTests: [
      "Add regression tests for fixed requirements.",
      "Run the app workflow that exercises the changed behavior.",
      "Re-run MergeMint QA against the updated PR snapshot."
    ],
    fixPrompt,
    reReviewChecklist: checklist
  };
}

function buildEvidenceGraph(graph: Awaited<ReturnType<typeof getScopedFeatureGraph>>) {
  return [
    {
      id: "feature_request",
      label: "Feature Request",
      status: "completed",
      timestamp: toIso(graph.feature.createdAt),
      href: `/app/features/${graph.feature.id}`
    },
    {
      id: "prd",
      label: "PRD",
      status: graph.prd ? "completed" : "missing",
      timestamp: toIso(graph.prd?.createdAt),
      href: graph.prd ? `/app/features/${graph.feature.id}` : null
    },
    {
      id: "engineering_tasks",
      label: "Engineering Tasks",
      status: graph.tasks.length > 0 ? "completed" : "missing",
      timestamp: toIso(graph.tasks[0]?.createdAt),
      href: `/app/features/${graph.feature.id}`
    },
    {
      id: "pr_diff",
      label: "PR Diff",
      status: graph.snapshot ? "completed" : graph.pullRequest ? "partial" : "missing",
      timestamp: toIso(graph.snapshot?.createdAt),
      href: graph.pullRequest?.htmlUrl ?? null
    },
    {
      id: "qa_evidence",
      label: "QA Evidence",
      status: graph.latestReview ? "completed" : "missing",
      timestamp: toIso(graph.latestReview?.createdAt),
      href: `/app/features/${graph.feature.id}`
    },
    {
      id: "fix_pack",
      label: "Fix Pack",
      status: graph.findings.length > 0 ? "completed" : "partial",
      timestamp: toIso(graph.latestReview?.createdAt),
      href: `/app/features/${graph.feature.id}`
    },
    {
      id: "human_approval",
      label: "Human Approval",
      status: graph.latestApproval ? "completed" : "missing",
      timestamp: toIso(graph.latestApproval?.createdAt),
      href: `/app/features/${graph.feature.id}`
    },
    {
      id: "release_report",
      label: "Release Report",
      status: graph.latestClientReport ? "completed" : "missing",
      timestamp: toIso(graph.latestClientReport?.createdAt),
      href: graph.latestClientReport
        ? `/reports/${graph.latestClientReport.shareToken}`
        : `/app/features/${graph.feature.id}`
    },
    {
      id: "github_proof",
      label: "GitHub Proof",
      status: graph.proof?.lastPublishStatus === "posted" ? "completed" : "missing",
      timestamp: toIso(graph.proof?.lastPublishedAt),
      href: graph.pullRequest?.htmlUrl ?? null
    }
  ];
}

async function buildProofGateView(featureRequestId: string, organizationId: string) {
  const graph = await getScopedFeatureGraph(featureRequestId, organizationId);
  const coverageMap = buildCoverageMap(graph);
  const findingCounts = getFindingCounts(graph.findings);
  const mergeRecommendation = getMergeRecommendation({
    missing: coverageMap.summary.missing,
    partial: coverageMap.summary.partial,
    blockingFindings: findingCounts.blocking,
    nonBlockingFindings: findingCounts.nonBlocking
  });
  const verdict = graph.latestReview
    ? getVerdict({
        review: graph.latestReview,
        coverageSummary: coverageMap.summary,
        blockingFindings: findingCounts.blocking
      })
    : "Not Reviewed";
  const prUpdatedAfterLastReview = Boolean(
    graph.latestReview &&
      graph.snapshot?.createdAt &&
      graph.snapshot.createdAt > graph.latestReview.createdAt
  );
  const githubAccess = buildGitHubAccessState({
    repository: graph.repository,
    installation: graph.installation
  });

  return {
    feature: {
      id: graph.feature.id,
      title: graph.feature.title
    },
    project: {
      id: graph.project.id,
      name: graph.project.name
    },
    pullRequest: graph.pullRequest
      ? {
          id: graph.pullRequest.id,
          number: graph.pullRequest.githubPrNumber,
          title: graph.pullRequest.title,
          url: graph.pullRequest.htmlUrl,
          latestCommitSha: graph.pullRequest.latestCommitSha,
          repository: graph.repository?.fullName ?? null
        }
      : null,
    latestQaReview: graph.latestReview
      ? {
          id: graph.latestReview.id,
          overallStatus: graph.latestReview.overallStatus,
          readinessScore: graph.latestReview.readinessScore,
          confidenceScore: graph.latestReview.confidenceScore,
          reviewVersion: graph.latestReview.reviewVersion,
          createdAt: graph.latestReview.createdAt
        }
      : null,
    coverageMap,
    developerFixPack: buildDeveloperFixPack({
      feature: graph.feature,
      pullRequest: graph.pullRequest,
      coverageMap,
      findings: graph.findings
    }),
    evidenceGraph: buildEvidenceGraph(graph),
    findingCounts,
    mergeRecommendation,
    verdict,
    githubAccess,
    stale: prUpdatedAfterLastReview,
    reportUrl: graph.latestClientReport
      ? `/reports/${graph.latestClientReport.shareToken}`
      : null,
    proof: graph.proof
      ? {
          id: graph.proof.id,
          commentId: graph.proof.githubCommentId,
          statusContext: graph.proof.githubStatusContext,
          lastPublishStatus: graph.proof.lastPublishStatus,
          lastPublishReason:
            graph.proof.lastPublishStatus === "failed"
              ? "github_api_error"
              : null,
          lastPublishError: graph.proof.lastPublishError,
          lastPublishedCommitSha: graph.proof.lastPublishedCommitSha,
          lastPublishedAt: graph.proof.lastPublishedAt
        }
      : null
  };
}

function buildProofComment(input: Awaited<ReturnType<typeof buildProofGateView>>) {
  const coverage = input.coverageMap.summary;
  const topRisks = input.developerFixPack.blocking
    .concat(input.developerFixPack.nonBlocking)
    .slice(0, 5);
  const publicAppUrl = getPublicAppUrl();
  const reportLink = input.reportUrl && publicAppUrl
    ? `${publicAppUrl}${input.reportUrl}`
    : input.reportUrl;

  return [
    PROOF_COMMENT_MARKER,
    "## MergeMint Verification",
    "",
    "MergeMint checks whether this PR satisfies the original feature request, PRD, acceptance criteria, and engineering tasks.",
    "",
    `**Verdict:** ${input.verdict}`,
    `**Readiness score:** ${input.latestQaReview?.readinessScore ?? "Not reviewed"}`,
    `**Feature:** ${input.feature.title}`,
    `**Project/Repo:** ${input.project.name}${input.pullRequest?.repository ? ` / ${input.pullRequest.repository}` : ""}`,
    `**Merge recommendation:** ${input.mergeRecommendation}`,
    input.stale
      ? "**Stale warning:** This PR changed after the latest MergeMint review. Re-run QA before publishing proof."
      : null,
    "",
    "### Requirement Coverage",
    `- Covered: ${coverage.covered}`,
    `- Partial: ${coverage.partial}`,
    `- Missing: ${coverage.missing}`,
    `- Not Applicable: ${coverage.notApplicable}`,
    `- Needs Human Approval: ${coverage.needsHumanApproval}`,
    "",
    "| Requirement | Status | Evidence | Next action |",
    "| --- | --- | --- | --- |",
    ...input.coverageMap.rows.map(
      (row) =>
        `| ${row.requirementId} | ${row.status} | ${row.evidenceSummary.replace(/\|/g, "\\|")} | ${row.suggestedNextAction.replace(/\|/g, "\\|")} |`
    ),
    "",
    "### Developer Fix Pack",
    input.developerFixPack.summary,
    ...topRisks.map((risk) => `- ${risk.title}: ${risk.suggestedFix ?? risk.description}`),
    "",
    `**Human approval:** ${input.evidenceGraph.find((node) => node.id === "human_approval")?.status ?? "missing"}`,
    reportLink ? `**Full MergeMint report:** ${reportLink}` : null,
    `**Published:** ${new Date().toISOString()}`
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");
}

function mapStatusState(verdict: string): "failure" | "success" {
  if (verdict === "Needs Changes" || verdict === "Blocked") {
    return "failure";
  }

  return "success";
}

export async function getRequirementCoverageMap(
  ctx: ProtectedContext,
  featureRequestId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  const view = await buildProofGateView(
    featureRequestId,
    workspace.activeOrganization.id
  );

  return view.coverageMap;
}

export async function getProofGateStatus(ctx: ProtectedContext, featureRequestId: string) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  return buildProofGateView(featureRequestId, workspace.activeOrganization.id);
}

export async function publishGitHubProof(
  ctx: ProtectedContext,
  featureRequestId: string,
  input: { source: "manual_user_action" }
) {
  if (input.source !== "manual_user_action") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "GitHub Proof must be manually published by the user."
    });
  }

  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "create_feature_request");

  const view = await buildProofGateView(featureRequestId, workspace.activeOrganization.id);

  if (!view.pullRequest) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Link a GitHub pull request before publishing proof."
    });
  }

  if (!view.latestQaReview) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Run QA review before publishing proof."
    });
  }

  const graph = await getScopedFeatureGraph(featureRequestId, workspace.activeOrganization.id);

  if (!graph.pullRequest || !graph.repository) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Linked GitHub repository was not found."
    });
  }

  const githubAccess = buildGitHubAccessState({
    repository: graph.repository,
    installation: graph.installation
  });

  if (!githubAccess.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        githubAccess.message ??
        "GitHub access is not connected for this repository. Install or update the MergeMint GitHub App for this repo, then try again."
    });
  }

  const now = new Date();
  const existingProof = graph.proof;
  const proofRecordValues = {
    organizationId: workspace.activeOrganization.id,
    featureRequestId,
    pullRequestId: graph.pullRequest.id,
    qaReviewId: view.latestQaReview.id,
    githubStatusContext: PROOF_STATUS_CONTEXT,
    lastPublishedCommitSha: graph.pullRequest.latestCommitSha,
    coverageSnapshot: toJsonObject(view.coverageMap),
    publishedBy: workspace.appUser.id,
    updatedAt: now
  };

  const [proofRecord] = existingProof
    ? await db
        .update(githubProofPublications)
        .set({
          ...proofRecordValues,
          lastPublishStatus: "publishing",
          lastPublishError: null
        })
        .where(eq(githubProofPublications.id, existingProof.id))
        .returning()
    : await db
        .insert(githubProofPublications)
        .values({
          ...proofRecordValues,
          lastPublishStatus: "publishing",
          createdAt: now
        })
        .returning();

  if (!proofRecord) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to prepare GitHub proof publication."
    });
  }

  try {
    const body = buildProofComment(view);
    const comment = await upsertPullRequestComment({
      owner: graph.repository.owner,
      repo: graph.repository.name,
      pullNumber: graph.pullRequest.githubPrNumber,
      installationId: graph.repository.githubAppInstallationId,
      commentId: proofRecord.githubCommentId,
      marker: PROOF_COMMENT_MARKER,
      body
    });

    let statusResult: { state?: string; context?: string } | null = null;
    if (graph.pullRequest.latestCommitSha) {
      statusResult = await createCommitStatus({
        owner: graph.repository.owner,
        repo: graph.repository.name,
        sha: graph.pullRequest.latestCommitSha,
        installationId: graph.repository.githubAppInstallationId,
        context: PROOF_STATUS_CONTEXT,
        state: mapStatusState(view.verdict),
        description: `${view.verdict}: ${view.coverageMap.summary.covered}/${view.coverageMap.summary.total} requirements covered`,
        targetUrl: view.reportUrl && getPublicAppUrl()
          ? `${getPublicAppUrl()}${view.reportUrl}`
          : graph.pullRequest.htmlUrl
      });
    }

    const [updated] = await db
      .update(githubProofPublications)
      .set({
        githubCommentId: comment.commentId,
        githubStatusContext: statusResult?.context ?? PROOF_STATUS_CONTEXT,
        lastPublishStatus: comment.updated ? "updated" : "posted",
        lastPublishError: null,
        lastPublishedCommitSha: graph.pullRequest.latestCommitSha,
        lastPublishedAt: now,
        updatedAt: now
      })
      .where(eq(githubProofPublications.id, proofRecord.id))
      .returning();

    return {
      ...(await buildProofGateView(featureRequestId, workspace.activeOrganization.id)),
      proof: updated
        ? {
            id: updated.id,
            commentId: updated.githubCommentId,
            statusContext: updated.githubStatusContext,
            lastPublishStatus: updated.lastPublishStatus,
            lastPublishReason:
              updated.lastPublishStatus === "failed" ? "github_api_error" : null,
            lastPublishError: updated.lastPublishError,
            lastPublishedCommitSha: updated.lastPublishedCommitSha,
            lastPublishedAt: updated.lastPublishedAt
          }
        : null
    };
  } catch (error) {
    const safeMessage =
      error instanceof Error ? error.message : "Unable to publish GitHub proof.";

    await db
      .update(githubProofPublications)
      .set({
        lastPublishStatus: "failed",
        lastPublishError: safeMessage,
        updatedAt: new Date()
      })
      .where(eq(githubProofPublications.id, proofRecord.id));

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: safeMessage
    });
  }
}
