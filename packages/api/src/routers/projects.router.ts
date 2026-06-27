import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  approvals,
  clients,
  db,
  featureRequests,
  projectGithubRepositories,
  projects,
  pullRequests,
  qaReviews,
  releaseReports,
  repositories,
  repositoryAnalyses
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import { ensureUserWorkspace } from "../services/workspace-bootstrap.service";
import { protectedProcedure, router } from "../trpc";

function toBootstrapInput(ctx: {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
  session: {
    id: string;
  };
}) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

export const projectsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        description: z.string().max(2_000).optional(),
        clientName: z.string().max(120).optional(),
        clientId: z.string().uuid().optional(),
        repositoryId: z.string().uuid().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

      assertRoleCan(workspace.membership.role, "create_project");

      const [client] = input.clientId
        ? await db
            .select()
            .from(clients)
            .where(
              and(
                eq(clients.id, input.clientId),
                eq(clients.organizationId, workspace.activeOrganization.id)
              )
            )
            .limit(1)
        : [];

      if (input.clientId && !client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found."
        });
      }

      const [repository] = input.repositoryId
        ? await db
            .select()
            .from(repositories)
            .where(
              and(
                eq(repositories.id, input.repositoryId),
                eq(repositories.organizationId, workspace.activeOrganization.id),
                eq(repositories.githubAppSelected, true)
              )
            )
            .limit(1)
        : [];

      if (input.repositoryId && !repository?.githubAppInstallationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose a repository from a synced GitHub App installation."
        });
      }

      const [project] = await db
        .insert(projects)
        .values({
          organizationId: workspace.activeOrganization.id,
          name: input.name,
          description: input.description,
          clientName:
            input.clientName ?? client?.companyName ?? client?.name ?? undefined,
          clientId: client?.id
        })
        .returning();

      if (!project) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to create project."
        });
      }

      if (repository) {
        await db.insert(projectGithubRepositories).values({
          organizationId: workspace.activeOrganization.id,
          projectId: project.id,
          repositoryId: repository.id,
          updatedAt: new Date()
        });
      }

      return project;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

    assertRoleCan(workspace.membership.role, "project:read");
    const organizationId = workspace.activeOrganization.id;

    const projectRows = await db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, organizationId))
      .orderBy(desc(projects.createdAt))
      .limit(100);
    const projectIds = projectRows.map((project) => project.id);

    if (projectIds.length === 0) {
      return [];
    }

    const [
      featureRows,
      projectRepositoryRows,
      analysisRows
    ] = await Promise.all([
      db
        .select()
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.organizationId, organizationId),
            inArray(featureRequests.projectId, projectIds)
          )
        ),
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
            eq(repositories.organizationId, organizationId),
            inArray(projectGithubRepositories.projectId, projectIds)
          )
        ),
      db
        .select()
        .from(repositoryAnalyses)
        .where(
          and(
            eq(repositoryAnalyses.organizationId, organizationId),
            inArray(repositoryAnalyses.projectId, projectIds)
          )
        )
    ]);
    const featureIds = featureRows.map((feature) => feature.id);
    const [pullRequestRows, qaReviewRows, approvalRows, reportRows] =
      featureIds.length > 0
        ? await Promise.all([
            db
              .select()
              .from(pullRequests)
              .where(
                and(
                  eq(pullRequests.organizationId, organizationId),
                  inArray(pullRequests.projectId, projectIds)
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
                  inArray(releaseReports.projectId, projectIds)
                )
              )
          ])
        : [
            [] as Array<typeof pullRequests.$inferSelect>,
            [] as Array<typeof qaReviews.$inferSelect>,
            [] as Array<typeof approvals.$inferSelect>,
            [] as Array<typeof releaseReports.$inferSelect>
          ];

    return projectRows.map((project) => {
      const projectFeatures = featureRows.filter(
        (feature) => feature.projectId === project.id
      );
      const projectFeatureIds = new Set(projectFeatures.map((feature) => feature.id));
      const connected = projectRepositoryRows.find(
        (row) => row.projectRepository.projectId === project.id
      );
      const hasAnalysis = analysisRows.some(
        (analysis) =>
          analysis.projectId === project.id && analysis.status === "completed"
      );
      const featureIdsWithPr = new Set(
        pullRequestRows
          .filter((pullRequest) => pullRequest.projectId === project.id)
          .map((pullRequest) => pullRequest.featureRequestId)
      );
      const featureIdsWithQa = new Set(
        qaReviewRows
          .filter((review) => projectFeatureIds.has(review.featureRequestId))
          .map((review) => review.featureRequestId)
      );
      const featureIdsWithApproval = new Set(
        approvalRows
          .filter((approval) => projectFeatureIds.has(approval.featureRequestId))
          .map((approval) => approval.featureRequestId)
      );
      const featureIdsWithReport = new Set(
        reportRows
          .filter((report) => report.projectId === project.id)
          .map((report) => report.featureRequestId)
      );
      const featuresNeedingAction = projectFeatures.filter((feature) => {
        if (!projectFeatureIds.has(feature.id)) return false;
        return (
          !featureIdsWithPr.has(feature.id) ||
          !featureIdsWithQa.has(feature.id) ||
          !featureIdsWithApproval.has(feature.id) ||
          !featureIdsWithReport.has(feature.id)
        );
      }).length;
      const latestFeature = projectFeatures.reduce<
        (typeof projectFeatures)[number] | null
      >((latest, feature) => {
        if (!latest) return feature;
        return feature.createdAt > latest.createdAt ? feature : latest;
      }, null);

      return {
        ...project,
        connectedRepository: connected?.repository ?? null,
        repositoryAnalyzed: hasAnalysis,
        activeFeatureCount: projectFeatures.filter(
          (feature) => feature.status !== "archived"
        ).length,
        featuresNeedingAction,
        latestReleaseState:
          latestFeature?.status ?? (connected ? "repo_connected" : "setup")
      };
    });
  }),

  getById: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid()
      })
    )
    .query(async ({ ctx, input }) => {
      const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

      assertRoleCan(workspace.membership.role, "project:read");

      const [project] = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.id),
            eq(projects.organizationId, workspace.activeOrganization.id)
          )
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found."
        });
      }

      return project;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: z.enum(["active", "on_hold", "completed", "archived"]),
        overrideUnresolved: z.boolean().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

      assertRoleCan(workspace.membership.role, "project:write");
      const organizationId = workspace.activeOrganization.id;
      const [project] = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found."
        });
      }

      if (input.status === "completed" && !input.overrideUnresolved) {
        const unresolved = await getProjectUnresolvedReleaseCount({
          organizationId,
          projectId: input.projectId
        });

        if (unresolved > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "This project still has unresolved release items. Mark complete anyway?",
            cause: { unresolved }
          });
        }
      }

      const [updated] = await db
        .update(projects)
        .set({
          status: input.status,
          completedAt: input.status === "completed" ? new Date() : null,
          updatedAt: new Date()
        })
        .where(eq(projects.id, project.id))
        .returning();

      return updated ?? project;
    })
});

