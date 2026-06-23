CREATE TYPE "public"."ai_agent_type" AS ENUM('clarification', 'prd_generation', 'task_generation', 'qa_review', 'release_report');--> statement-breakpoint
CREATE TYPE "public"."ai_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."approval_decision" AS ENUM('approved', 'rejected', 'approved_with_risk', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."ci_status" AS ENUM('pending', 'success', 'failure', 'skipped', 'cancelled', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."feature_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."feature_status" AS ENUM('draft', 'clarifying', 'prd_ready', 'tasks_ready', 'pr_linked', 'qa_reviewed', 'changes_requested', 'approved', 'released', 'archived');--> statement-breakpoint
CREATE TYPE "public"."finding_category" AS ENUM('requirement_gap', 'bug_risk', 'test_gap', 'regression_risk', 'security', 'performance', 'maintainability', 'documentation');--> statement-breakpoint
CREATE TYPE "public"."finding_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('open', 'fixed', 'waived', 'ignored', 'needs_human_review');--> statement-breakpoint
CREATE TYPE "public"."github_pr_state" AS ENUM('open', 'closed', 'merged');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'authorized', 'captured', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'founder_pilot', 'agency_pilot', 'pro', 'team', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."prd_status" AS ENUM('draft', 'generated', 'in_review', 'approved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."qa_review_status" AS ENUM('passed', 'failed', 'needs_changes', 'needs_human_review');--> statement-breakpoint
CREATE TYPE "public"."release_report_status" AS ENUM('draft', 'generated', 'published', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."requirement_coverage_status" AS ENUM('covered', 'partial', 'missing', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."task_complexity" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'blocked', 'done', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('frontend', 'backend', 'api', 'database', 'integration', 'test', 'docs', 'infrastructure', 'design', 'other');--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"better_auth_user_id" text,
	"email" text NOT NULL,
	"name" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"client_name" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clarification_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"question" text NOT NULL,
	"reason" text,
	"priority" "feature_priority" DEFAULT 'medium' NOT NULL,
	"answer" text,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"business_goal" text,
	"expected_behavior" text,
	"acceptance_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"priority" "feature_priority" DEFAULT 'medium' NOT NULL,
	"status" "feature_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prd_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prd_id" uuid NOT NULL,
	"requirement_key" text NOT NULL,
	"requirement" text NOT NULL,
	"priority" text DEFAULT 'P1' NOT NULL,
	"acceptance_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"title" text NOT NULL,
	"problem" text,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"non_goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"user_stories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edge_cases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "prd_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "engineering_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"prd_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "task_type" DEFAULT 'other' NOT NULL,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"related_requirement_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"acceptance_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"complexity" "task_complexity" DEFAULT 'medium' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"installation_id" text,
	"github_account_login" text NOT NULL,
	"github_account_id" text NOT NULL,
	"encrypted_access_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"event_type" text NOT NULL,
	"delivery_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pull_request_id" uuid NOT NULL,
	"commit_sha" text NOT NULL,
	"diff_text" text,
	"changed_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"commits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ci_status" "ci_status" DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pull_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"github_pr_number" integer NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"branch" text NOT NULL,
	"base_branch" text NOT NULL,
	"state" "github_pr_state" DEFAULT 'open' NOT NULL,
	"merge_status" text,
	"latest_commit_sha" text,
	"html_url" text NOT NULL,
	"opened_at" timestamp with time zone,
	"merged_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"github_repo_id" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"private" boolean DEFAULT false NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"feature_request_id" uuid,
	"pull_request_id" uuid,
	"agent_type" "ai_agent_type" NOT NULL,
	"model" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"token_usage" jsonb,
	"status" "ai_run_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qa_review_id" uuid NOT NULL,
	"pull_request_id" uuid NOT NULL,
	"requirement_key" text,
	"severity" "finding_severity" NOT NULL,
	"category" "finding_category" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"file" text,
	"line" integer,
	"suggested_fix" text,
	"status" "finding_status" DEFAULT 'open' NOT NULL,
	"waived_reason" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_requirement_coverage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qa_review_id" uuid NOT NULL,
	"requirement_key" text NOT NULL,
	"status" "requirement_coverage_status" NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"concern" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"pull_request_id" uuid NOT NULL,
	"prd_id" uuid NOT NULL,
	"ai_run_id" uuid,
	"review_version" integer DEFAULT 1 NOT NULL,
	"overall_status" "qa_review_status" NOT NULL,
	"confidence_score" integer,
	"readiness_score" integer,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"pull_request_id" uuid NOT NULL,
	"approved_by" uuid,
	"decision" "approval_decision" NOT NULL,
	"note" text,
	"remaining_risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"pull_request_id" uuid NOT NULL,
	"approval_id" uuid,
	"title" text NOT NULL,
	"status" "release_report_status" DEFAULT 'draft' NOT NULL,
	"share_token" text NOT NULL,
	"report_data" jsonb NOT NULL,
	"readiness_score" integer,
	"generated_by" uuid,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "payment_status" NOT NULL,
	"plan" "plan" NOT NULL,
	"razorpay_payment_id" text NOT NULL,
	"razorpay_order_id" text NOT NULL,
	"razorpay_signature" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"razorpay_customer_id" text NOT NULL,
	"razorpay_subscription_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"feature_workflows_used" integer DEFAULT 0 NOT NULL,
	"pr_verifications_used" integer DEFAULT 0 NOT NULL,
	"ai_reviews_used" integer DEFAULT 0 NOT NULL,
	"release_reports_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_app_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clarification_questions" ADD CONSTRAINT "clarification_questions_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prd_requirements" ADD CONSTRAINT "prd_requirements_prd_id_prds_id_fk" FOREIGN KEY ("prd_id") REFERENCES "public"."prds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prds" ADD CONSTRAINT "prds_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_tasks" ADD CONSTRAINT "engineering_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_tasks" ADD CONSTRAINT "engineering_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_tasks" ADD CONSTRAINT "engineering_tasks_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_tasks" ADD CONSTRAINT "engineering_tasks_prd_id_prds_id_fk" FOREIGN KEY ("prd_id") REFERENCES "public"."prds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_webhook_events" ADD CONSTRAINT "github_webhook_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_snapshots" ADD CONSTRAINT "pr_snapshots_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_findings" ADD CONSTRAINT "qa_findings_qa_review_id_qa_reviews_id_fk" FOREIGN KEY ("qa_review_id") REFERENCES "public"."qa_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_findings" ADD CONSTRAINT "qa_findings_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_requirement_coverage" ADD CONSTRAINT "qa_requirement_coverage_qa_review_id_qa_reviews_id_fk" FOREIGN KEY ("qa_review_id") REFERENCES "public"."qa_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_reviews" ADD CONSTRAINT "qa_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_reviews" ADD CONSTRAINT "qa_reviews_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_reviews" ADD CONSTRAINT "qa_reviews_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_reviews" ADD CONSTRAINT "qa_reviews_prd_id_prds_id_fk" FOREIGN KEY ("prd_id") REFERENCES "public"."prds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_reviews" ADD CONSTRAINT "qa_reviews_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approved_by_app_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_reports" ADD CONSTRAINT "release_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_reports" ADD CONSTRAINT "release_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_reports" ADD CONSTRAINT "release_reports_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_reports" ADD CONSTRAINT "release_reports_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_reports" ADD CONSTRAINT "release_reports_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_reports" ADD CONSTRAINT "release_reports_generated_by_app_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_app_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_better_auth_user_id_unique" ON "app_users" USING btree ("better_auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_email_unique" ON "app_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "app_users_created_at_idx" ON "app_users" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_invitations_token_unique" ON "organization_invitations" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_invitations_org_email_unique" ON "organization_invitations" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX "organization_invitations_organization_id_idx" ON "organization_invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "organization_invitations_status_idx" ON "organization_invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "organization_invitations_created_at_idx" ON "organization_invitations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_unique" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_members_role_idx" ON "organization_members" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_created_at_idx" ON "organizations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "projects_organization_id_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_created_at_idx" ON "projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "clarification_questions_feature_request_id_idx" ON "clarification_questions" USING btree ("feature_request_id");--> statement-breakpoint
CREATE INDEX "clarification_questions_priority_idx" ON "clarification_questions" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "clarification_questions_created_at_idx" ON "clarification_questions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feature_requests_organization_id_idx" ON "feature_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "feature_requests_project_id_idx" ON "feature_requests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "feature_requests_created_by_idx" ON "feature_requests" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "feature_requests_status_idx" ON "feature_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feature_requests_priority_idx" ON "feature_requests" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "feature_requests_created_at_idx" ON "feature_requests" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "prd_requirements_prd_requirement_key_unique" ON "prd_requirements" USING btree ("prd_id","requirement_key");--> statement-breakpoint
CREATE INDEX "prd_requirements_prd_id_idx" ON "prd_requirements" USING btree ("prd_id");--> statement-breakpoint
CREATE INDEX "prd_requirements_priority_idx" ON "prd_requirements" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "prd_requirements_created_at_idx" ON "prd_requirements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "prds_feature_request_id_idx" ON "prds" USING btree ("feature_request_id");--> statement-breakpoint
CREATE INDEX "prds_status_idx" ON "prds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prds_created_at_idx" ON "prds" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "engineering_tasks_organization_id_idx" ON "engineering_tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "engineering_tasks_project_id_idx" ON "engineering_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "engineering_tasks_feature_request_id_idx" ON "engineering_tasks" USING btree ("feature_request_id");--> statement-breakpoint
CREATE INDEX "engineering_tasks_prd_id_idx" ON "engineering_tasks" USING btree ("prd_id");--> statement-breakpoint
CREATE INDEX "engineering_tasks_status_idx" ON "engineering_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "engineering_tasks_type_idx" ON "engineering_tasks" USING btree ("type");--> statement-breakpoint
CREATE INDEX "engineering_tasks_created_at_idx" ON "engineering_tasks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "github_connections_organization_id_idx" ON "github_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "github_connections_github_account_id_idx" ON "github_connections" USING btree ("github_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "github_connections_org_installation_unique" ON "github_connections" USING btree ("organization_id","installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "github_webhook_events_delivery_id_unique" ON "github_webhook_events" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "github_webhook_events_organization_id_idx" ON "github_webhook_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "github_webhook_events_event_type_idx" ON "github_webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "github_webhook_events_processed_at_idx" ON "github_webhook_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "github_webhook_events_created_at_idx" ON "github_webhook_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pr_snapshots_pull_request_commit_unique" ON "pr_snapshots" USING btree ("pull_request_id","commit_sha");--> statement-breakpoint
CREATE INDEX "pr_snapshots_pull_request_id_idx" ON "pr_snapshots" USING btree ("pull_request_id");--> statement-breakpoint
CREATE INDEX "pr_snapshots_commit_sha_idx" ON "pr_snapshots" USING btree ("commit_sha");--> statement-breakpoint
CREATE INDEX "pr_snapshots_ci_status_idx" ON "pr_snapshots" USING btree ("ci_status");--> statement-breakpoint
CREATE INDEX "pr_snapshots_created_at_idx" ON "pr_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pull_requests_repository_pr_number_unique" ON "pull_requests" USING btree ("repository_id","github_pr_number");--> statement-breakpoint
CREATE INDEX "pull_requests_organization_id_idx" ON "pull_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "pull_requests_project_id_idx" ON "pull_requests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pull_requests_feature_request_id_idx" ON "pull_requests" USING btree ("feature_request_id");--> statement-breakpoint
CREATE INDEX "pull_requests_repository_id_idx" ON "pull_requests" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "pull_requests_state_idx" ON "pull_requests" USING btree ("state");--> statement-breakpoint
CREATE INDEX "pull_requests_created_at_idx" ON "pull_requests" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_org_github_repo_id_unique" ON "repositories" USING btree ("organization_id","github_repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_org_full_name_unique" ON "repositories" USING btree ("organization_id","full_name");--> statement-breakpoint
CREATE INDEX "repositories_organization_id_idx" ON "repositories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "repositories_github_repo_id_idx" ON "repositories" USING btree ("github_repo_id");--> statement-breakpoint
CREATE INDEX "repositories_full_name_idx" ON "repositories" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "repositories_connected_at_idx" ON "repositories" USING btree ("connected_at");--> statement-breakpoint
CREATE INDEX "ai_runs_organization_id_idx" ON "ai_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_runs_feature_request_id_idx" ON "ai_runs" USING btree ("feature_request_id");--> statement-breakpoint
CREATE INDEX "ai_runs_pull_request_id_idx" ON "ai_runs" USING btree ("pull_request_id");--> statement-breakpoint
CREATE INDEX "ai_runs_agent_type_idx" ON "ai_runs" USING btree ("agent_type");--> statement-breakpoint
CREATE INDEX "ai_runs_status_idx" ON "ai_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_runs_created_at_idx" ON "ai_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "qa_findings_qa_review_id_idx" ON "qa_findings" USING btree ("qa_review_id");--> statement-breakpoint
CREATE INDEX "qa_findings_pull_request_id_idx" ON "qa_findings" USING btree ("pull_request_id");--> statement-breakpoint
CREATE INDEX "qa_findings_requirement_key_idx" ON "qa_findings" USING btree ("requirement_key");--> statement-breakpoint
CREATE INDEX "qa_findings_severity_idx" ON "qa_findings" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "qa_findings_category_idx" ON "qa_findings" USING btree ("category");--> statement-breakpoint
CREATE INDEX "qa_findings_status_idx" ON "qa_findings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "qa_findings_created_at_idx" ON "qa_findings" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "qa_requirement_coverage_review_requirement_unique" ON "qa_requirement_coverage" USING btree ("qa_review_id","requirement_key");--> statement-breakpoint
CREATE INDEX "qa_requirement_coverage_qa_review_id_idx" ON "qa_requirement_coverage" USING btree ("qa_review_id");--> statement-breakpoint
CREATE INDEX "qa_requirement_coverage_requirement_key_idx" ON "qa_requirement_coverage" USING btree ("requirement_key");--> statement-breakpoint
CREATE INDEX "qa_requirement_coverage_status_idx" ON "qa_requirement_coverage" USING btree ("status");--> statement-breakpoint
CREATE INDEX "qa_requirement_coverage_created_at_idx" ON "qa_requirement_coverage" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "qa_reviews_pull_request_review_version_unique" ON "qa_reviews" USING btree ("pull_request_id","review_version");--> statement-breakpoint
CREATE INDEX "qa_reviews_organization_id_idx" ON "qa_reviews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "qa_reviews_feature_request_id_idx" ON "qa_reviews" USING btree ("feature_request_id");--> statement-breakpoint
CREATE INDEX "qa_reviews_pull_request_id_idx" ON "qa_reviews" USING btree ("pull_request_id");--> statement-breakpoint
CREATE INDEX "qa_reviews_prd_id_idx" ON "qa_reviews" USING btree ("prd_id");--> statement-breakpoint
CREATE INDEX "qa_reviews_ai_run_id_idx" ON "qa_reviews" USING btree ("ai_run_id");--> statement-breakpoint
CREATE INDEX "qa_reviews_overall_status_idx" ON "qa_reviews" USING btree ("overall_status");--> statement-breakpoint
CREATE INDEX "qa_reviews_created_at_idx" ON "qa_reviews" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "approvals_organization_id_idx" ON "approvals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "approvals_feature_request_id_idx" ON "approvals" USING btree ("feature_request_id");--> statement-breakpoint
CREATE INDEX "approvals_pull_request_id_idx" ON "approvals" USING btree ("pull_request_id");--> statement-breakpoint
CREATE INDEX "approvals_approved_by_idx" ON "approvals" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "approvals_decision_idx" ON "approvals" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "approvals_created_at_idx" ON "approvals" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "release_reports_share_token_unique" ON "release_reports" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "release_reports_organization_id_idx" ON "release_reports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "release_reports_project_id_idx" ON "release_reports" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "release_reports_feature_request_id_idx" ON "release_reports" USING btree ("feature_request_id");--> statement-breakpoint
CREATE INDEX "release_reports_pull_request_id_idx" ON "release_reports" USING btree ("pull_request_id");--> statement-breakpoint
CREATE INDEX "release_reports_approval_id_idx" ON "release_reports" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "release_reports_status_idx" ON "release_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "release_reports_generated_by_idx" ON "release_reports" USING btree ("generated_by");--> statement-breakpoint
CREATE INDEX "release_reports_created_at_idx" ON "release_reports" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_razorpay_payment_id_unique" ON "payments" USING btree ("razorpay_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_razorpay_order_id_unique" ON "payments" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "payments_organization_id_idx" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_plan_idx" ON "payments" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "payments_created_at_idx" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_organization_id_unique" ON "subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_razorpay_subscription_id_unique" ON "subscriptions" USING btree ("razorpay_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_current_period_end_idx" ON "subscriptions" USING btree ("current_period_end");--> statement-breakpoint
CREATE INDEX "subscriptions_created_at_idx" ON "subscriptions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_counters_organization_period_unique" ON "usage_counters" USING btree ("organization_id","period_key");--> statement-breakpoint
CREATE INDEX "usage_counters_organization_id_idx" ON "usage_counters" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "usage_counters_period_key_idx" ON "usage_counters" USING btree ("period_key");--> statement-breakpoint
CREATE INDEX "usage_counters_created_at_idx" ON "usage_counters" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");