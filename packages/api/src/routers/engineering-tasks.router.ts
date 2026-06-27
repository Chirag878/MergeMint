import { z } from "zod";
import {
  getCopyPayloadForAgent,
  getDeveloperBriefForFeature,
  getProjectEngineeringTaskSummary,
  listEngineeringTasksByFeature,
  regenerateEngineeringTasksForFeature,
  updateEngineeringTask,
  updateEngineeringTaskStatus
} from "../services/engineering-tasks.service";
import { protectedProcedure, router } from "../trpc";

const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "blocked",
  "done",
  "skipped"
]);
const taskTypeSchema = z.enum([
  "frontend",
  "backend",
  "api",
  "database",
  "auth",
  "integration",
  "test",
  "docs",
  "qa",
  "devops",
  "infrastructure",
  "design",
  "other"
]);
const taskPrioritySchema = z.enum([
  "must_have",
  "should_have",
  "nice_to_have"
]);
const taskRiskSchema = z.enum(["low", "medium", "high"]);

export const engineeringTasksRouter = router({
  listByFeature: protectedProcedure
    .input(z.object({ featureRequestId: z.string().uuid() }))
    .query(({ ctx, input }) => listEngineeringTasksByFeature(ctx, input)),

  updateStatus: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        status: taskStatusSchema
      })
    )
    .mutation(({ ctx, input }) => updateEngineeringTaskStatus(ctx, input)),

  updateTask: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        status: taskStatusSchema.optional(),
        type: taskTypeSchema.optional(),
        priority: taskPrioritySchema.optional(),
        riskLevel: taskRiskSchema.optional(),
        suggestedFiles: z.array(z.string().min(1)).max(30).optional(),
        suggestedModules: z.array(z.string().min(1)).max(30).optional(),
        implementationNotes: z.string().max(4_000).nullable().optional(),
        verificationNotes: z.string().max(4_000).nullable().optional(),
        orderIndex: z.number().int().min(0).optional()
      })
    )
    .mutation(({ ctx, input }) => updateEngineeringTask(ctx, input)),

  regenerateForFeature: protectedProcedure
    .input(z.object({ featureRequestId: z.string().uuid() }))
    .mutation(({ ctx, input }) => regenerateEngineeringTasksForFeature(ctx, input)),

  getDeveloperBrief: protectedProcedure
    .input(z.object({ featureRequestId: z.string().uuid() }))
    .query(({ ctx, input }) => getDeveloperBriefForFeature(ctx, input)),

  copyPayloadForAgent: protectedProcedure
    .input(z.object({ featureRequestId: z.string().uuid() }))
    .query(({ ctx, input }) => getCopyPayloadForAgent(ctx, input)),

  getProjectSummary: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(({ ctx, input }) => getProjectEngineeringTaskSummary(ctx, input))
});

