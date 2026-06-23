import { z } from "zod";
import {
  answerClarificationQuestion,
  generateClarificationsForFeatureRequest,
  generateEngineeringTasksForPrd,
  generatePrdForFeatureRequest,
  getFeatureWorkflow
} from "../services/requirement-engine.service";
import { protectedProcedure, router } from "../trpc";

export const requirementEngineRouter = router({
  getWorkflow: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) =>
      getFeatureWorkflow(ctx, input.featureRequestId)
    ),

  generateClarifications: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) =>
      generateClarificationsForFeatureRequest(ctx, input.featureRequestId)
    ),

  answerClarification: protectedProcedure
    .input(
      z.object({
        questionId: z.string().uuid(),
        answer: z.string().min(1).max(4_000)
      })
    )
    .mutation(({ ctx, input }) => answerClarificationQuestion(ctx, input)),

  generatePrd: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) =>
      generatePrdForFeatureRequest(ctx, input.featureRequestId)
    ),

  generateEngineeringTasks: protectedProcedure
    .input(
      z.object({
        prdId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) =>
      generateEngineeringTasksForPrd(ctx, input.prdId)
    )
});
