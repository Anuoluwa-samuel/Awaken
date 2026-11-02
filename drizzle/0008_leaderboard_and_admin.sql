ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'player' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profile" ADD COLUMN "show_on_leaderboard" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "player_progress_total_xp_idx" ON "player_progress" USING btree ("total_xp");--> statement-breakpoint
-- Under-18s stay off the public leaderboard unless they opt in.
UPDATE "player_profile" SET "show_on_leaderboard" = false FROM "user" WHERE "user"."id" = "player_profile"."user_id" AND "user"."age_group" = 'teen';
