CREATE TABLE "billing_admin_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_email" text NOT NULL,
	"plan_key" text NOT NULL,
	"credits_granted" integer NOT NULL,
	"validity_days" integer NOT NULL,
	"note" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"granted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"plan_key" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"razorpay_order_id" text NOT NULL,
	"razorpay_payment_id" text,
	"razorpay_signature" text,
	"safe_event_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_credit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"feature_request_id" uuid,
	"pull_request_id" uuid,
	"qa_review_id" uuid,
	"event_type" text NOT NULL,
	"credits_delta" integer NOT NULL,
	"reason" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_key" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'free' NOT NULL,
	"pr_limit" integer DEFAULT 1 NOT NULL,
	"pr_used" integer DEFAULT 0 NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"source" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_admin_grants" ADD CONSTRAINT "billing_admin_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_admin_grants" ADD CONSTRAINT "billing_admin_grants_granted_by_user_id_app_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_credit_events" ADD CONSTRAINT "pr_credit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_credit_events" ADD CONSTRAINT "pr_credit_events_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_credit_events" ADD CONSTRAINT "pr_credit_events_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_credit_events" ADD CONSTRAINT "pr_credit_events_qa_review_id_qa_reviews_id_fk" FOREIGN KEY ("qa_review_id") REFERENCES "public"."qa_reviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_credit_events" ADD CONSTRAINT "pr_credit_events_created_by_user_id_app_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_entitlements" ADD CONSTRAINT "workspace_entitlements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_admin_grants_organization_id_idx" ON "billing_admin_grants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_admin_grants_customer_email_idx" ON "billing_admin_grants" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "billing_admin_grants_plan_key_idx" ON "billing_admin_grants" USING btree ("plan_key");--> statement-breakpoint
CREATE INDEX "billing_admin_grants_source_idx" ON "billing_admin_grants" USING btree ("source");--> statement-breakpoint
CREATE INDEX "billing_admin_grants_created_at_idx" ON "billing_admin_grants" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_payments_razorpay_order_id_unique" ON "billing_payments" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_payments_razorpay_payment_id_unique" ON "billing_payments" USING btree ("razorpay_payment_id");--> statement-breakpoint
CREATE INDEX "billing_payments_organization_id_idx" ON "billing_payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_payments_user_id_idx" ON "billing_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_payments_plan_key_idx" ON "billing_payments" USING btree ("plan_key");--> statement-breakpoint
CREATE INDEX "billing_payments_status_idx" ON "billing_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_payments_created_at_idx" ON "billing_payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pr_credit_events_organization_id_idx" ON "pr_credit_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "pr_credit_events_feature_request_id_idx" ON "pr_credit_events" USING btree ("feature_request_id");--> statement-breakpoint
CREATE INDEX "pr_credit_events_pull_request_id_idx" ON "pr_credit_events" USING btree ("pull_request_id");--> statement-breakpoint
CREATE INDEX "pr_credit_events_qa_review_id_idx" ON "pr_credit_events" USING btree ("qa_review_id");--> statement-breakpoint
CREATE INDEX "pr_credit_events_event_type_idx" ON "pr_credit_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "pr_credit_events_created_at_idx" ON "pr_credit_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_entitlements_organization_id_unique" ON "workspace_entitlements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workspace_entitlements_plan_key_idx" ON "workspace_entitlements" USING btree ("plan_key");--> statement-breakpoint
CREATE INDEX "workspace_entitlements_status_idx" ON "workspace_entitlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workspace_entitlements_source_idx" ON "workspace_entitlements" USING btree ("source");--> statement-breakpoint
CREATE INDEX "workspace_entitlements_period_end_idx" ON "workspace_entitlements" USING btree ("current_period_end");--> statement-breakpoint
CREATE INDEX "workspace_entitlements_created_at_idx" ON "workspace_entitlements" USING btree ("created_at");
