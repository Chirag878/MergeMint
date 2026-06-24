import { z } from "zod";

export const ClarificationQuestionSchema = z.object({
  question: z.string().min(1),
  reason: z.string().min(1),
  priority: z.enum(["must_answer", "nice_to_have"])
});

export const ClarificationQuestionsOutputSchema = z.object({
  questions: z.array(ClarificationQuestionSchema).min(3).max(6)
});

export const PRDRequirementSchema = z.object({
  requirementKey: z.string().regex(/^REQ-\d{3}$/),
  requirement: z
    .string()
    .min(24)
    .refine(
      (value) => value.startsWith("The system must"),
      "Requirement must start with 'The system must'."
    ),
  priority: z.enum(["P0", "P1", "P2"]),
  acceptanceCriteria: z.array(z.string().min(8)).min(2)
});

export const PRDOutputSchema = z
  .object({
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
  })
  .refine((output) => {
    const keys = output.requirements.map((requirement) => requirement.requirementKey);
    return new Set(keys).size === keys.length;
  }, "Requirement IDs must be unique.")
  .refine(
    (output) =>
      output.requirements.every(
        (requirement, index) =>
          requirement.requirementKey ===
          `REQ-${String(index + 1).padStart(3, "0")}`
      ),
    "Requirement IDs must be sequential starting at REQ-001."
  );

export const EngineeringTaskSchema = z.object({
  title: z.string().min(8),
  description: z.string().min(24),
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
  acceptanceChecklist: z.array(z.string().min(8)).min(2),
  complexity: z.enum(["small", "medium", "large"])
});

export const EngineeringTasksOutputSchema = z.object({
  tasks: z.array(EngineeringTaskSchema).min(1)
}).refine(
  (output) => output.tasks.some((task) => task.type === "test"),
  "At least one engineering task must be a test task."
).refine((output) => {
  const titles = output.tasks.map((task) => task.title.toLowerCase().trim());
  return new Set(titles).size === titles.length;
}, "Engineering task titles must be unique.");

export const RequirementCoverageOutputSchema = z.object({
  requirementKey: z.string().regex(/^REQ-\d{3}$/),
  status: z.enum(["covered", "partially_covered", "missing", "risky"]),
  evidence: z.array(z.string().min(1)).default([]),
  concern: z.string().min(1).optional()
});

export const QAFindingOutputSchema = z.object({
  requirementKey: z.string().regex(/^REQ-\d{3}$/).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  category: z.enum([
    "missing_requirement",
    "partial_implementation",
    "bug_risk",
    "security_risk",
    "test_gap",
    "edge_case_gap",
    "documentation_gap",
    "other"
  ]),
  title: z.string().min(1),
  description: z.string().min(1),
  file: z.string().min(1).optional(),
  line: z.number().int().positive().optional(),
  suggestedFix: z.string().min(1).optional()
});

export const QAReviewOutputSchema = z.object({
  overallStatus: z.enum(["approved", "changes_requested", "risky", "blocked"]),
  readinessScore: z.number().int().min(0).max(100),
  confidenceScore: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  coverage: z.array(RequirementCoverageOutputSchema).min(1),
  findings: z.array(QAFindingOutputSchema).default([])
});

export type ClarificationQuestionsOutput = z.infer<
  typeof ClarificationQuestionsOutputSchema
>;
export type PRDOutput = z.infer<typeof PRDOutputSchema>;
export type EngineeringTasksOutput = z.infer<
  typeof EngineeringTasksOutputSchema
>;
export type RequirementCoverageOutput = z.infer<
  typeof RequirementCoverageOutputSchema
>;
export type QAFindingOutput = z.infer<typeof QAFindingOutputSchema>;
export type QAReviewOutput = z.infer<typeof QAReviewOutputSchema>;
