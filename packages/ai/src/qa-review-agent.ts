import { zodResponseFormat } from "openai/helpers/zod";
import { getAIConfig, getOpenAIClient, shouldUseMockAI } from "./client";
import { buildQAReviewPrompt, REQUIREMENT_AGENT_SYSTEM_PROMPT } from "./prompts";
import {
  QAReviewOutputSchema,
  type QAReviewOutput,
  type QAFindingOutput,
  type RequirementCoverageOutput
} from "./schemas";
import type { AITokenUsage, AIResult } from "./requirement-agent";

export type QAReviewInput = {
  featureRequest: {
    title: string;
    description: string;
    businessGoal?: string | null;
    expectedBehavior?: string | null;
  };
  prd: {
    title: string;
    problem?: string | null;
    goals: string[];
  };
  requirements: Array<{
    requirementKey: string;
    requirement: string;
    priority: string;
    acceptanceCriteria: string[];
  }>;
  engineeringTasks: Array<{
    title: string;
    description?: string | null;
    type: string;
    relatedRequirementKeys: string[];
    acceptanceChecklist: string[];
  }>;
  pullRequest: {
    title: string;
    author?: string | null;
    branch: string;
    baseBranch: string;
    state: string;
    latestCommitSha?: string | null;
  };
  changedFiles: Array<{
    filename: string;
    status?: string;
    additions?: number;
    deletions?: number;
    changes?: number;
  }>;
  diffText: string;
  diffTruncated: boolean;
};

export async function generateQAReview(
  input: QAReviewInput
): Promise<AIResult<QAReviewOutput>> {
  if (shouldUseMockAI()) {
    return {
      data: validateQAReviewOutput(mockQAReview(input), input.requirements),
      model: "mock",
      mock: true
    };
  }

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
        content: buildQAReviewPrompt(input)
      }
    ],
    response_format: zodResponseFormat(QAReviewOutputSchema, "qa_review")
  });
  const parsed = completion.choices[0]?.message.parsed;

  if (!parsed) {
    throw new Error("OpenAI returned no QA review structured output.");
  }

  return {
    data: validateQAReviewOutput(parsed, input.requirements),
    model: config.OPENAI_MODEL ?? "gpt-4.1-mini",
    tokenUsage: toTokenUsage(completion.usage),
    mock: false
  };
}

function validateQAReviewOutput(
  output: QAReviewOutput,
  requirements: QAReviewInput["requirements"]
) {
  const parsed = QAReviewOutputSchema.parse(output);
  const expectedKeys = requirements.map((requirement) => requirement.requirementKey);
  const expectedKeySet = new Set(expectedKeys);
  const coverageKeySet = new Set(
    parsed.coverage.map((coverage) => coverage.requirementKey)
  );

  for (const key of expectedKeys) {
    if (!coverageKeySet.has(key)) {
      throw new Error(`QA review output is missing coverage for ${key}.`);
    }
  }

  for (const coverage of parsed.coverage) {
    if (!expectedKeySet.has(coverage.requirementKey)) {
      throw new Error(
        `QA review output referenced unknown requirement ${coverage.requirementKey}.`
      );
    }
  }

  for (const finding of parsed.findings) {
    if (finding.requirementKey && !expectedKeySet.has(finding.requirementKey)) {
      throw new Error(
        `QA review finding referenced unknown requirement ${finding.requirementKey}.`
      );
    }
  }

  return {
    ...parsed,
    coverage: expectedKeys.map((key) => {
      const item = parsed.coverage.find((coverage) => coverage.requirementKey === key);

      if (!item) {
        throw new Error(`QA review output is missing coverage for ${key}.`);
      }

      return item;
    })
  };
}

function mockQAReview(input: QAReviewInput): QAReviewOutput {
  const coverage: RequirementCoverageOutput[] = input.requirements.map(
    (requirement, index) => ({
      requirementKey: requirement.requirementKey,
      status:
        index === 0
          ? "covered"
          : index === 1
            ? "partially_covered"
            : "risky",
      evidence:
        index === 0
          ? [
              `Changed files include ${input.changedFiles[0]?.filename ?? "implementation files"}.`
            ]
          : [
              "The snapshot does not provide enough evidence to prove complete coverage."
            ],
      concern:
        index === 0
          ? null
          : "Additional implementation or test evidence is needed before release."
    })
  );
  const findingRequirement = input.requirements[1] ?? input.requirements[0];
  const findings: QAFindingOutput[] = findingRequirement
    ? [
        {
          requirementKey: findingRequirement.requirementKey,
          severity: "medium",
          category: "partial_implementation",
          title: "Requirement needs stronger implementation evidence",
          description:
            "The PR snapshot shows related changes, but the diff does not prove every acceptance criterion is covered.",
          file: input.changedFiles[0]?.filename ?? null,
          line: null,
          suggestedFix:
            "Add implementation or tests that explicitly cover the missing acceptance criteria."
        }
      ]
    : [];

  return {
    overallStatus: "risky",
    readinessScore: 72,
    confidenceScore: 82,
    summary:
      "The PR appears to address part of the requirement set, but at least one requirement needs more evidence before approval.",
    coverage,
    findings
  };
}

function toTokenUsage(
  usage:
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      }
    | null
    | undefined
): AITokenUsage | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens
  };
}
