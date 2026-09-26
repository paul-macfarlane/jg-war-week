CREATE TABLE "competition_host" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"email" varchar(254) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "competition_host_email_competition_id_unique" UNIQUE("email","competition_id"),
	CONSTRAINT "competition_host_email_lowercase" CHECK ("competition_host"."email" = lower("competition_host"."email"))
);
--> statement-breakpoint
CREATE TABLE "organizer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"added_by" varchar(254),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizer_email_unique" UNIQUE("email"),
	CONSTRAINT "organizer_email_lowercase" CHECK ("organizer"."email" = lower("organizer"."email"))
);
--> statement-breakpoint
ALTER TABLE "competition_host" ADD CONSTRAINT "competition_host_competition_id_competition_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("id") ON DELETE cascade ON UPDATE no action;