import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  approvals,
  auditLogs,
  clients,
  db,
  featureRequests,
  prds,
  projects,
  pullRequests,
  qaFindings,
  qaRequirementCoverage,
  qaReviews,
  releaseReports,
  type JsonObject
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

export type ClientStatus = "active" | "archived";

export type ClientNextAction =
  | "generate_prd"
  | "link_pr"
  | "run_qa_review"
  | "submit_approval"
  | "generate_report"
  | "open_report"
  | "review_risks";

type ClientRow = typeof clients.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;
type FeatureRow = typeof featureRequests.$inferSelect;
type PrdRow = typeof prds.$inferSelect;
type PullRequestRow = typeof pullRequests.$inferSelect;
type QaReviewRow = typeof qaReviews.$inferSelect;
type CoverageRow = typeof qaRequirementCoverage.$inferSelect;
type FindingRow = typeof qaFindings.$inferSelect;
type ApprovalRow = typeof approvals.$inferSelect;
type ReleaseReportRow = typeof releaseReports.$inferSelect;

function toBootstrapInput(ctx: ProtectedContext) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function isClientDeliveryReport(report: ReleaseReportRow) {
  const reportData = report.reportData as { reportType?: string };
  return !reportData.reportType || reportData.reportType === "client_delivery";
}

function isClientStatus(value: string): value is ClientStatus {
  return value === "active" || value === "archived";
}

function normalizeClient(client: ClientRow) {
  return {
    ...client,
    status: isClientStatus(client.status) ? client.status : "active"
  };
}

async function getWorkspace(ctx: ProtectedContext) {
  return ensureUserWorkspace(toBootstrapInput(ctx));
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

async function getScopedClientOrThrow(clientId: string, organizationId: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)))
    .limit(1);

  if (!client) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Client not found."
    });
  }

  return normalizeClient(client);
}

async function getScopedProjectOrThrow(
  projectId: string,
  organizationId: string
) {
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.organizationId, organizationId))
    )
    .limit(1);

  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found."
    });
  }

  return project;
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

function getMaxDate(dates: Array<Date | null | undefined>) {
  return dates.reduce<Date | null>((latest, date) => {
    if (!date) {
      return latest;
    }

    if (!latest || date > latest) {
      return date;
    }

    return latest;
  }, null);
}

function isOpenFinding(finding: FindingRow) {
  return finding.status === "open" || finding.status === "needs_human_review";
}

function isHighCritical(finding: FindingRow) {
  return finding.severity === "high" || finding.severity === "critical";
}

function summarizeCoverage(coverage: CoverageRow[]) {
  return {
    covered: coverage.filter((item) => item.status === "covered").length,
    partial: coverage.filter((item) => item.status === "partial").length,
    missing: coverage.filter((item) => item.status === "missing").length,
    risky: coverage.filter((item) => String(item.status) === "risky").length
  };
}

function summarizeFindings(findings: FindingRow[]) {
  const open = findings.filter(isOpenFinding);

  return {
    total: findings.length,
    open: open.length,
    highCritical: open.filter(isHighCritical).length
  };
}

function getNextAction(input: {
  prd?: PrdRow;
  pullRequest?: PullRequestRow;
  qaReview?: QaReviewRow;
  approval?: ApprovalRow;
  releaseReport?: ReleaseReportRow;
}): ClientNextAction {
  if (!input.prd) {
    return "generate_prd";
  }

  if (!input.pullRequest) {
    return "link_pr";
  }

  if (!input.qaReview) {
    return "run_qa_review";
  }

  if (!input.approval) {
    return "submit_approval";
  }

  if (
    input.approval.decision === "changes_requested" ||
    input.approval.decision === "rejected"
  ) {
    return "review_risks";
  }

  if (!input.releaseReport) {
    return "generate_report";
  }

  return "open_report";
}

