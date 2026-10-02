CREATE TYPE "public"."participation_team_scoring" AS ENUM('ranked', 'per-person');--> statement-breakpoint
CREATE TABLE "participation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"marked_by_email" varchar(254) NOT NULL,
	"checked_in" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "participation_competition_id_participant_id_unique" UNIQUE("competition_id","participant_id")
);
--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "participation_points" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "participation_team_scoring" "participation_team_scoring";--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "self_check_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "check_in_closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "participation" ADD CONSTRAINT "participation_competition_id_competition_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participation" ADD CONSTRAINT "participation_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participation_participant_id_idx" ON "participation" USING btree ("participant_id");--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_participation_columns" CHECK (case when "competition"."format"::text = 'participation'
        then "competition"."participation_points" is not null
          and ("competition"."scoring" = 'team') = ("competition"."participation_team_scoring" is not null)
        else "competition"."participation_points" is null
          and "competition"."participation_team_scoring" is null
          and "competition"."check_in_closes_at" is null
          and not "competition"."self_check_in"
        end);