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
  const context = getFeatureContext(input);

  return {
    questions: [
      {
        question: `Which users or roles should be allowed to use "${context.title}", and should anyone be blocked from it?`,
        reason:
          "User access must be explicit so the PRD can define permission checks that are verifiable in the implementation.",
        priority: "must_answer"
      },
      {
        question: `What is the expected end-to-end workflow for ${context.workflowLabel}, from entry point through successful completion?`,
        reason:
          "The PRD needs the intended user path so requirements can map to observable UI and API behavior.",
        priority: "must_answer"
      },
      {
        question:
          criteria.length > 0
            ? `Are these acceptance criteria complete for releasing "${context.title}", or are any release-blocking checks missing?`
            : `What release-blocking acceptance criteria must pass before "${context.title}" can ship?`,
        reason:
          "Release readiness needs client-approved criteria that can later be checked against the PR and QA evidence.",
        priority: "must_answer"
      },
      {
        question: `What validation rules, required fields, or invalid data states should block ${context.workflowLabel}?`,
        reason:
          "Validation and blocking states become concrete REQ IDs and prevent ambiguous implementation behavior.",
        priority: "nice_to_have"
      },
      {
        question: `What edge cases or failure states should Veriflow treat as unacceptable for "${context.title}"?`,
        reason:
          "Known failure states help the QA review distinguish acceptable gaps from release-blocking defects.",
        priority: "nice_to_have"
      }
    ]
  };
}

function mockPRD(input: PRDInput): PRDOutput {
  const feature = input.feature;
  const context = getFeatureContext(feature);
  const title = context.title;
  const firstClarificationAnswer =
    input.clarifications?.find((clarification) => clarification.answer)?.answer;

  return {
    title,
    problem:
      feature.businessGoal ??
      `The team needs a verifiable implementation plan for ${title} so client delivery can be proven before release.`,
    goals: [
      feature.expectedBehavior ??
        `Deliver ${title} with clear in-scope behavior, validation rules, and release criteria.`,
      `Make the ${context.objectLabel} workflow observable enough for PRD, QA review, approval, and release reporting.`,
      "Define release readiness in terms that can be checked from UI behavior, API responses, persisted state, and generated artifacts."
    ],
    nonGoals: [
      "Do not include unrelated product areas, unrelated integrations, or speculative roles not implied by the feature request.",
      "Do not replace existing authentication, billing, or deployment workflows unless the feature request explicitly requires it.",
      "Assume existing project, feature, and release-report infrastructure remains the source of truth unless requirements state otherwise."
    ],
    userStories: [
      {
        actor: context.primaryUser,
        want: feature.description,
        benefit:
          feature.businessGoal ??
          "the requested delivery workflow can be completed predictably and verified before release"
      },
      {
        actor: "Client or delivery reviewer",
        want: `clear evidence that ${title} was implemented as requested`,
        benefit:
          "release approval can be based on traceable requirements instead of informal status updates"
      }
    ],
    requirements: [
      {
        requirementKey: "REQ-001",
        requirement: `The system must allow authorized users to start ${context.workflowLabel} only from the intended product context.`,
        priority: "P0",
        acceptanceCriteria: [
          `The entry point for ${context.workflowLabel} is visible only where the feature request implies it should be available.`,
          "Users without the required access cannot start the workflow and no downstream artifact is created."
        ]
      },
      {
        requirementKey: "REQ-002",
        requirement: `The system must capture the required inputs for ${title} with field-level validation before saving changes.`,
        priority: "P0",
        acceptanceCriteria: [
          "Submitting missing required fields returns clear validation feedback without persisting partial data.",
          "Submitting valid data stores the requested feature details in the correct project or workflow scope."
        ]
      },
      {
        requirementKey: "REQ-003",
        requirement: `The system must enforce scope boundaries so ${title} cannot affect unrelated clients, projects, or feature requests.`,
        priority: "P0",
        acceptanceCriteria: [
          "Requests scoped to a different client, project, or organization are rejected before any write occurs.",
          "Successful requests are associated only with the intended scoped record."
        ]
      },
      {
        requirementKey: "REQ-004",
        requirement: `The system must update the user-facing workflow state after ${title} succeeds or fails.`,
        priority: "P1",
        acceptanceCriteria: [
          "After a successful action, users can see the new or updated record without manually reconstructing state.",
          "After a failed action, users see a clear error and the previous valid state remains intact."
        ]
      },
      {
        requirementKey: "REQ-005",
        requirement: `The system must preserve evidence needed to verify ${title} during QA review and release approval.`,
        priority: "P1",
        acceptanceCriteria: [
          "The resulting workflow output includes enough stored detail to generate or update PRD requirements.",
          "The release control room or feature detail view can surface the latest status and next action for the feature."
        ]
      },
      {
        requirementKey: "REQ-006",
        requirement: `The system must handle empty, stale, duplicate, or invalid ${context.objectLabel} states without creating misleading release evidence.`,
        priority: "P2",
        acceptanceCriteria: [
          "Empty or stale prerequisite data produces a blocking message before release artifacts are generated.",
          "Duplicate submissions do not create duplicate records or conflicting requirement evidence."
        ]
      }
    ],
    edgeCases: [
      `The user lacks permission to perform ${context.workflowLabel}.`,
      `Required data for ${title} is missing, stale, or belongs to a different scope.`,
      `The same ${context.objectLabel} action is submitted twice in quick succession.`,
      firstClarificationAnswer
        ? `Client clarification to account for: ${firstClarificationAnswer}`
        : "The client has not answered optional clarification questions before implementation starts."
    ],
    risks: [
      "Ambiguous release criteria could cause an implementation that looks complete but cannot be verified against the original request.",
      "Weak scoping or validation could create client delivery evidence under the wrong project or feature.",
      "Missing state feedback could lead reviewers to approve a release without seeing the latest generated artifacts."
    ]
  };
}

