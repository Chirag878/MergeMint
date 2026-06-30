import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  generateClarificationQuestions,
  generateEngineeringTasks,
  generatePRD,
  getAIConfig,
  type AITokenUsage,
  type EngineeringTasksOutput
} from "@veriflow/ai";
import {
  aiRuns,
  auditLogs,
  clarificationQuestions,
  db,
  engineeringTasks,
  featureRequests,
  prdRequirements,
  prds,
  usageCounters,
  type JsonObject,
  type TokenUsage
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import {
  hasClarificationAnswerChangedAfterPrd,
  isClarificationAnswerNewerThanPrd
} from "./prd-staleness";
import { getLatestRepositoryContextForProject } from "./repository-intelligence.service";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

type AIAgentType = "clarification" | "prd_generation" | "task_generation";

function toBootstrapInput(ctx: ProtectedContext) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function toDbTokenUsage(tokenUsage?: AITokenUsage): TokenUsage | undefined {
  if (!tokenUsage) {
    return undefined;
  }

  return {
    inputTokens: tokenUsage.inputTokens,
    outputTokens: tokenUsage.outputTokens,
    totalTokens: tokenUsage.totalTokens
  };
}

function getCurrentPeriodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

async function getScopedFeatureOrThrow(
  featureRequestId: string,
  organizationId: string
) {
  const [featureRequest] = await db
    .select()
    .from(featureRequests)
    .where(
      and(
        eq(featureRequests.id, featureRequestId),
        eq(featureRequests.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!featureRequest) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Feature request not found."
    });
  }

  return featureRequest;
}

async function getScopedPrdOrThrow(prdId: string, organizationId: string) {
  const [row] = await db
    .select({
      prd: prds,
      featureRequest: featureRequests
    })
    .from(prds)
    .innerJoin(featureRequests, eq(prds.featureRequestId, featureRequests.id))
    .where(
      and(eq(prds.id, prdId), eq(featureRequests.organizationId, organizationId))
    )
    .limit(1);

  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "PRD not found."
    });
  }

  return row;
}

async function createAIRun(input: {
  organizationId: string;
  featureRequestId?: string;
  agentType: AIAgentType;
  model?: string;
  payload: unknown;
}) {
  const [run] = await db
    .insert(aiRuns)
    .values({
      organizationId: input.organizationId,
      featureRequestId: input.featureRequestId,
      agentType: input.agentType,
      model: input.model ?? getAIConfig().OPENAI_MODEL ?? "gpt-4.1-mini",
      input: toJsonObject(input.payload),
      status: "running"
    })
    .returning();

  if (!run) {
    throw new Error("Unable to create AI run.");
  }

  return run;
}

async function completeAIRun(input: {
  runId: string;
  output: unknown;
  model: string;
  tokenUsage?: AITokenUsage;
}) {
  await db
    .update(aiRuns)
    .set({
      status: "succeeded",
      output: toJsonObject(input.output),
      model: input.model,
      tokenUsage: toDbTokenUsage(input.tokenUsage)
    })
    .where(eq(aiRuns.id, input.runId));
}

async function failAIRun(runId: string, error: unknown) {
  await db
    .update(aiRuns)
    .set({
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    })
    .where(eq(aiRuns.id, runId));
}

async function withAIRun<T>(input: {
  organizationId: string;
  featureRequestId?: string;
  agentType: AIAgentType;
  payload: unknown;
  run: () => Promise<{
    data: T;
    model: string;
    tokenUsage?: AITokenUsage;
  }>;
}) {
  const aiRun = await createAIRun({
    organizationId: input.organizationId,
    featureRequestId: input.featureRequestId,
    agentType: input.agentType,
    payload: input.payload
  });

  try {
    const result = await input.run();
    await completeAIRun({
      runId: aiRun.id,
      output: result.data,
      model: result.model,
      tokenUsage: result.tokenUsage
    });

    return {
      ...result,
      aiRunId: aiRun.id
    };
  } catch (error) {
    await failAIRun(aiRun.id, error);
    throw error;
  }
}

async function writeAuditLog(input: {
  organizationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: JsonObject;
}) {
  await db.insert(auditLogs).values({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {}
  });
}

function mapQuestionPriority(priority: "must_answer" | "nice_to_have") {
  return priority === "must_answer" ? ("high" as const) : ("medium" as const);
}

function isRequiredClarification(priority: string) {
  return priority === "high" || priority === "urgent";
}

function mapTaskType(type: EngineeringTasksOutput["tasks"][number]["type"]) {
  if (type === "infra") {
    return "infrastructure" as const;
  }

  return type;
}

