CREATE TABLE IF NOT EXISTS "github_app_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"installation_id" bigint NOT NULL,
	"account_login" text NOT NULL,
	"account_id" bigint,
	"account_type" text,
	"repository_selection" text,
	"permissions" jsonb,
	"events" jsonb,
	"installed_by_user_id" uuid,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_github_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "github_app_installation_id" bigint;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "github_app_selected" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "github_app_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "github_webhook_events" ADD COLUMN IF NOT EXISTS "installation_id" bigint;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "github_app_installations" ADD CONSTRAINT "github_app_installations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "github_app_installations" ADD CONSTRAINT "github_app_installations_installed_by_user_id_app_users_id_fk" FOREIGN KEY ("installed_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_github_repositories" ADD CONSTRAINT "project_github_repositories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_github_repositories" ADD CONSTRAINT "project_github_repositories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_github_repositories" ADD CONSTRAINT "project_github_repositories_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "github_app_installations_installation_id_unique" ON "github_app_installations" USING btree ("installation_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "repositories" ADD CONSTRAINT "repositories_github_app_installation_id_github_app_installations_installation_id_fk" FOREIGN KEY ("github_app_installation_id") REFERENCES "public"."github_app_installations"("installation_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_app_installations_organization_id_idx" ON "github_app_installations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_app_installations_account_login_idx" ON "github_app_installations" USING btree ("account_login");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_app_installations_installed_by_user_id_idx" ON "github_app_installations" USING btree ("installed_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repositories_github_app_installation_id_idx" ON "repositories" USING btree ("github_app_installation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repositories_owner_name_idx" ON "repositories" USING btree ("owner","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_github_repositories_project_unique" ON "project_github_repositories" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_github_repositories_organization_id_idx" ON "project_github_repositories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_github_repositories_repository_id_idx" ON "project_github_repositories" USING btree ("repository_id");
