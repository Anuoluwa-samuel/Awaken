ALTER TYPE "public"."xp_event" ADD VALUE 'habit_completed' BEFORE 'weekly_completed';--> statement-breakpoint
ALTER TABLE "habit" ADD COLUMN "times_per_week" smallint;--> statement-breakpoint
ALTER TABLE "habit" ADD COLUMN "start_date" date NOT NULL;--> statement-breakpoint
CREATE INDEX "habit_linked_template_idx" ON "habit" USING btree ("user_id","linked_template_id");--> statement-breakpoint
ALTER TABLE "habit" ADD CONSTRAINT "habit_has_schedule" CHECK (cardinality("habit"."schedule_days") > 0);--> statement-breakpoint
ALTER TABLE "habit" ADD CONSTRAINT "habit_times_per_week_range" CHECK ("habit"."times_per_week" is null or "habit"."times_per_week" between 1 and 7);