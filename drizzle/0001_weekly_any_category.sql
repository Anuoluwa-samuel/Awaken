ALTER TABLE "weekly_challenge" ADD COLUMN "counts_any_category" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "weekly_challenge_user_week_idx" ON "weekly_challenge" USING btree ("user_id","week_start");--> statement-breakpoint
ALTER TABLE "weekly_challenge" ADD CONSTRAINT "weekly_progress_range" CHECK ("weekly_challenge"."progress" between 0 and "weekly_challenge"."target");