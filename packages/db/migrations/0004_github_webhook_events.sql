ALTER TABLE "github_webhook_events" ADD COLUMN IF NOT EXISTS "repository_owner" text;--> statement-breakpoint
ALTER TABLE "github_webhook_events" ADD COLUMN IF NOT EXISTS "repository_name" text;--> statement-breakpoint
ALTER TABLE "github_webhook_events" ADD COLUMN IF NOT EXISTS "pr_number" integer;--> statement-breakpoint
ALTER TABLE "github_webhook_events" ADD COLUMN IF NOT EXISTS "matched_feature_request_id" uuid;--> statement-breakpoint
ALTER TABLE "github_webhook_events" ADD COLUMN IF NOT EXISTS "action" text;--> statement-breakpoint
ALTER TABLE "github_webhook_events" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'received' NOT NULL;--> statement-breakpoint
ALTER TABLE "github_webhook_events" ADD COLUMN IF NOT EXISTS "error_message" text;--> statement-breakpoint
ALTER TABLE "github_webhook_events" ADD COLUMN IF NOT EXISTS "payload_summary" jsonb;--> statement-breakpoint
ALTER TABLE "github_webhook_events" ADD COLUMN IF NOT EXISTS "received_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "github_webhook_events" ALTER COLUMN "payload" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "github_webhook_events" ADD CONSTRAINT "github_webhook_events_matched_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("matched_feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_webhook_events_repository_pr_idx" ON "github_webhook_events" USING btree ("repository_owner","repository_name","pr_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_webhook_events_matched_feature_request_id_idx" ON "github_webhook_events" USING btree ("matched_feature_request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_webhook_events_status_idx" ON "github_webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_webhook_events_received_at_idx" ON "github_webhook_events" USING btree ("received_at");
