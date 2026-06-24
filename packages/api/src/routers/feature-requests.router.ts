import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, featureRequests, projects } from "@veriflow/db";
import { assertRoleCan } from "../authz";
import { getReleaseControlRoom } from "../services/release-control-room.service";
import { ensureUserWorkspace } from "../services/workspace-bootstrap.service";
import { protectedProcedure, router } from "../trpc";

const featurePrioritySchema = z
  .enum(["low", "medium", "high", "urgent"])
  .default("medium");

const createFeatureRequestInput = z.object({
  projectId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  title: z.string().min(2).max(160),
  description: z.string().min(1).max(5_000),
  businessGoal: z.string().max(2_000).optional(),
  expectedBehavior: z.string().max(2_000).optional(),
  acceptanceCriteria: z.array(z.string().min(1).max(500)).max(50).optional(),
  priority: featurePrioritySchema.optional()
});

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

export const featureRequestsRouter = router({
  create: protectedProcedure
    .input(createFeatureRequestInput)
    .mutation(async ({ ctx, input }) => {
      const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

      assertRoleCan(workspace.membership.role, "create_feature_request");

      const project = await getScopedProjectOrThrow(
        input.projectId,
        workspace.activeOrganization.id
      );

      if (input.clientId && project.clientId !== input.clientId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Project is not linked to this client."
        });
      }

      const [featureRequest] = await db
        .insert(featureRequests)
        .values({
          organizationId: workspace.activeOrganization.id,
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          businessGoal: input.businessGoal,
          expectedBehavior: input.expectedBehavior,
          acceptanceCriteria: input.acceptanceCriteria ?? [],
          priority: input.priority ?? "medium",
          status: "draft",
          createdBy: workspace.appUser.id
        })
        .returning();

      if (!featureRequest) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to create feature request."
        });
      }

      return featureRequest;
    }),

  listByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid()
      })
    )
    .query(async ({ ctx, input }) => {
      const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

      assertRoleCan(workspace.membership.role, "project:read");

      await getScopedProjectOrThrow(
        input.projectId,
        workspace.activeOrganization.id
      );

      return db
        .select()
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.projectId, input.projectId),
            eq(featureRequests.organizationId, workspace.activeOrganization.id)
          )
        )
        .orderBy(desc(featureRequests.createdAt));
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

    assertRoleCan(workspace.membership.role, "project:read");

    return db
      .select()
      .from(featureRequests)
      .where(eq(featureRequests.organizationId, workspace.activeOrganization.id))
      .orderBy(desc(featureRequests.createdAt));
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

      const [featureRequest] = await db
        .select()
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.id, input.id),
            eq(featureRequests.organizationId, workspace.activeOrganization.id)
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
    }),

  getReleaseControlRoom: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) =>
      getReleaseControlRoom(ctx, input.featureRequestId)
    ),

  updateDraft: protectedProcedure
    .input(
      createFeatureRequestInput
        .partial()
        .extend({
          id: z.string().uuid(),
          projectId: z.string().uuid().optional()
        })
        .refine(
          (input) =>
            Boolean(
              input.title ||
                input.description ||
                input.businessGoal ||
                input.expectedBehavior ||
                input.acceptanceCriteria ||
                input.priority ||
                input.projectId
            ),
          "At least one draft field must be provided."
        )
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

      assertRoleCan(workspace.membership.role, "create_feature_request");

      const [existing] = await db
        .select()
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.id, input.id),
            eq(featureRequests.organizationId, workspace.activeOrganization.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feature request not found."
        });
      }

      if (existing.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft feature requests can be edited."
        });
      }

      if (input.projectId) {
        await getScopedProjectOrThrow(
          input.projectId,
          workspace.activeOrganization.id
        );
      }

      const [updated] = await db
        .update(featureRequests)
        .set({
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          businessGoal: input.businessGoal,
          expectedBehavior: input.expectedBehavior,
          acceptanceCriteria: input.acceptanceCriteria,
          priority: input.priority,
          updatedAt: new Date()
        })
        .where(eq(featureRequests.id, existing.id))
        .returning();

      return updated ?? existing;
    })
});
