CREATE TABLE IF NOT EXISTS "repository_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"repository_id" uuid,
	"github_repository_id" bigint,
	"installation_id" bigint,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"default_branch" text,
	"analyzed_commit_sha" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"tech_stack" jsonb,
	"app_structure" jsonb,
	"important_files" jsonb,
	"routes" jsonb,
	"api_endpoints" jsonb,
	"database_models" jsonb,
	"auth_summary" text,
	"testing_summary" text,
	"deployment_summary" text,
	"risk_areas" jsonb,
	"suggested_feature_areas" jsonb,
	"summary" text,
	"raw_file_index" jsonb,
	"analysis_data" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "repository_analyses" ADD CONSTRAINT "repository_analyses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "repository_analyses" ADD CONSTRAINT "repository_analyses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "repository_analyses" ADD CONSTRAINT "repository_analyses_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repository_analyses_organization_id_idx" ON "repository_analyses" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repository_analyses_project_id_idx" ON "repository_analyses" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repository_analyses_repository_id_idx" ON "repository_analyses" USING btree ("repository_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repository_analyses_github_repository_id_idx" ON "repository_analyses" USING btree ("github_repository_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repository_analyses_installation_id_idx" ON "repository_analyses" USING btree ("installation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repository_analyses_full_name_idx" ON "repository_analyses" USING btree ("full_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repository_analyses_created_at_idx" ON "repository_analyses" USING btree ("created_at");
