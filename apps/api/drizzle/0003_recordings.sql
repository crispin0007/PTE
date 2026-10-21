CREATE TABLE "recordings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"type" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recordings_user_idx" ON "recordings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recordings_expiry_idx" ON "recordings" USING btree ("expires_at");