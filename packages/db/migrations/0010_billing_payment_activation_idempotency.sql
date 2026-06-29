ALTER TABLE "pr_credit_events" ADD COLUMN "billing_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "pr_credit_events" ADD CONSTRAINT "pr_credit_events_billing_payment_id_billing_payments_id_fk" FOREIGN KEY ("billing_payment_id") REFERENCES "public"."billing_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pr_credit_events_billing_payment_id_unique" ON "pr_credit_events" USING btree ("billing_payment_id");
