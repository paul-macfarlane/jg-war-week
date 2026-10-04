DELETE FROM "competition_host";--> statement-breakpoint
ALTER TABLE "competition_host" DROP CONSTRAINT "competition_host_email_competition_id_unique";--> statement-breakpoint
ALTER TABLE "competition_host" DROP CONSTRAINT "competition_host_email_lowercase";--> statement-breakpoint
ALTER TABLE "competition_host" ADD COLUMN "participant_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "competition_host" ADD CONSTRAINT "competition_host_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_host" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "competition_host" ADD CONSTRAINT "competition_host_participant_id_competition_id_unique" UNIQUE("participant_id","competition_id");