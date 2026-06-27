import { z } from "zod";
import {
  getReleaseBoard,
  updateReleaseBoardStage
} from "../services/release-board.service";
import { protectedProcedure, router } from "../trpc";

const boardStageSchema = z.enum(["pending", "ongoing", "completing", "shipped"]);

export const releaseBoardRouter = router({
  getBoard: protectedProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid().optional(),
          clientId: z.string().uuid().optional(),
          stage: boardStageSchema.optional()
        })
        .optional()
    )
    .query(({ ctx, input }) => getReleaseBoard(ctx, input ?? {})),

  updateFeatureStage: protectedProcedure
    .input(
      z.object({
        featureRequestId: z.string().uuid(),
        stage: boardStageSchema,
        overrideUnsafe: z.boolean().optional()
      })
    )
    .mutation(({ ctx, input }) => updateReleaseBoardStage(ctx, input))
});
