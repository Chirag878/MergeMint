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
    model: getAIConfig().OPENAI_MODEL ?? "gpt-4.1-mini",
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
  const criteria = feature.acceptanceCriteria?.length
    ? feature.acceptanceCriteria
    : [
        "Authorized users can complete the primary workflow.",
        "Invalid or incomplete input produces a clear validation error.",
        "The workflow can be verified with automated tests."
      ];

  return {
    title: feature.title,
    problem:
      feature.businessGoal ??
      `The product needs a reliable implementation plan for ${feature.title}.`,
    goals: [
      feature.expectedBehavior ??
        `Deliver ${feature.title} with clear behavior and release criteria.`
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
    requirements: criteria.map((criterion, index) => ({
      requirementKey: `REQ-${String(index + 1).padStart(3, "0")}`,
      requirement: criterion,
      priority: index === 0 ? "P0" : "P1",
      acceptanceCriteria: [criterion]
    })),
    edgeCases: [
      "User lacks permission for the workflow.",
      "Required data is missing or stale."
    ],
    risks: [
      "Ambiguous release criteria could cause incomplete implementation."
    ]
  };
}

function mockEngineeringTasks(
  input: EngineeringTasksInput
): EngineeringTasksOutput {
  return {
    tasks: input.requirements.map((requirement, index) => ({
      title: `Implement ${requirement.requirementKey}`,
      description: requirement.requirement,
      type: index % 3 === 0 ? "backend" : index % 3 === 1 ? "frontend" : "test",
      relatedRequirementKeys: [requirement.requirementKey],
      acceptanceChecklist: requirement.acceptanceCriteria,
      complexity: requirement.priority === "P0" ? "medium" : "small"
    }))
  };
}
