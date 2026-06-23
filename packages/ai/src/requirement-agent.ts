import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { getAIConfig, getOpenAIClient, shouldUseMockAI } from "./client";
import {
  buildClarificationPrompt,
  buildEngineeringTasksPrompt,
  buildPRDPrompt,
  REQUIREMENT_AGENT_SYSTEM_PROMPT
} from "./prompts";
import {
  ClarificationQuestionsOutputSchema,
  EngineeringTasksOutputSchema,
  PRDOutputSchema,
  type ClarificationQuestionsOutput,
  type EngineeringTasksOutput,
  type PRDOutput
} from "./schemas";

export type RequirementAgentInput = {
  title: string;
  description: string;
  businessGoal?: string | null;
  expectedBehavior?: string | null;
  acceptanceCriteria?: string[];
  priority?: string;
};

export type PRDInput = {
  feature: RequirementAgentInput;
  clarifications?: Array<{
    question: string;
    answer?: string | null;
  }>;
};

export type EngineeringTasksInput = {
  prd: {
    title: string;
    problem: string;
    goals: string[];
    nonGoals: string[];
    userStories: unknown[];
    edgeCases: string[];
    risks: string[];
  };
  requirements: PRDOutput["requirements"];
};

export type AITokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type AIResult<T> = {
  data: T;
  model: string;
  tokenUsage?: AITokenUsage;
  mock: boolean;
};

export async function generateClarificationQuestions(
  input: RequirementAgentInput
): Promise<AIResult<ClarificationQuestionsOutput>> {
  if (shouldUseMockAI()) {
    return mockResult(ClarificationQuestionsOutputSchema, mockClarifications(input));
  }

  return runStructuredCompletion({
    schemaName: "clarification_questions",
    schema: ClarificationQuestionsOutputSchema,
    prompt: buildClarificationPrompt(input)
  });
}

export async function generatePRD(
  input: PRDInput
): Promise<AIResult<PRDOutput>> {
  if (shouldUseMockAI()) {
    return mockResult(PRDOutputSchema, mockPRD(input));
  }

  return runStructuredCompletion({
    schemaName: "prd",
    schema: PRDOutputSchema,
    prompt: buildPRDPrompt(input)
  });
}

export async function generateEngineeringTasks(
  input: EngineeringTasksInput
): Promise<AIResult<EngineeringTasksOutput>> {
  if (shouldUseMockAI()) {
    return mockResult(EngineeringTasksOutputSchema, mockEngineeringTasks(input));
  }

  return runStructuredCompletion({
    schemaName: "engineering_tasks",
    schema: EngineeringTasksOutputSchema,
    prompt: buildEngineeringTasksPrompt(input)
  });
}

async function runStructuredCompletion<T extends z.ZodTypeAny>(input: {
  schemaName: string;
  schema: T;
  prompt: string;
}): Promise<AIResult<z.infer<T>>> {
  const config = getAIConfig();
  const client = getOpenAIClient();
  const completion = await client.chat.completions.parse({
    model: config.OPENAI_MODEL ?? "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: REQUIREMENT_AGENT_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: input.prompt
      }
    ],
    response_format: zodResponseFormat(input.schema, input.schemaName)
  });

  const parsed = completion.choices[0]?.message.parsed;

  if (!parsed) {
    throw new Error("OpenAI returned no structured output.");
  }

  return {
    data: input.schema.parse(parsed),
    model: config.OPENAI_MODEL ?? "gpt-4.1-mini",
    tokenUsage: completion.usage
      ? {
          inputTokens: completion.usage.prompt_tokens,
          outputTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens
        }
      : undefined,
    mock: false
  };
}

function mockResult<T extends z.ZodTypeAny>(
  schema: T,
  value: z.infer<T>
): AIResult<z.infer<T>> {
  return {
    data: schema.parse(value),
    model: "mock",
    mock: true
  };
}

function mockClarifications(
  input: RequirementAgentInput
): ClarificationQuestionsOutput {
  const criteria = input.acceptanceCriteria ?? [];

  return {
    questions: [
      {
        question: `What user roles are allowed to use "${input.title}"?`,
        reason: "Permissions need to be explicit before implementation.",
        priority: "must_answer"
      },
      {
        question: "What data states should block, warn, or allow the workflow?",
        reason: "State transitions and edge cases drive acceptance tests.",
        priority: "must_answer"
      },
      {
        question:
          criteria.length > 0
            ? "Are the listed acceptance criteria complete for release readiness?"
            : "What acceptance criteria must pass before this can ship?",
        reason: "The PRD needs testable release criteria.",
        priority: "must_answer"
      }
    ]
  };
}

