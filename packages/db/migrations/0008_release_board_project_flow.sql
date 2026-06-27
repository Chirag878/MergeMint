ALTER TYPE "public"."project_status" ADD VALUE IF NOT EXISTS 'on_hold';--> statement-breakpoint
ALTER TYPE "public"."project_status" ADD VALUE IF NOT EXISTS 'completed';--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."release_board_stage" AS ENUM('pending', 'ongoing', 'completing', 'shipped');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "board_stage" "release_board_stage" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "board_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "shipped_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_requests_board_stage_idx" ON "feature_requests" USING btree ("board_stage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_requests_board_order_idx" ON "feature_requests" USING btree ("board_order");
