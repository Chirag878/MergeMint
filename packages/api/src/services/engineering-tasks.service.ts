import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  generateEngineeringTasks,
  getAIConfig,
  type AITokenUsage,
  type EngineeringTasksOutput
} from "@veriflow/ai";
import {
  aiRuns,
  db,
  engineeringTasks,
  featureRequests,
  prdRequirements,
  prds,
  projects,
  pullRequests,
  type JsonObject,
  type TokenUsage
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { getLatestRepositoryContextForProject } from "./repository-intelligence.service";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "skipped";
type TaskPriority = "must_have" | "should_have" | "nice_to_have";
type TaskRisk = "low" | "medium" | "high";
type TaskType =
  | "frontend"
  | "backend"
  | "api"
  | "database"
  | "auth"
  | "integration"
  | "test"
  | "docs"
  | "qa"
  | "devops"
  | "infrastructure"
  | "design"
  | "other";

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

  return "P1";
}

async function getScopedFeatureOrThrow(input: {
  organizationId: string;
  featureRequestId: string;
}) {
  const [feature] = await db
    .select()
    .from(featureRequests)
    .where(
      and(
        eq(featureRequests.id, input.featureRequestId),
        eq(featureRequests.organizationId, input.organizationId)
      )
    )
    .limit(1);

  if (!feature) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Feature request not found."
    });
  }

  return feature;
}

async function createAIRun(input: {
  organizationId: string;
  featureRequestId: string;
  payload: unknown;
}) {
  const [run] = await db
    .insert(aiRuns)
    .values({
      organizationId: input.organizationId,
      featureRequestId: input.featureRequestId,
      agentType: "task_generation",
      model: getAIConfig().OPENAI_MODEL ?? "gpt-4.1-mini",
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
      model: input.model,
      output: toJsonObject(input.output),
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

export async function listEngineeringTasksByFeature(
  ctx: ProtectedContext,
  input: { featureRequestId: string }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");
  const organizationId = workspace.activeOrganization.id;
  const feature = await getScopedFeatureOrThrow({
    organizationId,
    featureRequestId: input.featureRequestId
  });
  const [latestPrd] = await db
    .select()
    .from(prds)
    .where(eq(prds.featureRequestId, feature.id))
    .orderBy(desc(prds.version), desc(prds.createdAt))
    .limit(1);
  const [tasks, requirements, repositoryContext] = await Promise.all([
    db
      .select()
      .from(engineeringTasks)
      .where(eq(engineeringTasks.featureRequestId, feature.id))
      .orderBy(engineeringTasks.orderIndex, engineeringTasks.createdAt),
    latestPrd
      ? db
          .select()
          .from(prdRequirements)
          .where(eq(prdRequirements.prdId, latestPrd.id))
          .orderBy(prdRequirements.requirementKey)
      : Promise.resolve([] as Array<typeof prdRequirements.$inferSelect>),
    getLatestRepositoryContextForProject({
      organizationId,
      projectId: feature.projectId
    })
  ]);
  const grouped = groupTasks(tasks);

  return {
    feature,
    prd: latestPrd ?? null,
    requirements,
    tasks,
    grouped,
    summary: summarizeTasks(tasks),
    repoAware: Boolean(repositoryContext),
    repositoryContext
  };
}

export async function updateEngineeringTaskStatus(
  ctx: ProtectedContext,
  input: { taskId: string; status: TaskStatus }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "create_feature_request");

  const task = await getScopedTaskOrThrow({
    organizationId: workspace.activeOrganization.id,
    taskId: input.taskId
  });

  const [updated] = await db
    .update(engineeringTasks)
    .set({
      status: input.status,
      updatedAt: new Date()
    })
    .where(eq(engineeringTasks.id, task.id))
    .returning();

  return updated ?? task;
}

export async function updateEngineeringTask(
  ctx: ProtectedContext,
  input: {
    taskId: string;
    status?: TaskStatus;
    type?: TaskType;
    priority?: TaskPriority;
    riskLevel?: TaskRisk;
    suggestedFiles?: string[];
    suggestedModules?: string[];
    implementationNotes?: string | null;
    verificationNotes?: string | null;
    orderIndex?: number;
  }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "create_feature_request");
  const task = await getScopedTaskOrThrow({
    organizationId: workspace.activeOrganization.id,
    taskId: input.taskId
  });

  const [updated] = await db
    .update(engineeringTasks)
    .set({
      status: input.status,
      type: input.type,
      priority: input.priority,
      riskLevel: input.riskLevel,
      suggestedFiles: input.suggestedFiles,
      suggestedModules: input.suggestedModules,
      implementationNotes: input.implementationNotes,
      verificationNotes: input.verificationNotes,
      orderIndex: input.orderIndex,
      updatedAt: new Date()
    })
    .where(eq(engineeringTasks.id, task.id))
    .returning();

  return updated ?? task;
}

export async function regenerateEngineeringTasksForFeature(
  ctx: ProtectedContext,
  input: { featureRequestId: string }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "create_feature_request");
  const organizationId = workspace.activeOrganization.id;
  const feature = await getScopedFeatureOrThrow({
    organizationId,
    featureRequestId: input.featureRequestId
  });
  const [prd] = await db
    .select()
    .from(prds)
    .where(eq(prds.featureRequestId, feature.id))
    .orderBy(desc(prds.version), desc(prds.createdAt))
    .limit(1);

  if (!prd) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Generate a PRD before generating engineering tasks."
    });
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
    organizationId,
    projectId: feature.projectId
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
  const aiRun = await createAIRun({
    organizationId,
    featureRequestId: feature.id,
    payload
  });

  try {
    const aiResult = await generateEngineeringTasks(payload);
    await completeAIRun({
      runId: aiRun.id,
      output: aiResult.data,
      model: aiResult.model,
      tokenUsage: aiResult.tokenUsage
    });

    const created = await db.transaction(async (tx) => {
      await tx
        .delete(engineeringTasks)
        .where(eq(engineeringTasks.featureRequestId, feature.id));

      const rows = await tx
        .insert(engineeringTasks)
        .values(
          aiResult.data.tasks.map((task, index) => ({
            organizationId,
            projectId: feature.projectId,
            featureRequestId: feature.id,
            prdId: prd.id,
            title: task.title,
            description: task.description,
            type: mapTaskType(task.type),
            status: "todo" as const,
            priority: task.priority,
            riskLevel: task.riskLevel,
            relatedRequirementKeys: task.relatedRequirementKeys,
            acceptanceCriteriaRefs: task.relatedAcceptanceCriteria,
            acceptanceChecklist: task.acceptanceChecklist,
            suggestedFiles: task.suggestedFiles,
            suggestedModules: task.suggestedModules,
            implementationNotes: task.implementationNotes,
            verificationNotes: task.verificationNotes,
            complexity: mapTaskComplexity(task.complexity),
            orderIndex: index
          }))
        )
        .returning();

      await tx
        .update(featureRequests)
        .set({
          status: "tasks_ready",
          updatedAt: new Date()
        })
        .where(eq(featureRequests.id, feature.id));

      return rows;
    });

    return created;
  } catch (error) {
    await failAIRun(aiRun.id, error);
    throw error;
  }
}

