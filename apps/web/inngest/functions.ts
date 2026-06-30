import type { TRPCContext } from "@veriflow/api";
import {
  generateEngineeringTasksForPrd,
  generatePrdForFeatureRequest,
  runQaReviewForFeatureRequest
} from "@veriflow/api";
import { inngest, inngestEvents } from "./client";

type WorkflowEventUser = NonNullable<TRPCContext["user"]>;
type WorkflowEventSession = NonNullable<TRPCContext["session"]>;

type WorkflowEventContext = {
  user: WorkflowEventUser;
  session: WorkflowEventSession;
};

function contextFromEvent(data: WorkflowEventContext): TRPCContext & {
  user: WorkflowEventUser;
  session: WorkflowEventSession;
} {
  return {
    req: new Request("https://mergemint.local/inngest"),
    requestId: crypto.randomUUID(),
    user: data.user,
    session: data.session
  };
}

export const generatePrdFunction = inngest.createFunction(
  { id: "generate-prd", triggers: [{ event: inngestEvents.generatePrd }] },
  async ({ event, step }) => {
    const data = event.data as WorkflowEventContext & { featureRequestId: string };
    return step.run("Generate PRD using existing service", () =>
      generatePrdForFeatureRequest(contextFromEvent(data), data.featureRequestId)
    );
  }
);

export const generateEngineeringTasksFunction = inngest.createFunction(
  {
    id: "generate-engineering-tasks",
    triggers: [{ event: inngestEvents.generateEngineeringTasks }]
  },
  async ({ event, step }) => {
    const data = event.data as WorkflowEventContext & { prdId: string };
    return step.run("Generate engineering tasks using existing service", () =>
      generateEngineeringTasksForPrd(contextFromEvent(data), data.prdId)
    );
  }
);

export const runQaReviewFunction = inngest.createFunction(
  { id: "run-ai-qa-review", triggers: [{ event: inngestEvents.runQaReview }] },
  async ({ event, step }) => {
    const data = event.data as WorkflowEventContext & { featureRequestId: string };
    return step.run("Run AI QA Review using existing service", () =>
      runQaReviewForFeatureRequest(contextFromEvent(data), {
        featureRequestId: data.featureRequestId
      })
    );
  }
);

export const checkReleaseReadinessFunction = inngest.createFunction(
  {
    id: "check-release-readiness",
    triggers: [{ event: inngestEvents.checkReleaseReadiness }]
  },
  async ({ event, step }) => {
    const data = event.data as { featureRequestId: string };
    return step.run("Check release readiness", () => ({
      featureRequestId: data.featureRequestId,
      status: "completed",
      note: "Release readiness is computed by the existing Release Control Room and report services."
    }));
  }
);

export const inngestFunctions = [
  generatePrdFunction,
  generateEngineeringTasksFunction,
  runQaReviewFunction,
  checkReleaseReadinessFunction
];
