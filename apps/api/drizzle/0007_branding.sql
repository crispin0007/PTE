ALTER TABLE "institutes" ADD COLUMN "brand_color" text;--> statement-breakpoint
ALTER TABLE "institutes" ADD COLUMN "logo" "bytea";--> statement-breakpoint
ALTER TABLE "institutes" ADD COLUMN "logo_mime" text;--> statement-breakpoint
ALTER TABLE "institutes" ADD COLUMN "logo_updated_at" timestamp with time zone;