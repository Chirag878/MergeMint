import type { subscriptions } from "@veriflow/db";

export type Plan = typeof subscriptions.$inferSelect.plan;

export type PlanEntitlements = {
  projects: number | null;
  featureWorkflows: number | null;
  prVerifications: number | null;
  aiReviews: number | null;
  releaseReports: number | null;
};

export const PLAN_ENTITLEMENTS: Record<Plan, PlanEntitlements> = {
  free: {
    projects: 1,
    featureWorkflows: 3,
    prVerifications: 5,
    aiReviews: 5,
    releaseReports: 3
  },
  founder_pilot: {
    projects: null,
    featureWorkflows: null,
    prVerifications: null,
    aiReviews: null,
    releaseReports: null
  },
  agency_pilot: {
    projects: null,
    featureWorkflows: null,
    prVerifications: null,
    aiReviews: null,
    releaseReports: null
  },
  pro: {
    projects: null,
    featureWorkflows: null,
    prVerifications: null,
    aiReviews: null,
    releaseReports: null
  },
  team: {
    projects: null,
    featureWorkflows: null,
    prVerifications: null,
    aiReviews: null,
    releaseReports: null
  },
  enterprise: {
    projects: null,
    featureWorkflows: null,
    prVerifications: null,
    aiReviews: null,
    releaseReports: null
  }
};

export function getPlanEntitlements(plan: Plan) {
  return PLAN_ENTITLEMENTS[plan];
}
