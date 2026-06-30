import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TRPCContext } from "../context";
import { generateEngineeringTasksForPrd, generatePrdForFeatureRequest } from "./requirement-engine.service";
import { runQaReviewForFeatureRequest } from "./qa-review.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

export const asyncWorkflowKindSchema = z.enum([
  "prd_generation",
  "engineering_task_generation",
  "qa_review",
  "release_readiness_check"
]);

export type AsyncWorkflowKind = z.infer<typeof asyncWorkflowKindSchema>;
export type AsyncWorkflowStatus = "queued" | "running" | "completed" | "failed";

type WorkflowJob = {
  id: string;
  kind: AsyncWorkflowKind;
  status: AsyncWorkflowStatus;
  featureRequestId?: string;
  prdId?: string;
  result?: unknown;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
};

const workflowJobs = new Map<string, WorkflowJob>();

function serializeJob(job: WorkflowJob) {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

function updateJob(jobId: string, patch: Partial<WorkflowJob>) {
  const existing = workflowJobs.get(jobId);
  if (!existing) {
    return;
  }

  workflowJobs.set(jobId, {
    ...existing,
    ...patch,
    updatedAt: new Date()
  });
}

function startJob(jobId: string, run: () => Promise<unknown>) {
  queueMicrotask(() => {
    updateJob(jobId, { status: "running" });
    run()
      .then((result) => {
        updateJob(jobId, { status: "completed", result });
      })
      .catch((error: unknown) => {
        updateJob(jobId, {
          status: "failed",
          error: error instanceof Error ? error.message : String(error)
        });
      });
  });
}

export async function enqueueAsyncWorkflow(
  ctx: ProtectedContext,
  input: {
    kind: AsyncWorkflowKind;
    featureRequestId?: string;
    prdId?: string;
  }
) {
  const job: WorkflowJob = {
    id: randomUUID(),
    kind: input.kind,
    status: "queued",
    featureRequestId: input.featureRequestId,
    prdId: input.prdId,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  workflowJobs.set(job.id, job);

  if (input.kind === "prd_generation") {
    if (!input.featureRequestId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "featureRequestId is required." });
    }
    startJob(job.id, () => generatePrdForFeatureRequest(ctx, input.featureRequestId as string));
  } else if (input.kind === "engineering_task_generation") {
    if (!input.prdId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "prdId is required." });
    }
    startJob(job.id, () => generateEngineeringTasksForPrd(ctx, input.prdId as string));
  } else if (input.kind === "qa_review") {
    if (!input.featureRequestId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "featureRequestId is required." });
    }
    startJob(job.id, () =>
      runQaReviewForFeatureRequest(ctx, {
        featureRequestId: input.featureRequestId as string
      })
    );
  } else {
    startJob(job.id, async () => ({
      ready: true,
      note: "Release readiness check queued; existing control-room queries remain the source of truth."
    }));
  }

  return serializeJob(job);
}

export async function getAsyncWorkflowStatus(jobId: string) {
  const job = workflowJobs.get(jobId);
  if (!job) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Workflow job not found." });
  }
  return serializeJob(job);
}

export async function listFeatureAsyncWorkflows(featureRequestId: string) {
  return Array.from(workflowJobs.values())
    .filter((job) => job.featureRequestId === featureRequestId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map(serializeJob);
}
