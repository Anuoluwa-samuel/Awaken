CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'confirmed', 'declined');--> statement-breakpoint
ALTER TYPE "public"."xp_event" ADD VALUE 'bonus' BEFORE 'adjustment';--> statement-breakpoint
CREATE TABLE "cheer" (
	"id" text PRIMARY KEY NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"level_event_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendship" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"addressee_id" text NOT NULL,
	"status" "friendship_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "friendship_not_self" CHECK ("friendship"."requester_id" <> "friendship"."addressee_id")
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "quest_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"player_quest_id" text NOT NULL,
	"requester_id" text NOT NULL,
	"verifier_id" text NOT NULL,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "quest_verification_player_quest_id_unique" UNIQUE("player_quest_id"),
	CONSTRAINT "quest_verification_not_self" CHECK ("quest_verification"."requester_id" <> "quest_verification"."verifier_id")
);
--> statement-breakpoint
ALTER TABLE "achievement" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "player_profile" ADD COLUMN "friend_code" text;--> statement-breakpoint
-- Existing players get a random code. The subquery refers to the row, so each row gets its own.
UPDATE "player_profile" SET "friend_code" = (
	SELECT string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', (floor(random() * 31) + 1)::int, 1), '')
	FROM generate_series(1, 8) WHERE "player_profile"."user_id" IS NOT NULL
);--> statement-breakpoint
ALTER TABLE "player_profile" ALTER COLUMN "friend_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "player_quest" ADD COLUMN "is_event" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_challenge" ADD COLUMN "is_boss" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cheer" ADD CONSTRAINT "cheer_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheer" ADD CONSTRAINT "cheer_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheer" ADD CONSTRAINT "cheer_level_event_id_level_event_id_fk" FOREIGN KEY ("level_event_id") REFERENCES "public"."level_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_addressee_id_user_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_verification" ADD CONSTRAINT "quest_verification_player_quest_id_player_quest_id_fk" FOREIGN KEY ("player_quest_id") REFERENCES "public"."player_quest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_verification" ADD CONSTRAINT "quest_verification_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_verification" ADD CONSTRAINT "quest_verification_verifier_id_user_id_fk" FOREIGN KEY ("verifier_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cheer_once_per_level" ON "cheer" USING btree ("from_user_id","level_event_id");--> statement-breakpoint
CREATE INDEX "cheer_to_idx" ON "cheer" USING btree ("to_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "friendship_pair_unique" ON "friendship" USING btree (least("requester_id", "addressee_id"),greatest("requester_id", "addressee_id"));--> statement-breakpoint
CREATE INDEX "friendship_addressee_idx" ON "friendship" USING btree ("addressee_id","status");--> statement-breakpoint
CREATE INDEX "friendship_requester_idx" ON "friendship" USING btree ("requester_id","status");--> statement-breakpoint
CREATE INDEX "push_subscription_user_idx" ON "push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quest_verification_verifier_idx" ON "quest_verification" USING btree ("verifier_id","status");--> statement-breakpoint
CREATE INDEX "quest_verification_requester_idx" ON "quest_verification" USING btree ("requester_id","created_at");--> statement-breakpoint
ALTER TABLE "player_profile" ADD CONSTRAINT "player_profile_friend_code_unique" UNIQUE("friend_code");