async function getOrganizationLedgerRows(organizationId: string) {
  const [
    orgProjects,
    orgFeatureRequests,
    orgPullRequests,
    orgQaReviews,
    orgApprovals,
    orgReleaseReports
  ] = await Promise.all([
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
      .orderBy(desc(pullRequests.updatedAt)),
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
      .orderBy(desc(releaseReports.createdAt))
  ]);

  const featureIds = orgFeatureRequests.map((feature) => feature.id);
  const qaReviewIds = orgQaReviews.map((review) => review.id);

  const [orgPrds, orgCoverage, orgFindings] = await Promise.all([
    featureIds.length
      ? db
          .select()
          .from(prds)
          .where(inArray(prds.featureRequestId, featureIds))
          .orderBy(desc(prds.version), desc(prds.createdAt))
      : Promise.resolve([] as PrdRow[]),
    qaReviewIds.length
      ? db
          .select()
          .from(qaRequirementCoverage)
          .where(inArray(qaRequirementCoverage.qaReviewId, qaReviewIds))
      : Promise.resolve([] as CoverageRow[]),
    qaReviewIds.length
      ? db
          .select()
          .from(qaFindings)
          .where(inArray(qaFindings.qaReviewId, qaReviewIds))
          .orderBy(desc(qaFindings.createdAt))
      : Promise.resolve([] as FindingRow[])
  ]);

  return {
    projects: orgProjects,
    featureRequests: orgFeatureRequests,
    prds: orgPrds,
    pullRequests: orgPullRequests,
    qaReviews: orgQaReviews,
    coverage: orgCoverage,
    findings: orgFindings,
    approvals: orgApprovals,
    releaseReports: orgReleaseReports
  };
}

async function getClientLedgerRows(organizationId: string, clientId: string) {
  const clientProjects = await db
    .select()
    .from(projects)
    .where(and(eq(projects.organizationId, organizationId), eq(projects.clientId, clientId)))
    .orderBy(desc(projects.createdAt));

  const projectIds = clientProjects.map((project) => project.id);
  const clientFeatures = projectIds.length
    ? await db
        .select()
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.organizationId, organizationId),
            inArray(featureRequests.projectId, projectIds)
          )
        )
        .orderBy(desc(featureRequests.createdAt))
    : [];

  const featureIds = clientFeatures.map((feature) => feature.id);

  const [
    clientPrds,
    clientPullRequests,
    clientQaReviews,
    clientApprovals,
    clientReleaseReports
  ] = await Promise.all([
    featureIds.length
      ? db
          .select()
          .from(prds)
          .where(inArray(prds.featureRequestId, featureIds))
          .orderBy(desc(prds.version), desc(prds.createdAt))
      : Promise.resolve([] as PrdRow[]),
    featureIds.length
      ? db
          .select()
          .from(pullRequests)
          .where(
            and(
              eq(pullRequests.organizationId, organizationId),
              inArray(pullRequests.featureRequestId, featureIds)
            )
          )
          .orderBy(desc(pullRequests.updatedAt))
      : Promise.resolve([] as PullRequestRow[]),
    featureIds.length
      ? db
          .select()
          .from(qaReviews)
          .where(
            and(
              eq(qaReviews.organizationId, organizationId),
              inArray(qaReviews.featureRequestId, featureIds)
            )
          )
          .orderBy(desc(qaReviews.reviewVersion), desc(qaReviews.createdAt))
      : Promise.resolve([] as QaReviewRow[]),
    featureIds.length
      ? db
          .select()
          .from(approvals)
          .where(
            and(
              eq(approvals.organizationId, organizationId),
              inArray(approvals.featureRequestId, featureIds)
            )
          )
          .orderBy(desc(approvals.createdAt))
      : Promise.resolve([] as ApprovalRow[]),
    featureIds.length
      ? db
          .select()
          .from(releaseReports)
          .where(
            and(
              eq(releaseReports.organizationId, organizationId),
              inArray(releaseReports.featureRequestId, featureIds)
            )
          )
          .orderBy(desc(releaseReports.createdAt))
      : Promise.resolve([] as ReleaseReportRow[])
  ]);

  const qaReviewIds = clientQaReviews.map((review) => review.id);
  const [clientCoverage, clientFindings] = await Promise.all([
    qaReviewIds.length
      ? db
          .select()
          .from(qaRequirementCoverage)
          .where(inArray(qaRequirementCoverage.qaReviewId, qaReviewIds))
      : Promise.resolve([] as CoverageRow[]),
    qaReviewIds.length
      ? db
          .select()
          .from(qaFindings)
          .where(inArray(qaFindings.qaReviewId, qaReviewIds))
          .orderBy(desc(qaFindings.createdAt))
      : Promise.resolve([] as FindingRow[])
  ]);

  return {
    projects: clientProjects,
    featureRequests: clientFeatures,
    prds: clientPrds,
    pullRequests: clientPullRequests,
    qaReviews: clientQaReviews,
    coverage: clientCoverage,
    findings: clientFindings,
    approvals: clientApprovals,
    releaseReports: clientReleaseReports
  };
}

