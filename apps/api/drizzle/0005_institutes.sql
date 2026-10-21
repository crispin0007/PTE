CREATE TABLE "class_members" (
	"class_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_members_class_id_user_id_pk" PRIMARY KEY("class_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" text PRIMARY KEY NOT NULL,
	"institute_id" text NOT NULL,
	"name" text NOT NULL,
	"invite_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classes_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "institutes" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institutes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"institute_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_institute_id_user_id_pk" PRIMARY KEY("institute_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "class_members" ADD CONSTRAINT "class_members_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_members" ADD CONSTRAINT "class_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_members_user_idx" ON "class_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "classes_institute_idx" ON "classes" USING btree ("institute_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");