CREATE TABLE "usage_counter" (
	"scope" text NOT NULL,
	"metric" text NOT NULL,
	"day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_counter_scope_metric_day_pk" PRIMARY KEY("scope","metric","day")
);
--> statement-breakpoint
CREATE INDEX "usage_counter_day_idx" ON "usage_counter" USING btree ("day");