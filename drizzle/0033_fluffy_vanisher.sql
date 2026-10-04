DELETE FROM "competition_host";--> statement-breakpoint
ALTER TABLE "competition_host" DROP CONSTRAINT "competition_host_email_competition_id_unique";--> statement-breakpoint
ALTER TABLE "competition_host" DROP CONSTRAINT "competition_host_email_lowercase";--> statement-breakpoint
ALTER TABLE "award" DROP CONSTRAINT "award_category_id_award_category_id_fk";
--> statement-breakpoint
DROP INDEX "award_category_id_idx";--> statement-breakpoint
ALTER TABLE "competition_host" ADD COLUMN "participant_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "competition_host" ADD CONSTRAINT "competition_host_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award" DROP COLUMN "category_id";--> statement-breakpoint
ALTER TABLE "award_category" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "award_category" CASCADE;--> statement-breakpoint
ALTER TABLE "competition_host" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "war_week" DROP COLUMN "finale_awards_layout";--> statement-breakpoint
ALTER TABLE "competition_host" ADD CONSTRAINT "competition_host_participant_id_competition_id_unique" UNIQUE("participant_id","competition_id");--> statement-breakpoint
DROP TYPE "public"."finale_awards_layout";