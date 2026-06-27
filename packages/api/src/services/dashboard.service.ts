import { desc, eq, inArray } from "drizzle-orm";
import {
  approvals,
  clients,
  db,
  engineeringTasks,
  featureRequests,
  prds,
  projects,
  pullRequests,
  qaFindings,
  qaReviews,
  releaseReports
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};
type FeatureRow = typeof featureRequests.$inferSelect;
type ReleaseReportRow = typeof releaseReports.$inferSelect;

function toBootstrapInput(ctx: ProtectedContext) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

function latestByFeature<T extends { featureRequestId: string; createdAt: Date }>(
  rows: T[]
) {
  const map = new Map<string, T>();

  for (const row of rows) {
    const existing = map.get(row.featureRequestId);

    if (!existing || row.createdAt > existing.createdAt) {
      map.set(row.featureRequestId, row);
    }
  }

  return map;
}

function isClientDeliveryReport(report: ReleaseReportRow) {
  const reportData = report.reportData as { reportType?: string };
  return !reportData.reportType || reportData.reportType === "client_delivery";
}

function isOpenFinding(finding: typeof qaFindings.$inferSelect) {
  return finding.status === "open" || finding.status === "needs_human_review";
}

function getProjectName(
  projectById: Map<string, typeof projects.$inferSelect>,
  projectId: string
) {
  return projectById.get(projectId)?.name ?? "Project";
}