function mapTaskComplexity(
  complexity: EngineeringTasksOutput["tasks"][number]["complexity"]
) {
  if (complexity === "small") {
    return "low" as const;
  }

  if (complexity === "large") {
    return "high" as const;
  }

  return "medium" as const;
}

function mapRequirementPriority(priority: string): "P0" | "P1" | "P2" {
  if (priority === "P0" || priority === "P1" || priority === "P2") {
    return priority;
  }

  return "P1" as const;
}

export async function generateClarificationsForFeatureRequest(
  ctx: ProtectedContext,
  featureRequestId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "create_feature_request");

  const featureRequest = await getScopedFeatureOrThrow(
    featureRequestId,
    workspace.activeOrganization.id
  );

  const existing = await db
    .select()
    .from(clarificationQuestions)
    .where(eq(clarificationQuestions.featureRequestId, featureRequest.id))
    .orderBy(clarificationQuestions.createdAt);

  if (existing.length > 0) {
    return existing;
  }

  const repositoryContext = await getLatestRepositoryContextForProject({
    organizationId: workspace.activeOrganization.id,
    projectId: featureRequest.projectId
  });
  const payload = {
    title: featureRequest.title,
    description: featureRequest.description,
    businessGoal: featureRequest.businessGoal,
    expectedBehavior: featureRequest.expectedBehavior,
    acceptanceCriteria: featureRequest.acceptanceCriteria,
    priority: featureRequest.priority,
    repositoryContext
  };

  const result = await withAIRun({
    organizationId: workspace.activeOrganization.id,
    featureRequestId: featureRequest.id,
    agentType: "clarification",
    payload,
    run: () => generateClarificationQuestions(payload)
  });

  const created = await db.transaction(async (tx) => {
    const rows =
      result.data.questions.length > 0
        ? await tx
            .insert(clarificationQuestions)
            .values(
              result.data.questions.map((question) => ({
                featureRequestId: featureRequest.id,
                question: question.question,
                reason: question.reason,
                priority: mapQuestionPriority(question.priority)
              }))
            )
            .returning()
        : [];

    await tx
      .update(featureRequests)
      .set({
        status: rows.length > 0 ? "clarifying" : featureRequest.status,
        boardStage: rows.length > 0 ? "pending" : featureRequest.boardStage,
        updatedAt: new Date()
      })
      .where(eq(featureRequests.id, featureRequest.id));

    return rows;
  });

  await writeAuditLog({
    organizationId: workspace.activeOrganization.id,
    actorId: workspace.appUser.id,
    action: "clarification_questions_generated",
    entityType: "feature_request",
    entityId: featureRequest.id,
    metadata: {
      questionCount: created.length,
      aiRunId: result.aiRunId
    }
  });

  return created;
}

export async function answerClarificationQuestion(
  ctx: ProtectedContext,
  input: {
    questionId: string;
    answer: string;
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "create_feature_request");

  const [row] = await db
    .select({
      question: clarificationQuestions,
      featureRequest: featureRequests
    })
    .from(clarificationQuestions)
    .innerJoin(
      featureRequests,
      eq(clarificationQuestions.featureRequestId, featureRequests.id)
    )
    .where(
      and(
        eq(clarificationQuestions.id, input.questionId),
        eq(featureRequests.organizationId, workspace.activeOrganization.id)
      )
    )
    .limit(1);

  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Clarification question not found."
    });
  }

  const [updated] = await db
    .update(clarificationQuestions)
    .set({
      answer: input.answer,
      answeredAt: new Date()
    })
    .where(eq(clarificationQuestions.id, row.question.id))
    .returning();

  await db
    .update(featureRequests)
    .set({ updatedAt: new Date() })
    .where(eq(featureRequests.id, row.featureRequest.id));

  await writeAuditLog({
    organizationId: workspace.activeOrganization.id,
    actorId: workspace.appUser.id,
    action: "clarification_question_answered",
    entityType: "feature_request",
    entityId: row.featureRequest.id,
    metadata: {
      questionId: row.question.id
    }
  });

  return updated ?? row.question;
}

