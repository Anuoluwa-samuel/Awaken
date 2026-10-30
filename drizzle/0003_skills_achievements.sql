-- Existing seeded skills predate typed effects; placeholder until `pnpm db:seed` writes the real ones.
UPDATE "skill" SET "effect" = '{"type":"habit_insights"}'::jsonb WHERE "effect" IS NULL;--> statement-breakpoint
ALTER TABLE "skill" ALTER COLUMN "effect" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quest_template" ADD COLUMN "required_skill" text;--> statement-breakpoint
ALTER TABLE "skill" ADD COLUMN "available" boolean DEFAULT true NOT NULL;