export async function getDeveloperBriefForFeature(
  ctx: ProtectedContext,
  input: { featureRequestId: string }
) {
  const bundle = await listEngineeringTasksByFeature(ctx, input);
  return {
    markdown: buildDeveloperBrief(bundle)
  };
}

export async function getCopyPayloadForAgent(
  ctx: ProtectedContext,
  input: { featureRequestId: string }
) {
  const bundle = await listEngineeringTasksByFeature(ctx, input);

  return {
    payload: {
      feature: {
        title: bundle.feature.title,
        description: bundle.feature.description,
        businessGoal: bundle.feature.businessGoal,
        expectedBehavior: bundle.feature.expectedBehavior
      },
      prd: bundle.prd,
      requirements: bundle.requirements,
      tasks: bundle.tasks.map((task) => ({
        title: task.title,
        description: task.description,
        status: task.status,
        type: task.type,
        priority: task.priority,
        riskLevel: task.riskLevel,
        relatedRequirementKeys: task.relatedRequirementKeys,
        acceptanceCriteriaRefs: task.acceptanceCriteriaRefs,
        acceptanceChecklist: task.acceptanceChecklist,
        suggestedFiles: task.suggestedFiles,
        suggestedModules: task.suggestedModules,
        implementationNotes: task.implementationNotes,
        verificationNotes: task.verificationNotes
      })),
      repositoryContext: bundle.repositoryContext
    }
  };
}

