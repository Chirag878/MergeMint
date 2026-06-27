ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'skipped';
--> statement-breakpoint
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'auth';
--> statement-breakpoint
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'qa';
--> statement-breakpoint
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'devops';
--> statement-breakpoint
ALTER TABLE "engineering_tasks" ADD COLUMN IF NOT EXISTS "priority" text DEFAULT 'must_have' NOT NULL;
--> statement-breakpoint
ALTER TABLE "engineering_tasks" ADD COLUMN IF NOT EXISTS "risk_level" text DEFAULT 'medium' NOT NULL;
--> statement-breakpoint
ALTER TABLE "engineering_tasks" ADD COLUMN IF NOT EXISTS "acceptance_criteria_refs" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "engineering_tasks" ADD COLUMN IF NOT EXISTS "suggested_files" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "engineering_tasks" ADD COLUMN IF NOT EXISTS "suggested_modules" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "engineering_tasks" ADD COLUMN IF NOT EXISTS "implementation_notes" text;
--> statement-breakpoint
ALTER TABLE "engineering_tasks" ADD COLUMN IF NOT EXISTS "verification_notes" text;
--> statement-breakpoint
ALTER TABLE "engineering_tasks" ADD COLUMN IF NOT EXISTS "order_index" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "qa_reviews" ADD COLUMN IF NOT EXISTS "task_coverage" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engineering_tasks_priority_idx" ON "engineering_tasks" USING btree ("priority");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engineering_tasks_risk_level_idx" ON "engineering_tasks" USING btree ("risk_level");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engineering_tasks_order_index_idx" ON "engineering_tasks" USING btree ("order_index");
