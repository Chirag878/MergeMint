CREATE TABLE IF NOT EXISTS "verification_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "severity" text NOT NULL,
  "applies_to" text DEFAULT 'all' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "verification_rules"
  ADD CONSTRAINT "verification_rules_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "verification_rules"
  ADD CONSTRAINT "verification_rules_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "verification_rules"
  ADD CONSTRAINT "verification_rules_created_by_app_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "app_users"("id")
  ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "verification_rules_organization_id_idx"
  ON "verification_rules" USING btree ("organization_id");

CREATE INDEX IF NOT EXISTS "verification_rules_project_id_idx"
  ON "verification_rules" USING btree ("project_id");

CREATE INDEX IF NOT EXISTS "verification_rules_enabled_idx"
  ON "verification_rules" USING btree ("enabled");

CREATE INDEX IF NOT EXISTS "verification_rules_created_at_idx"
  ON "verification_rules" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "verification_rules_project_enabled_idx"
  ON "verification_rules" USING btree ("project_id", "enabled");

ALTER TABLE "qa_reviews"
  ADD COLUMN IF NOT EXISTS "verification_rule_results" jsonb DEFAULT '[]'::jsonb NOT NULL;

