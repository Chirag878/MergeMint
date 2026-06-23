import type { FEATURE_STATUSES, WORKFLOW_STEPS } from "./constants";

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export type ApiHealth = {
  status: "ok";
  service: string;
  timestamp: string;
};