export async function answerClarificationQuestions(
  ctx: ProtectedContext,
  input: {
    featureRequestId: string;
    answers: Array<{
      questionId: string;
      answer: string;
    }>;
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "create_feature_request");

  const featureRequest = await getScopedFeatureOrThrow(
    input.featureRequestId,
    workspace.activeOrganization.id
  );
  const normalizedAnswers = input.answers
    .map((answer) => ({
      questionId: answer.questionId,
      answer: answer.answer.trim()
    }))
    .filter((answer) => answer.answer.length > 0);

  if (normalizedAnswers.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "At least one answer is required."
    });
  }

  const existingQuestions = await db
    .select()
    .from(clarificationQuestions)
    .where(eq(clarificationQuestions.featureRequestId, featureRequest.id))
    .orderBy(clarificationQuestions.createdAt);
  const questionById = new Map(
    existingQuestions.map((question) => [question.id, question])
  );

  for (const answer of normalizedAnswers) {
    if (!questionById.has(answer.questionId)) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Clarification question not found."
      });
    }
  }

  const now = new Date();
  const updated = await db.transaction(async (tx) => {
    const rows = [];

    for (const answer of normalizedAnswers) {
      const [row] = await tx
        .update(clarificationQuestions)
        .set({
          answer: answer.answer,
          answeredAt: now
        })
        .where(eq(clarificationQuestions.id, answer.questionId))
        .returning();

      if (row) {
        rows.push(row);
      }
    }

    await tx
      .update(featureRequests)
      .set({ updatedAt: now })
      .where(eq(featureRequests.id, featureRequest.id));

    return rows;
  });

  const mergedQuestions = existingQuestions.map((question) => {
    const replacement = updated.find((row) => row.id === question.id);
    return replacement ?? question;
  });
  const unansweredRequiredClarificationQuestions = mergedQuestions.filter(
    (question) => isRequiredClarification(question.priority) && !question.answer
  );

  await writeAuditLog({
    organizationId: workspace.activeOrganization.id,
    actorId: workspace.appUser.id,
    action: "clarification_questions_answered",
    entityType: "feature_request",
    entityId: featureRequest.id,
    metadata: {
      answeredCount: updated.length
    }
  });

  return {
    updated,
    requirementReview: {
      started: true,
      completed: unansweredRequiredClarificationQuestions.length === 0,
      noFurtherClarificationsNeeded: mergedQuestions.length === 0,
      unansweredRequiredCount: unansweredRequiredClarificationQuestions.length
    }
  };
}

export async function generatePrdForFeatureRequest(
  ctx: ProtectedContext,
  featureRequestId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "create_feature_request");

  const featureRequest = await getScopedFeatureOrThrow(
    featureRequestId,
    workspace.activeOrganization.id
  );

  const [existingPrd] = await db
    .select()
    .from(prds)
    .where(eq(prds.featureRequestId, featureRequest.id))
    .orderBy(desc(prds.version))
    .limit(1);

  let clarifications = await db
    .select()
    .from(clarificationQuestions)
    .where(eq(clarificationQuestions.featureRequestId, featureRequest.id))
    .orderBy(clarificationQuestions.createdAt);

  const [clarificationRun] = await db
    .select({ id: aiRuns.id })
    .from(aiRuns)
    .where(
      and(
        eq(aiRuns.featureRequestId, featureRequest.id),
        eq(aiRuns.agentType, "clarification"),
        eq(aiRuns.status, "succeeded")
      )
    )
    .limit(1);

  if (clarifications.length === 0 && !clarificationRun) {
    clarifications = await generateClarificationsForFeatureRequest(
      ctx,
      featureRequestId
    );
  }

  const prdMayBeOutdated = hasClarificationAnswerChangedAfterPrd(
    clarifications,
    existingPrd
  );

  if (existingPrd && !prdMayBeOutdated) {
    const requirements = await db
      .select()
      .from(prdRequirements)
      .where(eq(prdRequirements.prdId, existingPrd.id))
      .orderBy(prdRequirements.requirementKey);

    return {
      prd: existingPrd,
      requirements
    };
  }

  const unansweredRequiredClarifications = clarifications.filter(
    (question) => isRequiredClarification(question.priority) && !question.answer
  );

  if (unansweredRequiredClarifications.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Complete Requirement Review before generating PRD."
    });
  }

  const repositoryContext = await getLatestRepositoryContextForProject({
    organizationId: workspace.activeOrganization.id,
    projectId: featureRequest.projectId
  });
  const payload = {
    feature: {
      title: featureRequest.title,
      description: featureRequest.description,
      businessGoal: featureRequest.businessGoal,
      expectedBehavior: featureRequest.expectedBehavior,
      acceptanceCriteria: featureRequest.acceptanceCriteria,
      priority: featureRequest.priority
    },
    clarifications: clarifications.map((question) => ({
      question: question.question,
      answer: question.answer
    })),
    repositoryContext
  };

  const result = await withAIRun({
    organizationId: workspace.activeOrganization.id,
    featureRequestId: featureRequest.id,
    agentType: "prd_generation",
    payload,
    run: () => generatePRD(payload)
  });

  const created = await db.transaction(async (tx) => {
    const [prd] = await tx
      .insert(prds)
      .values({
        featureRequestId: featureRequest.id,
        title: result.data.title,
        problem: result.data.problem,
        goals: result.data.goals,
        nonGoals: result.data.nonGoals,
        userStories: result.data.userStories,
        edgeCases: result.data.edgeCases,
        risks: result.data.risks,
        version: (existingPrd?.version ?? 0) + 1,
        status: "generated"
      })
      .returning();

    if (!prd) {
      throw new Error("Unable to create PRD.");
    }

    const requirements = await tx
      .insert(prdRequirements)
      .values(
        result.data.requirements.map((requirement) => ({
          prdId: prd.id,
          requirementKey: requirement.requirementKey,
          requirement: requirement.requirement,
          priority: requirement.priority,
          acceptanceCriteria: requirement.acceptanceCriteria
        }))
      )
      .returning();

    await tx
      .update(featureRequests)
      .set({
        status: "prd_ready",
        boardStage: "ongoing",
        updatedAt: new Date()
      })
      .where(eq(featureRequests.id, featureRequest.id));

    await tx
      .update(usageCounters)
      .set({
        featureWorkflowsUsed: sql`${usageCounters.featureWorkflowsUsed} + 1`,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(usageCounters.organizationId, workspace.activeOrganization.id),
          eq(usageCounters.periodKey, getCurrentPeriodKey())
        )
      );

    return {
      prd,
      requirements
    };
  });

  await writeAuditLog({
    organizationId: workspace.activeOrganization.id,
    actorId: workspace.appUser.id,
    action: "prd_generated",
    entityType: "feature_request",
    entityId: featureRequest.id,
    metadata: {
      prdId: created.prd.id,
      requirementCount: created.requirements.length,
      aiRunId: result.aiRunId
    }
  });

  return created;
}

