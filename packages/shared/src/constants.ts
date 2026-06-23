export const APP_NAME = "Veriflow";

export const WORKFLOW_STEPS = [
  "feature_request",
  "requirement_clarification",
  "prd",
  "engineering_tasks",
  "github_pr",
  "ai_qa_review",
  "fix_loop",
  "human_approval",
  "release_report"
] as const;

export const FEATURE_STATUSES = [
  "draft",
  "clarifying",
  "prd_ready",
  "tasks_ready",
  "pr_linked",
  "qa_reviewed",
  "changes_requested",
  "approved",
  "released"
] as const;