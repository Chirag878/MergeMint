import { z } from "zod";

export const ClarificationQuestionSchema = z.object({
  question: z.string().min(1),
  reason: z.string().min(1),
  priority: z.enum(["must_answer", "nice_to_have"])
});

export const ClarificationQuestionsOutputSchema = z.object({
  questions: z.array(ClarificationQuestionSchema).max(5)
});

export const PRDRequirementSchema = z.object({
  requirementKey: z.string().regex(/^REQ-\d{3}$/),
  requirement: z.string().min(1),
  priority: z.enum(["P0", "P1", "P2"]),
  acceptanceCriteria: z.array(z.string().min(1)).min(1)
});

export const PRDOutputSchema = z.object({
  title: z.string().min(1),
  problem: z.string().min(1),
  goals: z.array(z.string().min(1)).min(1),
  nonGoals: z.array(z.string().min(1)).default([]),
  userStories: z
    .array(
      z.object({
        actor: z.string().min(1),
        want: z.string().min(1),
        benefit: z.string().min(1)
      })
    )
    .default([]),
  requirements: z.array(PRDRequirementSchema).min(1),
  edgeCases: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([])
});

export const EngineeringTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.enum([
    "frontend",
    "backend",
    "database",
    "test",
    "docs",
    "infra",
    "other"
  ]),
  relatedRequirementKeys: z.array(z.string().regex(/^REQ-\d{3}$/)).min(1),
  acceptanceChecklist: z.array(z.string().min(1)).min(1),
  complexity: z.enum(["small", "medium", "large"])
});

export const EngineeringTasksOutputSchema = z.object({
  tasks: z.array(EngineeringTaskSchema).min(1)
});

export type ClarificationQuestionsOutput = z.infer<
  typeof ClarificationQuestionsOutputSchema
>;
export type PRDOutput = z.infer<typeof PRDOutputSchema>;
export type EngineeringTasksOutput = z.infer<
  typeof EngineeringTasksOutputSchema
>;
