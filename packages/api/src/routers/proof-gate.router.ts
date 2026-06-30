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
    .input(featureInput)
    .mutation(({ ctx, input }) => publishGitHubProof(ctx, input.featureRequestId))
});