function buildClientStats(input: {
  clientId: string;
  rows: Awaited<ReturnType<typeof getOrganizationLedgerRows>>;
}) {
  const clientProjects = input.rows.projects.filter(
    (project) => project.clientId === input.clientId
  );
  const projectIds = new Set(clientProjects.map((project) => project.id));
  const clientFeatures = input.rows.featureRequests.filter((feature) =>
    projectIds.has(feature.projectId)
  );
  const featureIds = new Set(clientFeatures.map((feature) => feature.id));
  const latestQaReview = latestByFeature(
    input.rows.qaReviews.filter((review) => featureIds.has(review.featureRequestId))
  );
  const latestApproval = latestByFeature(
    input.rows.approvals.filter((approval) =>
      featureIds.has(approval.featureRequestId)
    )
  );
  const clientReports = input.rows.releaseReports.filter(
    (report) =>
      featureIds.has(report.featureRequestId) && isClientDeliveryReport(report)
  );

  let openFindingsCount = 0;
  let pendingApprovalsCount = 0;

  for (const feature of clientFeatures) {
    const review = latestQaReview.get(feature.id);
    if (!review) {
      continue;
    }

    if (!latestApproval.get(feature.id)) {
      pendingApprovalsCount += 1;
    }

    openFindingsCount += input.rows.findings.filter(
      (finding) => finding.qaReviewId === review.id && isOpenFinding(finding)
    ).length;
  }

  return {
    projectsCount: clientProjects.length,
    featureRequestsCount: clientFeatures.length,
    reportsCount: clientReports.length,
    openFindingsCount,
    pendingApprovalsCount
  };
}

export async function createClient(
  ctx: ProtectedContext,
  input: {
    name: string;
    companyName?: string;
    contactName?: string;
    contactEmail?: string;
    notes?: string;
  }
) {
  const workspace = await getWorkspace(ctx);
  assertRoleCan(workspace.membership.role, "project:write");

  return db.transaction(async (tx) => {
    const [client] = await tx
      .insert(clients)
      .values({
        organizationId: workspace.activeOrganization.id,
        name: input.name,
        companyName: input.companyName,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        notes: input.notes,
        status: "active",
        createdBy: workspace.appUser.id
      })
      .returning();

    if (!client) {
      throw new Error("Unable to create client.");
    }

    await tx.insert(auditLogs).values({
      organizationId: workspace.activeOrganization.id,
      actorId: workspace.appUser.id,
      action: "client_created",
      entityType: "client",
      entityId: client.id,
      metadata: toJsonObject({ name: client.name })
    });

    return normalizeClient(client);
  });
}

export async function listClients(ctx: ProtectedContext) {
  const workspace = await getWorkspace(ctx);
  assertRoleCan(workspace.membership.role, "project:read");

  const [clientRows, ledgerRows] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(eq(clients.organizationId, workspace.activeOrganization.id))
      .orderBy(desc(clients.createdAt))
      .limit(100),
    getOrganizationLedgerRows(workspace.activeOrganization.id)
  ]);

  return clientRows.map((client) => ({
    ...normalizeClient(client),
    ...buildClientStats({
      clientId: client.id,
      rows: ledgerRows
    })
  }));
}

export async function listBasicClients(ctx: ProtectedContext) {
  const workspace = await getWorkspace(ctx);
  assertRoleCan(workspace.membership.role, "project:read");

  const clientRows = await db
    .select({
      id: clients.id,
      name: clients.name,
      companyName: clients.companyName,
      status: clients.status,
      createdAt: clients.createdAt
    })
    .from(clients)
    .where(eq(clients.organizationId, workspace.activeOrganization.id))
    .orderBy(desc(clients.createdAt))
    .limit(100);

  return clientRows.map((client) => ({
    ...client,
    status: isClientStatus(client.status) ? client.status : "active"
  }));
}

export async function getClientById(ctx: ProtectedContext, clientId: string) {
  const workspace = await getWorkspace(ctx);
  assertRoleCan(workspace.membership.role, "project:read");

  return getScopedClientOrThrow(clientId, workspace.activeOrganization.id);
}

