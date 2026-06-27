import { z } from "zod";
import {
  getFeatureWorkflow,
  getProjectSetup,
  getWorkspaceSetup
} from "../services/guided-workflow.service";
import { protectedProcedure, router } from "../trpc";

export const guidedWorkflowRouter = router({
  getWorkspaceSetup: protectedProcedure.query(({ ctx }) =>
    getWorkspaceSetup(ctx)
  ),

  getProjectSetup: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid().optional()
      })
    )
    .query(({ ctx, input }) => getProjectSetup(ctx, input)),

  getFeatureWorkflow: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) => getFeatureWorkflow(ctx, input))
});
