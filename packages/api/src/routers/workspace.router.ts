import { protectedProcedure, router } from "../trpc";
import { getPlanEntitlements } from "../services/plan-entitlements.service";
import { ensureUserWorkspace } from "../services/workspace-bootstrap.service";
import { assertRoleCan } from "../authz";
import { db, organizations } from "@veriflow/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const workspaceUseCaseSchema = z.enum([
  "agency",
  "product_team",
  "solo_builder"
]);

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

export const workspaceRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

    return {
      appUser: workspace.appUser,
      organizations: workspace.organizations,
      activeOrganization: workspace.activeOrganization,
      role: workspace.membership.role,
      plan: workspace.subscription.plan,
      entitlements: getPlanEntitlements(workspace.subscription.plan)
    };
  }),

  bootstrap: protectedProcedure.mutation(async ({ ctx }) => {
    const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

    return {
      ...workspace,
      entitlements: getPlanEntitlements(workspace.subscription.plan)
    };
  }),

  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

    return {
      activeOrganization: workspace.activeOrganization,
      role: workspace.membership.role,
      plan: workspace.subscription.plan
    };
  }),

  setUseCase: protectedProcedure
    .input(
      z.object({
        useCase: workspaceUseCaseSchema
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

      assertRoleCan(workspace.membership.role, "organization:manage");

      const [organization] = await db
        .update(organizations)
        .set({
          workspaceUseCase: input.useCase,
          updatedAt: new Date()
        })
        .where(eq(organizations.id, workspace.activeOrganization.id))
        .returning();

      if (!organization) {
        throw new Error("Unable to update workspace use case.");
      }

      return {
        activeOrganization: organization,
        role: workspace.membership.role,
        useCase: organization.workspaceUseCase
      };
    }),

  clearUseCase: protectedProcedure.mutation(async ({ ctx }) => {
    const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));

    assertRoleCan(workspace.membership.role, "organization:manage");

    const [organization] = await db
      .update(organizations)
      .set({
        workspaceUseCase: null,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, workspace.activeOrganization.id))
      .returning();

    if (!organization) {
      throw new Error("Unable to clear workspace use case.");
    }

    return {
      activeOrganization: organization,
      role: workspace.membership.role,
      useCase: organization.workspaceUseCase
    };
  })
});
