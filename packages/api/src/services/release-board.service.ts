import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  approvals,
  clients,
  db,
  engineeringTasks,
  featureRequests,
  projectGithubRepositories,
  projects,
  prds,
  pullRequests,
  qaReviews,
  releaseReports,
  repositories
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

type BoardStage = "pending" | "ongoing" | "completing" | "shipped";

const stageRank: Record<BoardStage, number> = {
  pending: 0,
  ongoing: 1,
  completing: 2,
  shipped: 3
};

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
    const current = map.get(row.featureRequestId);
    if (!current || row.createdAt > current.createdAt) {
      map.set(row.featureRequestId, row);
    }
  }

  return map;
}

function maxStage(a: BoardStage, b: BoardStage): BoardStage {
  return stageRank[a] >= stageRank[b] ? a : b;
}

function deriveStage(input: {
  feature: typeof featureRequests.$inferSelect;
  prd?: typeof prds.$inferSelect;
  pullRequest?: typeof pullRequests.$inferSelect;
  qaReview?: typeof qaReviews.$inferSelect;
  approval?: typeof approvals.$inferSelect;
  report?: typeof releaseReports.$inferSelect;
}) {
  if (
    input.feature.status === "released" ||
    input.feature.shippedAt ||
    input.report
  ) {
    return "shipped" satisfies BoardStage;
  }

  if (
    input.qaReview ||
    input.approval ||
    input.feature.status === "qa_reviewed" ||
    input.feature.status === "changes_requested" ||
    input.feature.status === "approved"
  ) {
    return "completing" satisfies BoardStage;
  }

  if (
    input.pullRequest ||
    input.prd ||
    input.feature.status === "prd_ready" ||
    input.feature.status === "tasks_ready" ||
    input.feature.status === "pr_linked"
  ) {
    return "ongoing" satisfies BoardStage;
  }

  return "pending" satisfies BoardStage;
}

function getWorkflowState(input: {
  prd?: typeof prds.$inferSelect;
  pullRequest?: typeof pullRequests.$inferSelect;
  qaReview?: typeof qaReviews.$inferSelect;
  approval?: typeof approvals.$inferSelect;
  report?: typeof releaseReports.$inferSelect;
  blockedTasks: number;
}) {
  if (input.report) return "Report generated";
  if (input.approval) return `Approval: ${input.approval.decision}`;
  if (input.qaReview) return `QA: ${input.qaReview.overallStatus}`;
  if (input.pullRequest) return `PR #${input.pullRequest.githubPrNumber} linked`;
  if (input.blockedTasks > 0) return "Blocked engineering tasks";
  if (input.prd) return "PRD/tasks ready";
  return "Waiting for PRD";
}

function getNextAction(input: {
  prd?: typeof prds.$inferSelect;
  pullRequest?: typeof pullRequests.$inferSelect;
  qaReview?: typeof qaReviews.$inferSelect;
  approval?: typeof approvals.$inferSelect;
  report?: typeof releaseReports.$inferSelect;
}) {
  if (!input.prd) return "Generate PRD";
  if (!input.pullRequest) return "Select PR";
  if (!input.qaReview) return "Run QA review";
  if (!input.approval) return "Submit approval";
  if (!input.report) return "Generate report";
  return "Open report";
}

