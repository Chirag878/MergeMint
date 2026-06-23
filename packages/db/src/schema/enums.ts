import { pgEnum } from "drizzle-orm/pg-core";

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "member",
  "viewer"
]);

export const planEnum = pgEnum("plan", [
  "free",
  "founder_pilot",
  "agency_pilot",
  "pro",
  "team",
  "enterprise"
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete"
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded"
]);

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "paused",
  "archived"
]);

export const featurePriorityEnum = pgEnum("feature_priority", [
  "low",
  "medium",
  "high",
  "urgent"
]);

export const featureStatusEnum = pgEnum("feature_status", [
  "draft",
  "clarifying",
  "prd_ready",
  "tasks_ready",
  "pr_linked",
  "qa_reviewed",
  "changes_requested",
  "approved",
  "released",
  "archived"
]);

export const prdStatusEnum = pgEnum("prd_status", [
  "draft",
  "generated",
  "in_review",
  "approved",
  "archived"
]);

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "blocked",
  "done",
  "canceled"
]);

export const taskTypeEnum = pgEnum("task_type", [
  "frontend",
  "backend",
  "api",
  "database",
  "integration",
  "test",
  "docs",
  "infrastructure",
  "design",
  "other"
]);

export const taskComplexityEnum = pgEnum("task_complexity", [
  "low",
  "medium",
  "high"
]);

export const githubPrStateEnum = pgEnum("github_pr_state", [
  "open",
  "closed",
  "merged"
]);

export const ciStatusEnum = pgEnum("ci_status", [
  "pending",
  "success",
  "failure",
  "skipped",
  "cancelled",
  "unknown"
]);

export const aiAgentTypeEnum = pgEnum("ai_agent_type", [
  "clarification",
  "prd_generation",
  "task_generation",
  "qa_review",
  "release_report"
]);

export const aiRunStatusEnum = pgEnum("ai_run_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled"
]);

export const qaReviewStatusEnum = pgEnum("qa_review_status", [
  "passed",
  "failed",
  "needs_changes",
  "needs_human_review"
]);

export const requirementCoverageStatusEnum = pgEnum(
  "requirement_coverage_status",
  ["covered", "partial", "missing", "not_applicable"]
);

export const findingSeverityEnum = pgEnum("finding_severity", [
  "low",
  "medium",
  "high",
  "critical"
]);

export const findingCategoryEnum = pgEnum("finding_category", [
  "requirement_gap",
  "bug_risk",
  "test_gap",
  "regression_risk",
  "security",
  "performance",
  "maintainability",
  "documentation"
]);

export const findingStatusEnum = pgEnum("finding_status", [
  "open",
  "fixed",
  "waived",
  "ignored",
  "needs_human_review"
]);

export const approvalDecisionEnum = pgEnum("approval_decision", [
  "approved",
  "rejected",
  "approved_with_risk",
  "changes_requested"
]);

export const releaseReportStatusEnum = pgEnum("release_report_status", [
  "draft",
  "generated",
  "published",
  "revoked"
]);