export async function getProjectEngineeringTaskSummary(
  ctx: ProtectedContext,
  input: { projectId: string }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");
  const organizationId = workspace.activeOrganization.id;
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, input.projectId), eq(projects.organizationId, organizationId)))
    .limit(1);

  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
  }

  const [tasks, featureRows, pullRequestRows] = await Promise.all([
    db
      .select()
      .from(engineeringTasks)
      .where(eq(engineeringTasks.projectId, project.id)),
    db
      .select()
      .from(featureRequests)
      .where(eq(featureRequests.projectId, project.id)),
    db
      .select()
      .from(pullRequests)
      .where(eq(pullRequests.projectId, project.id))
  ]);
  const featureIdsWithPr = new Set(
    pullRequestRows.map((pullRequest) => pullRequest.featureRequestId)
  );
  const taskFeatureIds = new Set(tasks.map((task) => task.featureRequestId));

  return {
    activeTasks: tasks.filter(
      (task) => task.status === "todo" || task.status === "in_progress"
    ).length,
    blockedTasks: tasks.filter((task) => task.status === "blocked").length,
    highRiskTasks: tasks.filter((task) => task.riskLevel === "high").length,
    tasksReadyForPr: featureRows.filter(
      (feature) => taskFeatureIds.has(feature.id) && !featureIdsWithPr.has(feature.id)
    ).length
  };
}

async function getScopedTaskOrThrow(input: {
  organizationId: string;
  taskId: string;
}) {
  const [task] = await db
    .select()
    .from(engineeringTasks)
    .where(
      and(
        eq(engineeringTasks.id, input.taskId),
        eq(engineeringTasks.organizationId, input.organizationId)
      )
    )
    .limit(1);

  if (!task) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Engineering task not found."
    });
  }

  return task;
}

function summarizeTasks(tasks: Array<typeof engineeringTasks.$inferSelect>) {
  return {
    total: tasks.length,
    todo: tasks.filter((task) => task.status === "todo").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    done: tasks.filter((task) => task.status === "done").length,
    skipped: tasks.filter(
      (task) => task.status === "skipped" || task.status === "canceled"
    ).length,
    highRisk: tasks.filter((task) => task.riskLevel === "high").length
  };
}

function groupTasks(tasks: Array<typeof engineeringTasks.$inferSelect>) {
  return {
    todo: tasks.filter((task) => task.status === "todo"),
    in_progress: tasks.filter((task) => task.status === "in_progress"),
    blocked: tasks.filter((task) => task.status === "blocked"),
    done: tasks.filter((task) => task.status === "done"),
    skipped: tasks.filter(
      (task) => task.status === "skipped" || task.status === "canceled"
    )
  };
}

function buildDeveloperBrief(input: Awaited<ReturnType<typeof listEngineeringTasksByFeature>>) {
  const requirements = input.requirements
    .map(
      (requirement) =>
        `- ${requirement.requirementKey}: ${requirement.requirement}\n  Acceptance criteria:\n${requirement.acceptanceCriteria
          .map((criterion) => `  - ${criterion}`)
          .join("\n")}`
    )
    .join("\n");
  const tasksByType = Object.entries(
    input.tasks.reduce<Record<string, typeof input.tasks>>((acc, task) => {
      acc[task.type] ??= [];
      acc[task.type].push(task);
      return acc;
    }, {})
  )
    .map(
      ([type, tasks]) =>
        `### ${type}\n${tasks
          .map(
            (task) =>
              `- [${task.status}] ${task.title} (${task.priority}, ${task.riskLevel} risk)\n  Requirements: ${task.relatedRequirementKeys.join(", ") || "none"}\n  Suggested files: ${task.suggestedFiles.join(", ") || "none"}\n  Notes: ${task.implementationNotes ?? task.description ?? "No notes."}`
          )
          .join("\n")}`
    )
    .join("\n\n");

  return [
    `# Developer Brief: ${input.feature.title}`,
    "",
    `Business goal: ${input.feature.businessGoal ?? "Not specified."}`,
    "",
    `PRD: ${input.prd?.title ?? "No PRD generated."}`,
    input.prd?.problem ? `Summary: ${input.prd.problem}` : "",
    "",
    "## Requirements",
    requirements || "No requirements generated.",
    "",
    "## Engineering Tasks",
    tasksByType || "No engineering tasks generated.",
    "",
    "## Expected PR Checklist",
    "- Link the implementation PR to this feature.",
    "- Include tests or verification notes for each must-have task.",
    "- Make sure changed files cover suggested files/modules when applicable.",
    "- Refresh PR snapshot and run AI QA review before approval.",
    "",
    "## Repository Context",
    input.repositoryContext
      ? `${input.repositoryContext.repository} at ${input.repositoryContext.analyzedCommitSha ?? "unknown commit"}`
      : "No repository intelligence snapshot available."
  ]
    .filter(Boolean)
    .join("\n");
}