export async function generateEngineeringTasksForPrd(
  ctx: ProtectedContext,
  prdId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "create_feature_request");

  const { prd, featureRequest } = await getScopedPrdOrThrow(
    prdId,
    workspace.activeOrganization.id
  );

  const existingTasks = await db
    .select()
    .from(engineeringTasks)
    .where(eq(engineeringTasks.prdId, prd.id))
    .orderBy(engineeringTasks.createdAt);

  if (existingTasks.length > 0) {
    return existingTasks;
  }

  const requirements = await db
    .select()
    .from(prdRequirements)
    .where(eq(prdRequirements.prdId, prd.id))
    .orderBy(prdRequirements.requirementKey);

  if (requirements.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A PRD must have requirements before tasks can be generated."
    });
  }

  const repositoryContext = await getLatestRepositoryContextForProject({
    organizationId: workspace.activeOrganization.id,
    projectId: featureRequest.projectId
  });
  const payload = {
    prd: {
      title: prd.title,
      problem: prd.problem ?? "",
      goals: prd.goals,
      nonGoals: prd.nonGoals,
      userStories: prd.userStories,
      edgeCases: prd.edgeCases,
      risks: prd.risks
    },
    requirements: requirements.map((requirement) => ({
      requirementKey: requirement.requirementKey,
      requirement: requirement.requirement,
      priority: mapRequirementPriority(requirement.priority),
      acceptanceCriteria: requirement.acceptanceCriteria
    })),
    repositoryContext
  };

  const result = await withAIRun({
    organizationId: workspace.activeOrganization.id,
    featureRequestId: featureRequest.id,
    agentType: "task_generation",
    payload,
    run: () => generateEngineeringTasks(payload)
  });

  const created = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(engineeringTasks)
      .values(
        result.data.tasks.map((task, index) => ({
          organizationId: workspace.activeOrganization.id,
          projectId: featureRequest.projectId,
          featureRequestId: featureRequest.id,
          prdId: prd.id,
          title: task.title,
          description: task.description,
          type: mapTaskType(task.type),
          priority: task.priority,
          riskLevel: task.riskLevel,
          relatedRequirementKeys: task.relatedRequirementKeys,
          acceptanceCriteriaRefs: task.relatedAcceptanceCriteria,
          acceptanceChecklist: task.acceptanceChecklist,
          suggestedFiles: task.suggestedFiles,
          suggestedModules: task.suggestedModules,
          implementationNotes: task.implementationNotes,
          verificationNotes: task.verificationNotes,
          orderIndex: index,
          complexity: mapTaskComplexity(task.complexity)
        }))
      )
      .returning();

    await tx
      .update(featureRequests)
      .set({
        status: "tasks_ready",
        boardStage: "ongoing",
        updatedAt: new Date()
      })
      .where(eq(featureRequests.id, featureRequest.id));

    return rows;
  });

  await writeAuditLog({
    organizationId: workspace.activeOrganization.id,
    actorId: workspace.appUser.id,
    action: "engineering_tasks_generated",
    entityType: "feature_request",
    entityId: featureRequest.id,
    metadata: {
      prdId: prd.id,
      taskCount: created.length,
      aiRunId: result.aiRunId
    }
  });

  return created;
}

