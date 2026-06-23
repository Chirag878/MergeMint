import { z } from "zod";
import {
  getLatestQaReviewForFeatureRequest,
  getQaReviewById,
  runQaReviewForFeatureRequest
} from "../services/qa-review.service";
import { protectedProcedure, router } from "../trpc";

export const qaReviewRouter = router({
  run: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) => runQaReviewForFeatureRequest(ctx, input)),

  getLatest: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) =>
      getLatestQaReviewForFeatureRequest(ctx, input.featureRequestId)
    ),

  getById: protectedProcedure
    .input(
      z.object({
        qaReviewId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) => getQaReviewById(ctx, input.qaReviewId))
});