export async function updateClient(
  ctx: ProtectedContext,
  input: {
    clientId: string;
    name?: string;
    companyName?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    notes?: string | null;
    status?: ClientStatus;
  }
) {
  const workspace = await getWorkspace(ctx);
  assertRoleCan(workspace.membership.role, "project:write");

  await getScopedClientOrThrow(input.clientId, workspace.activeOrganization.id);

  const updates: Partial<typeof clients.$inferInsert> = {
    updatedAt: new Date()
  };

  if (input.name !== undefined) updates.name = input.name;
  if (input.companyName !== undefined) updates.companyName = input.companyName;
  if (input.contactName !== undefined) updates.contactName = input.contactName;
  if (input.contactEmail !== undefined) updates.contactEmail = input.contactEmail;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.status !== undefined) updates.status = input.status;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(clients)
      .set(updates)
      .where(
        and(
          eq(clients.id, input.clientId),
          eq(clients.organizationId, workspace.activeOrganization.id)
        )
      )
      .returning();

    if (!updated) {
      throw new Error("Unable to update client.");
    }

    await tx.insert(auditLogs).values({
      organizationId: workspace.activeOrganization.id,
      actorId: workspace.appUser.id,
      action: "client_updated",
      entityType: "client",
      entityId: updated.id,
      metadata: toJsonObject({ fields: Object.keys(updates) })
    });

    return normalizeClient(updated);
  });
}

export async function archiveClient(ctx: ProtectedContext, clientId: string) {
  const workspace = await getWorkspace(ctx);
  assertRoleCan(workspace.membership.role, "project:write");

  await getScopedClientOrThrow(clientId, workspace.activeOrganization.id);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(clients)
      .set({
        status: "archived",
        updatedAt: new Date()
      })
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.organizationId, workspace.activeOrganization.id)
        )
      )
      .returning();

    if (!updated) {
      throw new Error("Unable to archive client.");
    }

    await tx.insert(auditLogs).values({
      organizationId: workspace.activeOrganization.id,
      actorId: workspace.appUser.id,
      action: "client_archived",
      entityType: "client",
      entityId: updated.id,
      metadata: {}
    });

    return normalizeClient(updated);
  });
}

export async function attachProjectToClient(
  ctx: ProtectedContext,
  input: {
    clientId: string;
    projectId: string;
  }
) {
  const workspace = await getWorkspace(ctx);
  assertRoleCan(workspace.membership.role, "project:write");

  const [client, project] = await Promise.all([
    getScopedClientOrThrow(input.clientId, workspace.activeOrganization.id),
    getScopedProjectOrThrow(input.projectId, workspace.activeOrganization.id)
  ]);

  return db.transaction(async (tx) => {
    const [updatedProject] = await tx
      .update(projects)
      .set({
        clientId: client.id,
        clientName: project.clientName ?? client.companyName ?? client.name,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(projects.id, project.id),
          eq(projects.organizationId, workspace.activeOrganization.id)
        )
      )
      .returning();

    if (!updatedProject) {
      throw new Error("Unable to attach project to client.");
    }

    await tx.insert(auditLogs).values({
      organizationId: workspace.activeOrganization.id,
      actorId: workspace.appUser.id,
      action: "project_attached_to_client",
      entityType: "project",
      entityId: project.id,
      metadata: toJsonObject({ clientId: client.id })
    });

    return updatedProject;
  });
}

export async function detachProjectFromClient(
  ctx: ProtectedContext,
  input: {
    projectId: string;
  }
) {
  const workspace = await getWorkspace(ctx);
  assertRoleCan(workspace.membership.role, "project:write");

  const project = await getScopedProjectOrThrow(
    input.projectId,
    workspace.activeOrganization.id
  );

  return db.transaction(async (tx) => {
    const [updatedProject] = await tx
      .update(projects)
      .set({
        clientId: null,
        clientName: null,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(projects.id, project.id),
          eq(projects.organizationId, workspace.activeOrganization.id)
        )
      )
      .returning();

    if (!updatedProject) {
      throw new Error("Unable to detach project from client.");
    }

    await tx.insert(auditLogs).values({
      organizationId: workspace.activeOrganization.id,
      actorId: workspace.appUser.id,
      action: "project_detached_from_client",
      entityType: "project",
      entityId: project.id,
      metadata: toJsonObject({ previousClientId: project.clientId })
    });

    return updatedProject;
  });
}

