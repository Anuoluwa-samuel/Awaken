CREATE TYPE "public"."attribute" AS ENUM('strength', 'intelligence', 'discipline', 'vitality', 'creativity');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('fitness', 'learning', 'career', 'creativity', 'finance', 'organization', 'social', 'wellbeing');--> statement-breakpoint
CREATE TYPE "public"."challenge_status" AS ENUM('active', 'completed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."completion_method" AS ENUM('self_reported', 'focus_session', 'habit', 'integration');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'normal', 'hard', 'elite');--> statement-breakpoint
CREATE TYPE "public"."focus_status" AS ENUM('running', 'paused', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."quest_cadence" AS ENUM('daily', 'weekly', 'once');--> statement-breakpoint
CREATE TYPE "public"."quest_kind" AS ENUM('daily', 'weekly', 'custom');--> statement-breakpoint
CREATE TYPE "public"."quest_status" AS ENUM('available', 'in_progress', 'completed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rank" AS ENUM('E', 'D', 'C', 'B', 'A', 'S', 'N');--> statement-breakpoint
CREATE TYPE "public"."xp_event" AS ENUM('quest_completed', 'weekly_completed', 'achievement_unlocked', 'focus_completed', 'goal_completed', 'adjustment');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "achievement" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"title_reward" text
);
--> statement-breakpoint
CREATE TABLE "attribute_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"attribute" "attribute" NOT NULL,
	"amount" integer NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attribute_ledger_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focus_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"player_quest_id" text,
	"planned_seconds" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paused_at" timestamp with time zone,
	"total_paused_seconds" integer DEFAULT 0 NOT NULL,
	"ended_at" timestamp with time zone,
	"status" "focus_status" DEFAULT 'running' NOT NULL,
	"credited_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planned_seconds_range" CHECK ("focus_session"."planned_seconds" between 60 and 14400)
);
--> statement-breakpoint
CREATE TABLE "goal" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" "category" NOT NULL,
	"deadline" date,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_milestone" (
	"id" text PRIMARY KEY NOT NULL,
	"goal_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"position" smallint NOT NULL,
	"player_quest_id" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" "category" NOT NULL,
	"attribute" "attribute" NOT NULL,
	"schedule_days" smallint[] NOT NULL,
	"linked_template_id" text,
	"reminder_time" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_completion" (
	"id" text PRIMARY KEY NOT NULL,
	"habit_id" text NOT NULL,
	"user_id" text NOT NULL,
	"local_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "level_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"from_level" integer NOT NULL,
	"to_level" integer NOT NULL,
	"from_rank" "rank" NOT NULL,
	"to_rank" "rank" NOT NULL,
	"ledger_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "level_event_ledger_id_unique" UNIQUE("ledger_id")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text,
	"dedupe_key" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "player_achievement" (
	"user_id" text NOT NULL,
	"achievement_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_achievement_user_id_achievement_code_pk" PRIMARY KEY("user_id","achievement_code")
);
--> statement-breakpoint
CREATE TABLE "player_attribute" (
	"user_id" text NOT NULL,
	"attribute" "attribute" NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_attribute_user_id_attribute_pk" PRIMARY KEY("user_id","attribute")
);
--> statement-breakpoint
CREATE TABLE "player_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"day_start_hour" smallint DEFAULT 4 NOT NULL,
	"focus_areas" "category"[] DEFAULT '{}' NOT NULL,
	"preferred_difficulty" "difficulty" DEFAULT 'normal' NOT NULL,
	"daily_target" smallint,
	"avatar_url" text,
	"equipped_title" text,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_start_hour_range" CHECK ("player_profile"."day_start_hour" between 0 and 23),
	CONSTRAINT "daily_target_range" CHECK ("player_profile"."daily_target" is null or "player_profile"."daily_target" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "player_progress" (
	"user_id" text PRIMARY KEY NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"rank" "rank" DEFAULT 'E' NOT NULL,
	"skill_points_earned" integer DEFAULT 0 NOT NULL,
	"skill_points_spent" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "total_xp_non_negative" CHECK ("player_progress"."total_xp" >= 0),
	CONSTRAINT "skill_points_balance" CHECK ("player_progress"."skill_points_spent" <= "player_progress"."skill_points_earned")
);
--> statement-breakpoint
CREATE TABLE "player_quest" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text,
	"kind" "quest_kind" NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" "category" NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"attribute" "attribute" NOT NULL,
	"xp_reward" integer NOT NULL,
	"quest_date" date NOT NULL,
	"due_at" timestamp with time zone,
	"status" "quest_status" DEFAULT 'available' NOT NULL,
	"estimated_minutes" smallint,
	"checklist" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xp_reward_non_negative" CHECK ("player_quest"."xp_reward" >= 0)
);
--> statement-breakpoint
CREATE TABLE "player_quest_schedule" (
	"user_id" text NOT NULL,
	"template_id" text NOT NULL,
	"days" smallint[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_quest_schedule_user_id_template_id_pk" PRIMARY KEY("user_id","template_id")
);
--> statement-breakpoint
CREATE TABLE "player_skill" (
	"user_id" text NOT NULL,
	"skill_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_skill_user_id_skill_code_pk" PRIMARY KEY("user_id","skill_code")
);
--> statement-breakpoint
CREATE TABLE "player_title" (
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_title_user_id_title_pk" PRIMARY KEY("user_id","title")
);
--> statement-breakpoint
CREATE TABLE "quest_completion" (
	"id" text PRIMARY KEY NOT NULL,
	"player_quest_id" text NOT NULL,
	"user_id" text NOT NULL,
	"method" "completion_method" NOT NULL,
	"evidence_note" text,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quest_completion_player_quest_id_unique" UNIQUE("player_quest_id")
);
--> statement-breakpoint
CREATE TABLE "quest_template" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text,
	"owner_user_id" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" "category" NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"attribute" "attribute" NOT NULL,
	"xp_reward" integer,
	"estimated_minutes" smallint,
	"cadence" "quest_cadence" NOT NULL,
	"weekly_target" smallint,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quest_template_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "skill" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"required_level" integer DEFAULT 1 NOT NULL,
	"prerequisite_code" text,
	"cost" integer DEFAULT 1 NOT NULL,
	"effect" jsonb
);
--> statement-breakpoint
CREATE TABLE "weekly_challenge" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text,
	"title" text NOT NULL,
	"category" "category" NOT NULL,
	"target" smallint NOT NULL,
	"progress" smallint DEFAULT 0 NOT NULL,
	"week_start" date NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"xp_reward" integer NOT NULL,
	"status" "challenge_status" DEFAULT 'active' NOT NULL,
	"completed_at" timestamp with time zone,
	"reward_claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_target_positive" CHECK ("weekly_challenge"."target" > 0)
);
--> statement-breakpoint
CREATE TABLE "xp_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_type" "xp_event" NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xp_ledger_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "xp_amount_sign" CHECK ("xp_ledger"."amount" >= 0 or "xp_ledger"."event_type" = 'adjustment')
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_ledger" ADD CONSTRAINT "attribute_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_player_quest_id_player_quest_id_fk" FOREIGN KEY ("player_quest_id") REFERENCES "public"."player_quest"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_milestone" ADD CONSTRAINT "goal_milestone_goal_id_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_milestone" ADD CONSTRAINT "goal_milestone_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_milestone" ADD CONSTRAINT "goal_milestone_player_quest_id_player_quest_id_fk" FOREIGN KEY ("player_quest_id") REFERENCES "public"."player_quest"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit" ADD CONSTRAINT "habit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit" ADD CONSTRAINT "habit_linked_template_id_quest_template_id_fk" FOREIGN KEY ("linked_template_id") REFERENCES "public"."quest_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_completion" ADD CONSTRAINT "habit_completion_habit_id_habit_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_completion" ADD CONSTRAINT "habit_completion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_event" ADD CONSTRAINT "level_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_event" ADD CONSTRAINT "level_event_ledger_id_xp_ledger_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."xp_ledger"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_achievement" ADD CONSTRAINT "player_achievement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_achievement" ADD CONSTRAINT "player_achievement_achievement_code_achievement_code_fk" FOREIGN KEY ("achievement_code") REFERENCES "public"."achievement"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_attribute" ADD CONSTRAINT "player_attribute_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profile" ADD CONSTRAINT "player_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_progress" ADD CONSTRAINT "player_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_quest" ADD CONSTRAINT "player_quest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_quest" ADD CONSTRAINT "player_quest_template_id_quest_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."quest_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_quest_schedule" ADD CONSTRAINT "player_quest_schedule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_quest_schedule" ADD CONSTRAINT "player_quest_schedule_template_id_quest_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."quest_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_skill" ADD CONSTRAINT "player_skill_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_skill" ADD CONSTRAINT "player_skill_skill_code_skill_code_fk" FOREIGN KEY ("skill_code") REFERENCES "public"."skill"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_title" ADD CONSTRAINT "player_title_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_completion" ADD CONSTRAINT "quest_completion_player_quest_id_player_quest_id_fk" FOREIGN KEY ("player_quest_id") REFERENCES "public"."player_quest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_completion" ADD CONSTRAINT "quest_completion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_template" ADD CONSTRAINT "quest_template_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_challenge" ADD CONSTRAINT "weekly_challenge_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_challenge" ADD CONSTRAINT "weekly_challenge_template_id_quest_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."quest_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "attribute_ledger_user_created_idx" ON "attribute_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_event_actor_idx" ON "audit_event" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "focus_session_user_idx" ON "focus_session" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "goal_user_idx" ON "goal" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "goal_milestone_goal_idx" ON "goal_milestone" USING btree ("goal_id","position");--> statement-breakpoint
CREATE INDEX "habit_user_idx" ON "habit" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_completion_unique" ON "habit_completion" USING btree ("habit_id","local_date");--> statement-breakpoint
CREATE INDEX "habit_completion_user_idx" ON "habit_completion" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "level_event_user_idx" ON "level_event" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "player_quest_daily_unique" ON "player_quest" USING btree ("user_id","template_id","quest_date");--> statement-breakpoint
CREATE INDEX "player_quest_user_date_idx" ON "player_quest" USING btree ("user_id","quest_date");--> statement-breakpoint
CREATE INDEX "player_quest_user_status_idx" ON "player_quest" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "quest_completion_user_idx" ON "quest_completion" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX "quest_template_owner_idx" ON "quest_template" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_challenge_unique" ON "weekly_challenge" USING btree ("user_id","template_id","week_start");--> statement-breakpoint
CREATE INDEX "xp_ledger_user_created_idx" ON "xp_ledger" USING btree ("user_id","created_at");