export async function getFeatureWorkflow(
  ctx: ProtectedContext,
  featureRequestId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  const featureRequest = await getScopedFeatureOrThrow(
    featureRequestId,
    workspace.activeOrganization.id
  );

  const [questions, prdRows, clarificationRunRows] = await Promise.all([
    db
      .select()
      .from(clarificationQuestions)
      .where(eq(clarificationQuestions.featureRequestId, featureRequest.id))
      .orderBy(clarificationQuestions.createdAt),
    db
      .select()
      .from(prds)
      .where(eq(prds.featureRequestId, featureRequest.id))
      .orderBy(desc(prds.version)),
    db
      .select({ id: aiRuns.id, createdAt: aiRuns.createdAt })
      .from(aiRuns)
      .where(
        and(
          eq(aiRuns.featureRequestId, featureRequest.id),
          eq(aiRuns.agentType, "clarification"),
          eq(aiRuns.status, "succeeded")
        )
      )
      .orderBy(desc(aiRuns.createdAt))
      .limit(1)
  ]);

  const latestPrd = prdRows[0] ?? null;
  const latestClarificationRun = clarificationRunRows[0] ?? null;
  const unansweredRequiredClarificationQuestions = questions.filter(
    (question) => isRequiredClarification(question.priority) && !question.answer
  );
  const requirementReviewStarted = Boolean(
    latestClarificationRun || questions.length > 0 || latestPrd
  );
  const requirementReviewComplete = Boolean(
    latestPrd ||
      (requirementReviewStarted &&
        unansweredRequiredClarificationQuestions.length === 0)
  );
  const prdMayBeOutdated = hasClarificationAnswerChangedAfterPrd(
    questions,
    latestPrd
  );

  const [requirements, tasks] = latestPrd
    ? await Promise.all([
        db
          .select()
          .from(prdRequirements)
          .where(eq(prdRequirements.prdId, latestPrd.id))
          .orderBy(prdRequirements.requirementKey),
        db
          .select()
          .from(engineeringTasks)
          .where(eq(engineeringTasks.prdId, latestPrd.id))
          .orderBy(engineeringTasks.createdAt)
      ])
    : [[], []];

  return {
    featureRequest,
    clarificationQuestions: questions,
    unansweredRequiredClarificationQuestions,
    requirementReview: {
      started: requirementReviewStarted,
      completed: requirementReviewComplete,
      noFurtherClarificationsNeeded:
        Boolean(latestClarificationRun) && questions.length === 0,
      latestRunAt: latestClarificationRun?.createdAt ?? null
    },
    prd: latestPrd,
    prdMayBeOutdated,
    staleClarificationAnswerIds: prdMayBeOutdated
      ? questions
          .filter((question) =>
            latestPrd ? isClarificationAnswerNewerThanPrd(question, latestPrd) : false
          )
          .map((question) => question.id)
      : [],
    prdRequirements: requirements,
    engineeringTasks: tasks,
    latestAiRuns: [],
    questions,
    prds: prdRows,
    requirements,
    tasks
  };
}

export async function getFeatureAiRunUsage(
  ctx: ProtectedContext,
  featureRequestId: string
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  const featureRequest = await getScopedFeatureOrThrow(
    featureRequestId,
    workspace.activeOrganization.id
  );

  return db
    .select({
      id: aiRuns.id,
      agentType: aiRuns.agentType,
      model: aiRuns.model,
      status: aiRuns.status,
      tokenUsage: aiRuns.tokenUsage,
      createdAt: aiRuns.createdAt
    })
    .from(aiRuns)
    .where(
      and(
        eq(aiRuns.organizationId, workspace.activeOrganization.id),
        eq(aiRuns.featureRequestId, featureRequest.id)
      )
    )
    .orderBy(desc(aiRuns.createdAt))
    .limit(5);
}
