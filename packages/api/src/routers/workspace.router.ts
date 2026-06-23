import { protectedProcedure, router } from "../trpc";
import { getPlanEntitlements } from "../services/plan-entitlements.service";
import { ensureUserWorkspace } from "../services/workspace-bootstrap.service";

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
  })
});