export async function getDashboardSummary(ctx: ProtectedContext) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  const organizationId = workspace.activeOrganization.id;

  const [
    clientRows,
    projectRows,
    featureRows,
    pullRequestRows,
    qaReviewRows,
    approvalRows,
    releaseReportRows,
    taskRows
  ] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(eq(clients.organizationId, organizationId))
      .orderBy(desc(clients.createdAt)),
    db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, organizationId))
      .orderBy(desc(projects.createdAt)),
    db
      .select()
      .from(featureRequests)
      .where(eq(featureRequests.organizationId, organizationId))
      .orderBy(desc(featureRequests.createdAt)),
    db
      .select()
      .from(pullRequests)
      .where(eq(pullRequests.organizationId, organizationId))
      .orderBy(desc(pullRequests.createdAt)),
    db
      .select()
      .from(qaReviews)
      .where(eq(qaReviews.organizationId, organizationId))
      .orderBy(desc(qaReviews.reviewVersion), desc(qaReviews.createdAt)),
    db
      .select()
      .from(approvals)
      .where(eq(approvals.organizationId, organizationId))
      .orderBy(desc(approvals.createdAt)),
    db
      .select()
      .from(releaseReports)
      .where(eq(releaseReports.organizationId, organizationId))
      .orderBy(desc(releaseReports.createdAt)),
    db
      .select()
      .from(engineeringTasks)
      .where(eq(engineeringTasks.organizationId, organizationId))
      .orderBy(desc(engineeringTasks.createdAt))
  ]);

  const featureIds = featureRows.map((feature) => feature.id);
  const qaReviewIds = qaReviewRows.map((review) => review.id);
  const [scopedPrds, findingRows] = await Promise.all([
    featureIds.length
      ? db
          .select()
          .from(prds)
          .where(inArray(prds.featureRequestId, featureIds))
          .orderBy(desc(prds.createdAt))
      : Promise.resolve([] as Array<typeof prds.$inferSelect>),
    qaReviewIds.length
      ? db
          .select()
          .from(qaFindings)
          .where(inArray(qaFindings.qaReviewId, qaReviewIds))
      : Promise.resolve([] as Array<typeof qaFindings.$inferSelect>)
  ]);

  const projectById = new Map(projectRows.map((project) => [project.id, project]));
  const clientById = new Map(clientRows.map((client) => [client.id, client]));
  const activeProjectIds = new Set(
    projectRows
      .filter(
        (project) => project.status !== "completed" && project.status !== "archived"
      )
      .map((project) => project.id)
  );
  const latestPrd = latestByFeature(scopedPrds);
  const latestPullRequest = latestByFeature(pullRequestRows);
  const latestQaReview = latestByFeature(qaReviewRows);
  const latestApproval = latestByFeature(approvalRows);
  const latestReleaseReport = latestByFeature(
    releaseReportRows.filter(isClientDeliveryReport)
  );
  const openFindingsByReviewId = new Map<string, number>();
  const tasksByFeatureId = new Map<string, Array<typeof engineeringTasks.$inferSelect>>();

  for (const task of taskRows) {
    const featureTasks = tasksByFeatureId.get(task.featureRequestId) ?? [];
    featureTasks.push(task);
    tasksByFeatureId.set(task.featureRequestId, featureTasks);
  }

  for (const finding of findingRows.filter(isOpenFinding)) {
    openFindingsByReviewId.set(
      finding.qaReviewId,
      (openFindingsByReviewId.get(finding.qaReviewId) ?? 0) + 1
    );
  }

  const needsAttention = featureRows
    .map((feature) => {
      const project = projectById.get(feature.projectId);
      if (!project || !activeProjectIds.has(project.id)) {
        return null;
      }
      const client = project?.clientId ? clientById.get(project.clientId) : null;
      const prd = latestPrd.get(feature.id);
      const pullRequest = latestPullRequest.get(feature.id);
      const qaReview = latestQaReview.get(feature.id);
      const approval = latestApproval.get(feature.id);
      const report = latestReleaseReport.get(feature.id);
      const tasks = tasksByFeatureId.get(feature.id) ?? [];
      const blockedTasks = tasks.filter((task) => task.status === "blocked");
      const highRiskTasks = tasks.filter((task) => task.riskLevel === "high");
      const openFindings = qaReview
        ? (openFindingsByReviewId.get(qaReview.id) ?? 0)
        : 0;

      if (!prd) {
        return {
          featureRequestId: feature.id,
          featureTitle: feature.title,
          projectName: getProjectName(projectById, feature.projectId),
          clientName: client?.companyName ?? client?.name ?? null,
          stage: "No PRD yet",
          nextAction: "Generate PRD"
        };
      }

      if (blockedTasks.length > 0) {
        return {
          featureRequestId: feature.id,
          featureTitle: feature.title,
          projectName: getProjectName(projectById, feature.projectId),
          clientName: client?.companyName ?? client?.name ?? null,
          stage: "Blocked engineering tasks",
          nextAction: "Resolve task blockers"
        };
      }

      if (highRiskTasks.length > 0 && !pullRequest) {
        return {
          featureRequestId: feature.id,
          featureTitle: feature.title,
          projectName: getProjectName(projectById, feature.projectId),
          clientName: client?.companyName ?? client?.name ?? null,
          stage: "High-risk tasks ready",
          nextAction: "Review build plan"
        };
      }

      if (!pullRequest) {
        return {
          featureRequestId: feature.id,
          featureTitle: feature.title,
          projectName: getProjectName(projectById, feature.projectId),
          clientName: client?.companyName ?? client?.name ?? null,
          stage: tasks.length > 0 ? "Tasks ready, no PR" : "Needs GitHub PR",
          nextAction: "Link GitHub PR"
        };
      }

      if (!qaReview) {
        return {
          featureRequestId: feature.id,
          featureTitle: feature.title,
          projectName: getProjectName(projectById, feature.projectId),
          clientName: client?.companyName ?? client?.name ?? null,
          stage: "Needs QA review",
          nextAction: "Run AI QA"
        };
      }

      if (openFindings > 0) {
        return {
          featureRequestId: feature.id,
          featureTitle: feature.title,
          projectName: getProjectName(projectById, feature.projectId),
          clientName: client?.companyName ?? client?.name ?? null,
          stage: "Unresolved findings",
          nextAction: "Review risks"
        };
      }

      if (!approval) {
        return {
          featureRequestId: feature.id,
          featureTitle: feature.title,
          projectName: getProjectName(projectById, feature.projectId),
          clientName: client?.companyName ?? client?.name ?? null,
          stage: "Needs approval",
          nextAction: "Submit decision"
        };
      }

      if (!report) {
        return {
          featureRequestId: feature.id,
          featureTitle: feature.title,
          projectName: getProjectName(projectById, feature.projectId),
          clientName: client?.companyName ?? client?.name ?? null,
          stage: "Report not generated",
          nextAction: "Generate report"
        };
      }

      return null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 8);

  const featuresByProjectId = new Map<string, FeatureRow[]>();
  for (const feature of featureRows) {
    const projectFeatures = featuresByProjectId.get(feature.projectId) ?? [];
    projectFeatures.push(feature);
    featuresByProjectId.set(feature.projectId, projectFeatures);
  }

  const recentClients = clientRows.slice(0, 5).map((client) => {
    const clientProjects = projectRows.filter(
      (project) => project.clientId === client.id
    );
    const clientFeatureIds = new Set(
      clientProjects.flatMap((project) =>
        (featuresByProjectId.get(project.id) ?? []).map((feature) => feature.id)
      )
    );
    const clientQaReviewIds = qaReviewRows
      .filter((review) => clientFeatureIds.has(review.featureRequestId))
      .map((review) => review.id);
    const openRisks = findingRows.filter(
      (finding) =>
        clientQaReviewIds.includes(finding.qaReviewId) && isOpenFinding(finding)
    ).length;
    const reportsCount = releaseReportRows.filter((report) =>
      clientFeatureIds.has(report.featureRequestId)
    ).length;

    return {
      clientId: client.id,
      name: client.companyName ?? client.name,
      projectCount: clientProjects.length,
      openRisks,
      reportsCount
    };
  });

  const recentProjects = projectRows
    .filter((project) => activeProjectIds.has(project.id))
    .slice(0, 5)
    .map((project) => {
    const projectFeatures = featuresByProjectId.get(project.id) ?? [];
    const client = project.clientId ? clientById.get(project.clientId) : null;

    return {
      projectId: project.id,
      name: project.name,
      clientName: client?.companyName ?? client?.name ?? project.clientName ?? null,
      featureCount: projectFeatures.length
    };
  });
  const boardFeatures = featureRows.filter((feature) =>
    activeProjectIds.has(feature.projectId)
  );
  const shippedThisMonth = boardFeatures.filter(
    (feature) =>
      feature.boardStage === "shipped" &&
      feature.shippedAt &&
      feature.shippedAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;

  return {
    workspace: {
      name: workspace.activeOrganization.name,
      useCase: workspace.activeOrganization.workspaceUseCase,
      role: workspace.membership.role,
      isOwner: workspace.membership.role === "owner"
    },
    stats: {
      clients: clientRows.length,
      projects: projectRows.filter((project) => activeProjectIds.has(project.id)).length,
      featureRequests: featureRows.length,
      linkedPullRequests: pullRequestRows.length,
      qaReviews: qaReviewRows.length,
      releaseReports: releaseReportRows.length,
      openFindings: findingRows.filter(isOpenFinding).length
    },
    boardSummary: {
      pending: boardFeatures.filter((feature) => feature.boardStage === "pending")
        .length,
      ongoing: boardFeatures.filter((feature) => feature.boardStage === "ongoing")
        .length,
      completing: boardFeatures.filter(
        (feature) => feature.boardStage === "completing"
      ).length,
      shippedThisMonth
    },
    isEmpty:
      clientRows.length === 0 && projectRows.length === 0 && featureRows.length === 0,
    needsAttention,
    recentClients,
    recentProjects
  };
}
