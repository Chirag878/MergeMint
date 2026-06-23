import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, projects } from "@veriflow/db";
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
        clientName: z.string().max(120).optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

      assertRoleCan(workspace.membership.role, "create_project");

      const [project] = await db
        .insert(projects)
        .values({
          organizationId: workspace.activeOrganization.id,
          name: input.name,
          description: input.description,
          clientName: input.clientName
        })
        .returning();

      if (!project) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to create project."
        });
      }

      return project;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

    assertRoleCan(workspace.membership.role, "project:read");

    return db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, workspace.activeOrganization.id))
      .orderBy(desc(projects.createdAt));
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
    })
});
