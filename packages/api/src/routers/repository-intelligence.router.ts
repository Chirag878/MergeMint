import { z } from "zod";
import {
  analyzeProjectRepository,
  getLatestRepositoryAnalysisByProject,
  getRepositoryAnalysis,
  listRepositoryAnalysesByProject
} from "../services/repository-intelligence.service";
import { protectedProcedure, router } from "../trpc";

export const repositoryIntelligenceRouter = router({
  getLatestByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) => getLatestRepositoryAnalysisByProject(ctx, input)),

  analyzeProjectRepository: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid()
      })
    )
    .mutation(({ ctx, input }) => analyzeProjectRepository(ctx, input)),

  listByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) => listRepositoryAnalysesByProject(ctx, input)),

  getAnalysis: protectedProcedure
    .input(
      z.object({
        analysisId: z.string().uuid()
      })
    )
    .query(({ ctx, input }) => getRepositoryAnalysis(ctx, input))
});

