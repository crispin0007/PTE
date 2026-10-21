CREATE TABLE "item_types" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"skill" text NOT NULL,
	"section" text NOT NULL,
	"enabled" boolean NOT NULL,
	"scoring_rule" text NOT NULL,
	"timing" jsonb NOT NULL,
	"word_limits" jsonb,
	"enabling_skills" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"difficulty" integer NOT NULL,
	"tags" text[] NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_type_item_types_id_fk" FOREIGN KEY ("type") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_type_status_idx" ON "questions" USING btree ("type","status");