function mockEngineeringTasks(
  input: EngineeringTasksInput
): EngineeringTasksOutput {
  const firstRequirement = input.requirements[0];

  if (!firstRequirement) {
    throw new Error("At least one requirement is required to generate tasks.");
  }
  const key = (index: number) =>
    input.requirements[index]?.requirementKey ?? firstRequirement.requirementKey;
  const allRequirementKeys = input.requirements.map(
    (requirement) => requirement.requirementKey
  );
  const prdTitle = input.prd.title;

  return {
    tasks: [
      {
        title: `Implement scoped API behavior for ${prdTitle}`,
        description:
          "Update the relevant router/service path to validate permissions, enforce scope, and persist the requested workflow state without cross-project or cross-client writes.",
        type: "backend",
        relatedRequirementKeys: [key(0), key(2)],
        acceptanceChecklist: [
          "Authorized requests in the correct scope complete and return the updated workflow record.",
          "Unauthorized, cross-scope, or invalid-state requests fail before any partial write occurs."
        ],
        complexity: "medium"
      },
      {
        title: `Build the ${prdTitle} user workflow UI`,
        description:
          "Update the relevant page or client component so users can enter required data, see validation feedback, and understand the resulting workflow status.",
        type: "frontend",
        relatedRequirementKeys: [key(0), key(1), key(3)],
        acceptanceChecklist: [
          "The UI exposes the workflow only in the intended product context.",
          "Success, loading, empty, and validation-error states are visible without a full page reload."
        ],
        complexity: "medium"
      },
      {
        title: "Add validation and duplicate-submission guards",
        description:
          "Centralize required-field, invalid-state, stale-data, and duplicate-submission checks so bad inputs cannot create misleading release evidence.",
        type: "backend",
        relatedRequirementKeys: [key(1), key(5)],
        acceptanceChecklist: [
          "Missing required inputs return specific validation errors.",
          "Duplicate or stale submissions do not create duplicate records or conflicting statuses."
        ],
        complexity: "medium"
      },
      {
        title: "Refresh release evidence after workflow changes",
        description:
          "Invalidate or refresh the affected feature detail, release control room, ledger, or report state after the workflow completes.",
        type: "frontend",
        relatedRequirementKeys: [key(3), key(4)],
        acceptanceChecklist: [
          "After success, the updated workflow state appears in the current view.",
          "Next-action or release-readiness indicators reflect the new state."
        ],
        complexity: "small"
      },
      {
        title: "Preserve scoped delivery metadata",
        description:
          "Ensure persisted records keep the project, feature, client, or organization scope needed for later PRD generation, QA review, approval, and reporting.",
        type: "database",
        relatedRequirementKeys: [key(2), key(4)],
        acceptanceChecklist: [
          "Created or updated records can be traced back to the intended feature and project.",
          "Records from another organization or client never appear in this workflow."
        ],
        complexity: "small"
      },
      {
        title: `Test ${prdTitle} release-readiness behavior`,
        description:
          "Add focused unit or integration coverage for the successful path, permission failures, validation failures, stale state, and UI refresh behavior.",
        type: "test",
        relatedRequirementKeys: allRequirementKeys,
        acceptanceChecklist: [
          "Tests prove the workflow succeeds only for authorized users in the correct scope.",
          "Tests prove invalid inputs, duplicate submissions, and stale states do not create release artifacts."
        ],
        complexity: "medium"
      },
      {
        title: "Document release verification expectations",
        description:
          "Update internal notes or user-facing copy so reviewers know which evidence proves the feature is ready for approval.",
        type: "docs",
        relatedRequirementKeys: [key(4)],
        acceptanceChecklist: [
          "Documentation or UI copy names the evidence reviewers should inspect.",
          "Release-blocking conditions are described without relying on tribal knowledge."
        ],
        complexity: "small"
      }
    ]
  };
}

function getFeatureContext(input: RequirementAgentInput) {
  const title = input.title.trim();
  const combined = `${input.title} ${input.description} ${
    input.businessGoal ?? ""
  } ${input.expectedBehavior ?? ""}`.toLowerCase();

  return {
    title,
    primaryUser: inferPrimaryUser(combined),
    objectLabel: inferObjectLabel(combined),
    workflowLabel: `"${title}"`
  };
}

function inferPrimaryUser(value: string) {
  if (value.includes("client")) return "Agency operator";
  if (value.includes("admin")) return "Workspace admin";
  if (value.includes("approval") || value.includes("release")) {
    return "Release reviewer";
  }
  if (value.includes("developer") || value.includes("github")) {
    return "Engineering reviewer";
  }

  return "Authorized workspace user";
}

function inferObjectLabel(value: string) {
  if (value.includes("client")) return "client delivery";
  if (value.includes("feature")) return "feature request";
  if (value.includes("approval")) return "approval";
  if (value.includes("report")) return "release report";
  if (value.includes("github") || value.includes("pull request")) {
    return "pull request evidence";
  }

  return "workflow";
}
