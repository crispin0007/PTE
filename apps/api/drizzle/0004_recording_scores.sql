ALTER TABLE "recordings" ADD COLUMN "result" jsonb;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "scored_at" timestamp with time zone;