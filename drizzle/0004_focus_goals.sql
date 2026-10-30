ALTER TABLE "focus_session" ADD COLUMN "start_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "goal" ADD COLUMN "start_date" date NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "focus_session_one_active" ON "focus_session" USING btree ("user_id") WHERE "focus_session"."status" in ('running', 'paused');--> statement-breakpoint
CREATE UNIQUE INDEX "goal_milestone_quest_unique" ON "goal_milestone" USING btree ("player_quest_id") WHERE "goal_milestone"."player_quest_id" is not null;--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "credited_within_planned" CHECK ("focus_session"."credited_seconds" between 0 and "focus_session"."planned_seconds");