export async function getClientDeliveryLedger(
  ctx: ProtectedContext,
  clientId: string
) {
  const workspace = await getWorkspace(ctx);
  assertRoleCan(workspace.membership.role, "project:read");

  const organizationId = workspace.activeOrganization.id;
  const client = await getScopedClientOrThrow(clientId, organizationId);
  const rows = await getClientLedgerRows(organizationId, client.id);

  const clientProjects = rows.projects;
  const projectById = new Map(clientProjects.map((project) => [project.id, project]));
  const clientFeatures = rows.featureRequests;
  const featureIds = new Set(clientFeatures.map((feature) => feature.id));
  const featureById = new Map(clientFeatures.map((feature) => [feature.id, feature]));

  const latestPrd = latestByFeature(
    rows.prds.filter((prd) => featureIds.has(prd.featureRequestId))
  );
  const latestPullRequest = latestByFeature(
    rows.pullRequests.filter((pr) => featureIds.has(pr.featureRequestId))
  );
  const latestQaReview = latestByFeature(
    rows.qaReviews.filter((review) => featureIds.has(review.featureRequestId))
  );
  const latestApproval = latestByFeature(
    rows.approvals.filter((approval) => featureIds.has(approval.featureRequestId))
  );
  const latestReleaseReport = latestByFeature(
    rows.releaseReports.filter(
      (report) =>
        featureIds.has(report.featureRequestId) && isClientDeliveryReport(report)
    )
  );

  const coverageByReviewId = new Map<string, CoverageRow[]>();
  for (const coverage of rows.coverage) {
    const existing = coverageByReviewId.get(coverage.qaReviewId) ?? [];
    existing.push(coverage);
    coverageByReviewId.set(coverage.qaReviewId, existing);
  }

  const findingsByReviewId = new Map<string, FindingRow[]>();
  for (const finding of rows.findings) {
    const existing = findingsByReviewId.get(finding.qaReviewId) ?? [];
    existing.push(finding);
    findingsByReviewId.set(finding.qaReviewId, existing);
  }

  const clientReports = rows.releaseReports.filter(
    (report) =>
      featureIds.has(report.featureRequestId) && isClientDeliveryReport(report)
  );

  const deliveryItems = clientFeatures.map((feature) => {
    const project = projectById.get(feature.projectId);
    const review = latestQaReview.get(feature.id);
    const coverage = review ? coverageByReviewId.get(review.id) ?? [] : [];
    const findings = review ? findingsByReviewId.get(review.id) ?? [] : [];
    const approval = latestApproval.get(feature.id);
    const report = latestReleaseReport.get(feature.id);

    return {
      featureRequestId: feature.id,
      featureTitle: feature.title,
      featureStatus: feature.status,
      projectId: feature.projectId,
      projectName: project?.name ?? "Project",
      createdAt: feature.createdAt,
      latestQaReview: review
        ? {
            id: review.id,
            overallStatus: review.overallStatus,
            readinessScore: review.readinessScore,
            confidenceScore: review.confidenceScore,
            reviewVersion: review.reviewVersion,
            createdAt: review.createdAt
          }
        : undefined,
      coverageSummary: review ? summarizeCoverage(coverage) : undefined,
      findingsSummary: review ? summarizeFindings(findings) : undefined,
      latestApproval: approval
        ? {
            id: approval.id,
            decision: approval.decision,
            note: approval.note,
            createdAt: approval.createdAt
          }
        : undefined,
      latestReleaseReport: report
        ? {
            id: report.id,
            title: report.title,
            status: report.status,
            shareToken: report.shareToken,
            createdAt: report.createdAt,
            generatedAt: report.generatedAt
          }
        : undefined,
      nextAction: getNextAction({
        prd: latestPrd.get(feature.id),
        pullRequest: latestPullRequest.get(feature.id),
        qaReview: review,
        approval,
        releaseReport: report
      })
    };
  });

  const reportArchive = clientReports.map((report) => {
    const feature = featureById.get(report.featureRequestId);
    const project = feature ? projectById.get(feature.projectId) : undefined;
    const approval = report.approvalId
      ? rows.approvals.find((item) => item.id === report.approvalId)
      : latestApproval.get(report.featureRequestId);

    return {
      reportId: report.id,
      title: report.title,
      featureRequestId: report.featureRequestId,
      featureTitle: feature?.title ?? "Feature request",
      projectName: project?.name ?? "Project",
      status: report.status,
      finalDecision: approval?.decision ?? null,
      readinessScore: report.readinessScore,
      shareToken: report.shareToken,
      generatedAt: report.generatedAt,
      createdAt: report.createdAt
    };
  });

  const risks: Array<{
    featureRequestId: string;
    featureTitle: string;
    projectName: string;
    type:
      | "open_finding"
      | "partial_requirement"
      | "missing_requirement"
      | "high_critical_finding"
      | "pending_approval";
    severity?: string;
    title: string;
    description: string;
    reportShareToken?: string;
  }> = [];

  let partialRequirementsCount = 0;
  let missingRequirementsCount = 0;
  let openFindingsCount = 0;
  let pendingApprovalsCount = 0;
  let approvedReleasesCount = 0;
  let changesRequestedCount = 0;

  for (const feature of clientFeatures) {
    const project = projectById.get(feature.projectId);
    const projectName = project?.name ?? "Project";
    const review = latestQaReview.get(feature.id);
    const approval = latestApproval.get(feature.id);
    const report = latestReleaseReport.get(feature.id);

    if (
      approval?.decision === "approved" ||
      approval?.decision === "approved_with_risk"
    ) {
      approvedReleasesCount += 1;
    }

    if (
      approval?.decision === "changes_requested" ||
      feature.status === "changes_requested"
    ) {
      changesRequestedCount += 1;
    }

    if (review && !approval) {
      pendingApprovalsCount += 1;
      risks.push({
        featureRequestId: feature.id,
        featureTitle: feature.title,
        projectName,
        type: "pending_approval",
        title: "Approval decision pending",
        description: "A QA review exists, but no human approval decision has been recorded.",
        reportShareToken: report?.shareToken
      });
    }

    if (!review) {
      continue;
    }

    for (const coverage of coverageByReviewId.get(review.id) ?? []) {
      if (coverage.status === "partial") {
        partialRequirementsCount += 1;
        risks.push({
          featureRequestId: feature.id,
          featureTitle: feature.title,
          projectName,
          type: "partial_requirement",
          title: `${coverage.requirementKey} partially covered`,
          description:
            coverage.concern ??
            "The latest QA review found this requirement only partially covered.",
          reportShareToken: report?.shareToken
        });
      }

      if (coverage.status === "missing") {
        missingRequirementsCount += 1;
        risks.push({
          featureRequestId: feature.id,
          featureTitle: feature.title,
          projectName,
          type: "missing_requirement",
          title: `${coverage.requirementKey} missing`,
          description:
            coverage.concern ??
            "The latest QA review found this requirement missing.",
          reportShareToken: report?.shareToken
        });
      }
    }

    for (const finding of findingsByReviewId.get(review.id) ?? []) {
      if (!isOpenFinding(finding)) {
        continue;
      }

      openFindingsCount += 1;
      risks.push({
        featureRequestId: feature.id,
        featureTitle: feature.title,
        projectName,
        type: isHighCritical(finding)
          ? "high_critical_finding"
          : "open_finding",
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        reportShareToken: report?.shareToken
      });
    }
  }

  const projectsForLedger = clientProjects.map((project) => {
    const projectFeatures = clientFeatures.filter(
      (feature) => feature.projectId === project.id
    );
    const projectFeatureIds = new Set(projectFeatures.map((feature) => feature.id));
    const latestActivityAt = getMaxDate([
      project.updatedAt,
      ...projectFeatures.map((feature) => feature.updatedAt),
      ...rows.qaReviews
        .filter((review) => projectFeatureIds.has(review.featureRequestId))
        .map((review) => review.createdAt),
      ...rows.approvals
        .filter((approval) => projectFeatureIds.has(approval.featureRequestId))
        .map((approval) => approval.createdAt),
      ...rows.releaseReports
        .filter((report) => projectFeatureIds.has(report.featureRequestId))
        .map((report) => report.createdAt)
    ]);

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      createdAt: project.createdAt,
      featureRequestsCount: projectFeatures.length,
      latestActivityAt
    };
  });

  return {
    client,
    summary: {
      projectsCount: clientProjects.length,
      featureRequestsCount: clientFeatures.length,
      reportsGeneratedCount: clientReports.length,
      pendingApprovalsCount,
      openFindingsCount,
      partialRequirementsCount,
      missingRequirementsCount,
      approvedReleasesCount,
      changesRequestedCount
    },
    projects: projectsForLedger,
    deliveryItems,
    reportArchive,
    risks
  };
}