function mockPRD(input: PRDInput): PRDOutput {
  const feature = input.feature;
  const title = feature.title;

  return {
    title,
    problem:
      feature.businessGoal ??
      `The product needs a reliable implementation plan for ${title}.`,
    goals: [
      feature.expectedBehavior ??
        `Deliver ${title} with clear behavior and release criteria.`,
      "Make authorization, state handling, and validation behavior explicit."
    ],
    nonGoals: ["Do not include unrelated product areas in this workflow."],
    userStories: [
      {
        actor: "Authorized user",
        want: feature.description,
        benefit:
          feature.businessGoal ??
          "the workflow can be completed predictably in production"
      }
    ],
    requirements: [
      {
        requirementKey: "REQ-001",
        requirement: `The system must allow authorized users to complete the ${title} workflow from a valid feature state.`,
        priority: "P0",
        acceptanceCriteria: [
          "Given an authorized user and valid input, the workflow completes and persists the expected state.",
          "Given a user without permission, the workflow is rejected before any state is changed."
        ]
      },
      {
        requirementKey: "REQ-002",
        requirement: `The system must validate all required ${title} inputs before generating downstream release artifacts.`,
        priority: "P0",
        acceptanceCriteria: [
          "Missing required fields return field-level validation errors.",
          "Invalid state transitions are blocked and produce a clear error message."
        ]
      },
      {
        requirementKey: "REQ-003",
        requirement: `The system must expose auditable status changes for the ${title} workflow.`,
        priority: "P1",
        acceptanceCriteria: [
          "Successful workflow actions record who performed the action and when it happened.",
          "Failed workflow actions do not create partial release artifacts."
        ]
      },
      {
        requirementKey: "REQ-004",
        requirement: `The system must provide release readiness feedback for ${title} before users rely on the output.`,
        priority: "P1",
        acceptanceCriteria: [
          "Generated output includes clear acceptance checks that can be verified manually or automatically.",
          "Users can identify incomplete or missing release criteria before approval."
        ]
      }
    ],
    edgeCases: [
      "User lacks permission for the workflow.",
      "Required data is missing or stale.",
      "The feature request is already in a generated state."
    ],
    risks: [
      "Ambiguous release criteria could cause incomplete implementation.",
      "Weak validation could create release artifacts that cannot be tested."
    ]
  };
}

function mockEngineeringTasks(
  input: EngineeringTasksInput
): EngineeringTasksOutput {
  const firstRequirement = input.requirements[0];
  const secondRequirement = input.requirements[1] ?? firstRequirement;

  if (!firstRequirement) {
    throw new Error("At least one requirement is required to generate tasks.");
  }

  return {
    tasks: [
      {
        title: "Build validated workflow API",
        description:
          "Implement the protected backend mutation, validation paths, and state updates required by the core workflow.",
        type: "backend",
        relatedRequirementKeys: [firstRequirement.requirementKey],
        acceptanceChecklist: [
          "Authorized requests complete the workflow and persist expected state.",
          "Unauthorized or invalid requests fail without partial writes."
        ],
        complexity: "medium"
      },
      {
        title: "Render workflow readiness UI",
        description:
          "Create the frontend states that show workflow inputs, generated readiness output, and blocking validation errors.",
        type: "frontend",
        relatedRequirementKeys: [firstRequirement.requirementKey],
        acceptanceChecklist: [
          "Users can see the current workflow status and next action.",
          "Validation and permission errors are visible without a page reload."
        ],
        complexity: "medium"
      },
      {
        title: "Persist audit and reporting metadata",
        description:
          "Store the audit metadata needed to trace generated artifacts, status changes, and release readiness decisions.",
        type: "database",
        relatedRequirementKeys: [secondRequirement.requirementKey],
        acceptanceChecklist: [
          "Successful actions include actor and timestamp metadata.",
          "Failed actions do not create misleading audit or report records."
        ],
        complexity: "small"
      },
      {
        title: "Add workflow authorization tests",
        description:
          "Cover authorized, unauthorized, invalid-state, and validation-failure cases for the generated workflow.",
        type: "test",
        relatedRequirementKeys: input.requirements.map(
          (requirement) => requirement.requirementKey
        ),
        acceptanceChecklist: [
          "Tests prove unauthorized users cannot perform protected actions.",
          "Tests prove invalid inputs and invalid states do not create artifacts."
        ],
        complexity: "medium"
      }
    ]
  };
}