async function getProjectUnresolvedReleaseCount(input: {
  organizationId: string;
  projectId: string;
}) {
  const projectFeatures = await db
    .select()
    .from(featureRequests)
    .where(
      and(
        eq(featureRequests.organizationId, input.organizationId),
        eq(featureRequests.projectId, input.projectId)
      )
    );
  const featureIds = projectFeatures.map((feature) => feature.id);

  if (featureIds.length === 0) {
    return 0;
  }

  const [approvalRows, reportRows] = await Promise.all([
    db
      .select()
      .from(approvals)
      .where(
        and(
          eq(approvals.organizationId, input.organizationId),
          inArray(approvals.featureRequestId, featureIds)
        )
      ),
    db
      .select()
      .from(releaseReports)
      .where(
        and(
          eq(releaseReports.organizationId, input.organizationId),
          inArray(releaseReports.featureRequestId, featureIds)
        )
      )
  ]);
  const approvedFeatureIds = new Set(
    approvalRows
      .filter(
        (approval) =>
          approval.decision === "approved" ||
          approval.decision === "approved_with_risk"
      )
      .map((approval) => approval.featureRequestId)
  );
  const reportedFeatureIds = new Set(
    reportRows.map((report) => report.featureRequestId)
  );

  return projectFeatures.filter(
    (feature) =>
      feature.status !== "released" &&
      feature.boardStage !== "shipped" &&
      (!approvedFeatureIds.has(feature.id) || !reportedFeatureIds.has(feature.id))
  ).length;
}
