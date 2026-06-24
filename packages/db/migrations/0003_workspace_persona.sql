ALTER TYPE "member_role" ADD VALUE IF NOT EXISTS 'reviewer';--> statement-breakpoint
ALTER TYPE "member_role" ADD VALUE IF NOT EXISTS 'developer';--> statement-breakpoint
ALTER TYPE "member_role" ADD VALUE IF NOT EXISTS 'client_viewer';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "workspace_use_case" text;
