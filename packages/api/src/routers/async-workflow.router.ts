import { z } from "zod";
import {
  asyncWorkflowKindSchema,
  enqueueAsyncWorkflow,
  getAsyncWorkflowStatus,
  listFeatureAsyncWorkflows
} from "../services/async-workflow.service";
import { protectedProcedure, router } from "../trpc";

export const asyncWorkflowRouter = router({
  enqueue: protectedProcedure
    .input(
      z.object({
        kind: asyncWorkflowKindSchema,
        featureRequestId: z.string().uuid().optional(),
        prdId: z.string().uuid().optional()
      })
    )
    .mutation(({ ctx, input }) => enqueueAsyncWorkflow(ctx, input)),

  getStatus: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(({ input }) => getAsyncWorkflowStatus(input.jobId)),

  listForFeature: protectedProcedure
    .input(z.object({ featureRequestId: z.string().uuid() }))
    .query(({ input }) => listFeatureAsyncWorkflows(input.featureRequestId))
});
