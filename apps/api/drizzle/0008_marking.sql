CREATE TABLE "marking_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"type" text NOT NULL,
	"skill" text NOT NULL,
	"answer_text" text,
	"recording_id" text,
	"auto_score" integer NOT NULL,
	"max" integer NOT NULL,
	"teacher_score" integer,
	"comment" text,
	"marked_by" text,
	"marked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marking_requests" ADD CONSTRAINT "marking_requests_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marking_requests" ADD CONSTRAINT "marking_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marking_requests" ADD CONSTRAINT "marking_requests_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marking_requests" ADD CONSTRAINT "marking_requests_marked_by_user_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marking_institute_idx" ON "marking_requests" USING btree ("institute_id","marked_at");--> statement-breakpoint
CREATE INDEX "marking_user_idx" ON "marking_requests" USING btree ("user_id");