export async function getReleaseBoard(ctx: ProtectedContext, input: {
  projectId?: string;
  clientId?: string;
  stage?: BoardStage;
}) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");
  const organizationId = workspace.activeOrganization.id;

  const [featureRows, projectRows, clientRows, repoRows] = await Promise.all([
    db
      .select()
      .from(featureRequests)
      .where(eq(featureRequests.organizationId, organizationId))
      .orderBy(featureRequests.boardOrder, desc(featureRequests.updatedAt)),
    db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, organizationId)),
    db
      .select()
      .from(clients)
      .where(eq(clients.organizationId, organizationId)),
    db
      .select({
        projectRepository: projectGithubRepositories,
        repository: repositories
      })
      .from(projectGithubRepositories)
      .innerJoin(
        repositories,
        eq(projectGithubRepositories.repositoryId, repositories.id)
      )
      .where(
        and(
          eq(projectGithubRepositories.organizationId, organizationId),
          eq(repositories.organizationId, organizationId)
        )
      )
  ]);
  const projectById = new Map(projectRows.map((project) => [project.id, project]));
  const clientById = new Map(clientRows.map((client) => [client.id, client]));
  const repoByProjectId = new Map(
    repoRows.map((row) => [row.projectRepository.projectId, row.repository])
  );
  const scopedFeatures = featureRows.filter((feature) => {
    const project = projectById.get(feature.projectId);
    if (!project || project.status === "archived") return false;
    if (input.projectId && feature.projectId !== input.projectId) return false;
    if (input.clientId && project.clientId !== input.clientId) return false;
    return true;
  });
  const featureIds = scopedFeatures.map((feature) => feature.id);

  if (featureIds.length === 0) {
    return {
      columns: emptyColumns(),
      filters: buildFilters(projectRows, clientRows),
      summary: emptySummary()
    };
  }

  const [
    prdRows,
    pullRequestRows,
    qaReviewRows,
    approvalRows,
    reportRows,
    taskRows
  ] = await Promise.all([
    db.select().from(prds).where(inArray(prds.featureRequestId, featureIds)),
    db
      .select()
      .from(pullRequests)
      .where(
        and(
          eq(pullRequests.organizationId, organizationId),
          inArray(pullRequests.featureRequestId, featureIds)
        )
      ),
    db
      .select()
      .from(qaReviews)
      .where(
        and(
          eq(qaReviews.organizationId, organizationId),
          inArray(qaReviews.featureRequestId, featureIds)
        )
      ),
    db
      .select()
      .from(approvals)
      .where(
        and(
          eq(approvals.organizationId, organizationId),
          inArray(approvals.featureRequestId, featureIds)
        )
      ),
    db
      .select()
      .from(releaseReports)
      .where(
        and(
          eq(releaseReports.organizationId, organizationId),
          inArray(releaseReports.featureRequestId, featureIds)
        )
      ),
    db
      .select()
      .from(engineeringTasks)
      .where(
        and(
          eq(engineeringTasks.organizationId, organizationId),
          inArray(engineeringTasks.featureRequestId, featureIds)
        )
      )
  ]);
  const latestPrd = latestByFeature(prdRows);
  const latestPullRequest = latestByFeature(pullRequestRows);
  const latestQaReview = latestByFeature(qaReviewRows);
  const latestApproval = latestByFeature(approvalRows);
  const latestReport = latestByFeature(reportRows);
  const tasksByFeatureId = new Map<string, Array<typeof engineeringTasks.$inferSelect>>();

  for (const task of taskRows) {
    const items = tasksByFeatureId.get(task.featureRequestId) ?? [];
    items.push(task);
    tasksByFeatureId.set(task.featureRequestId, items);
  }

  const cards = scopedFeatures.map((feature) => {
    const project = projectById.get(feature.projectId);
    const client = project?.clientId ? clientById.get(project.clientId) : null;
    const repository = repoByProjectId.get(feature.projectId);
    const prd = latestPrd.get(feature.id);
    const pullRequest = latestPullRequest.get(feature.id);
    const qaReview = latestQaReview.get(feature.id);
    const approval = latestApproval.get(feature.id);
    const report = latestReport.get(feature.id);
    const tasks = tasksByFeatureId.get(feature.id) ?? [];
    const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
    const highRiskTasks = tasks.filter((task) => task.riskLevel === "high").length;
    const derivedStage = deriveStage({
      feature,
      prd,
      pullRequest,
      qaReview,
      approval,
      report
    });
    const boardStage = maxStage(feature.boardStage, derivedStage);

    return {
      id: feature.id,
      title: feature.title,
      projectId: feature.projectId,
      projectName: project?.name ?? "Project",
      clientName: client?.companyName ?? client?.name ?? project?.clientName ?? null,
      repositoryFullName: repository?.fullName ?? null,
      stage: boardStage,
      storedStage: feature.boardStage,
      workflowState: getWorkflowState({
        prd,
        pullRequest,
        qaReview,
        approval,
        report,
        blockedTasks
      }),
      nextAction: getNextAction({
        prd,
        pullRequest,
        qaReview,
        approval,
        report
      }),
      prState: pullRequest?.state ?? null,
      prNumber: pullRequest?.githubPrNumber ?? null,
      qaVerdict: qaReview?.overallStatus ?? null,
      qaConfidence: qaReview?.confidenceScore ?? null,
      approvalDecision: approval?.decision ?? null,
      reportState: report?.status ?? null,
      blockedTasks,
      highRiskTasks,
      updatedAt: feature.updatedAt,
      shippedAt: feature.shippedAt
    };
  });
  const filteredCards = input.stage
    ? cards.filter((card) => card.stage === input.stage)
    : cards;

  return {
    columns: {
      pending: filteredCards.filter((card) => card.stage === "pending"),
      ongoing: filteredCards.filter((card) => card.stage === "ongoing"),
      completing: filteredCards.filter((card) => card.stage === "completing"),
      shipped: filteredCards.filter((card) => card.stage === "shipped")
    },
    filters: buildFilters(projectRows, clientRows),
    summary: {
      pending: cards.filter((card) => card.stage === "pending").length,
      ongoing: cards.filter((card) => card.stage === "ongoing").length,
      completing: cards.filter((card) => card.stage === "completing").length,
      shipped: cards.filter((card) => card.stage === "shipped").length,
      needsAttention: cards.filter(
        (card) =>
          card.blockedTasks > 0 ||
          card.highRiskTasks > 0 ||
          card.qaVerdict === "needs_changes" ||
          card.qaVerdict === "failed" ||
          (!card.reportState && card.approvalDecision)
      ).length
    }
  };
}

