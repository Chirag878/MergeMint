import { z } from "zod";
import {
  getProofGateStatus,
  getRequirementCoverageMap,
  publishGitHubProof
} from "../services/proof-gate.service";
import { protectedProcedure, router } from "../trpc";

const featureInput = z.object({
  featureRequestId: z.string().uuid()
});

const manualPublishInput = featureInput.extend({
  source: z.literal("manual_user_action")
});

export const proofGateRouter = router({
  getProofGateStatus: protectedProcedure
    .input(featureInput)
    .query(({ ctx, input }) => getProofGateStatus(ctx, input.featureRequestId)),

  getRequirementCoverageMap: protectedProcedure
    .input(featureInput)
    .query(({ ctx, input }) =>
      getRequirementCoverageMap(ctx, input.featureRequestId)
    ),

  publishGitHubProof: protectedProcedure
    .input(manualPublishInput)
    .mutation(({ ctx, input }) =>
      publishGitHubProof(ctx, input.featureRequestId, {
        source: input.source
      })
    )
});
