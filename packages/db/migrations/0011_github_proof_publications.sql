CREATE TABLE "github_proof_publications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "feature_request_id" uuid NOT NULL,
  "pull_request_id" uuid NOT NULL,
  "qa_review_id" uuid,
  "github_comment_id" bigint,
  "github_status_context" text,
  "last_published_commit_sha" text,
  "last_publish_status" text DEFAULT 'not_posted' NOT NULL,
  "last_publish_error" text,
  "coverage_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "published_by" uuid,
  "last_published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_proof_publications" ADD CONSTRAINT "github_proof_publications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_proof_publications" ADD CONSTRAINT "github_proof_publications_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_proof_publications" ADD CONSTRAINT "github_proof_publications_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_proof_publications" ADD CONSTRAINT "github_proof_publications_qa_review_id_qa_reviews_id_fk" FOREIGN KEY ("qa_review_id") REFERENCES "public"."qa_reviews"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_proof_publications" ADD CONSTRAINT "github_proof_publications_published_by_app_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "github_proof_publications_feature_pr_unique" ON "github_proof_publications" USING btree ("feature_request_id","pull_request_id");
--> statement-breakpoint
CREATE INDEX "github_proof_publications_organization_id_idx" ON "github_proof_publications" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "github_proof_publications_feature_request_id_idx" ON "github_proof_publications" USING btree ("feature_request_id");
--> statement-breakpoint
CREATE INDEX "github_proof_publications_pull_request_id_idx" ON "github_proof_publications" USING btree ("pull_request_id");
--> statement-breakpoint
CREATE INDEX "github_proof_publications_qa_review_id_idx" ON "github_proof_publications" USING btree ("qa_review_id");
--> statement-breakpoint
CREATE INDEX "github_proof_publications_last_publish_status_idx" ON "github_proof_publications" USING btree ("last_publish_status");