export async function updateReleaseBoardStage(ctx: ProtectedContext, input: {
  featureRequestId: string;
  stage: BoardStage;
  overrideUnsafe?: boolean;
}) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "create_feature_request");
  const organizationId = workspace.activeOrganization.id;
  const [feature] = await db
    .select()
    .from(featureRequests)
    .where(
      and(
        eq(featureRequests.id, input.featureRequestId),
        eq(featureRequests.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!feature) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Feature request not found."
    });
  }

  if (input.stage === "shipped" && !input.overrideUnsafe) {
    const [approval] = await db
      .select()
      .from(approvals)
      .where(
        and(
          eq(approvals.organizationId, organizationId),
          eq(approvals.featureRequestId, feature.id)
        )
      )
      .orderBy(desc(approvals.createdAt))
      .limit(1);
    const [report] = await db
      .select()
      .from(releaseReports)
      .where(
        and(
          eq(releaseReports.organizationId, organizationId),
          eq(releaseReports.featureRequestId, feature.id)
        )
      )
      .orderBy(desc(releaseReports.createdAt))
      .limit(1);

    if (
      !report ||
      (approval?.decision !== "approved" &&
        approval?.decision !== "approved_with_risk")
    ) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "This feature does not have approval and a generated report yet. Mark shipped anyway?"
      });
    }
  }

  const [updated] = await db
    .update(featureRequests)
    .set({
      boardStage: input.stage,
      shippedAt: input.stage === "shipped" ? new Date() : feature.shippedAt,
      status: input.stage === "shipped" ? "released" : feature.status,
      updatedAt: new Date()
    })
    .where(eq(featureRequests.id, feature.id))
    .returning();

  return updated ?? feature;
}

function emptyColumns() {
  return {
    pending: [],
    ongoing: [],
    completing: [],
    shipped: []
  };
}

function emptySummary() {
  return {
    pending: 0,
    ongoing: 0,
    completing: 0,
    shipped: 0,
    needsAttention: 0
  };
}

function buildFilters(
  projectRows: Array<typeof projects.$inferSelect>,
  clientRows: Array<typeof clients.$inferSelect>
) {
  return {
    projects: projectRows
      .filter((project) => project.status !== "archived")
      .map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status
      })),
    clients: clientRows.map((client) => ({
      id: client.id,
      name: client.companyName ?? client.name
    }))
  };
}
