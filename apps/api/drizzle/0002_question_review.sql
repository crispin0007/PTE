CREATE TABLE "reviews" (
	"question_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"reviewer_handle" text NOT NULL,
	"verdict" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "origin" text DEFAULT 'yaml' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "author_id" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_question_reviewer_idx" ON "reviews" USING btree ("question_id","reviewer_id");