CREATE TABLE "schedule_item_host" (
	"schedule_item_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	CONSTRAINT "schedule_item_host_schedule_item_id_participant_id_pk" PRIMARY KEY("schedule_item_id","participant_id")
);
--> statement-breakpoint
ALTER TABLE "schedule_item" DROP CONSTRAINT "schedule_item_day_id_start_time_title_unique";--> statement-breakpoint
ALTER TABLE "schedule_item" ALTER COLUMN "start_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_item_host" ADD CONSTRAINT "schedule_item_host_schedule_item_id_schedule_item_id_fk" FOREIGN KEY ("schedule_item_id") REFERENCES "public"."schedule_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_item_host" ADD CONSTRAINT "schedule_item_host_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedule_item_host_participant_id_idx" ON "schedule_item_host" USING btree ("participant_id");--> statement-breakpoint
ALTER TABLE "schedule_item" DROP COLUMN "host";--> statement-breakpoint
ALTER TABLE "schedule_item" ADD CONSTRAINT "schedule_item_day_id_start_time_title_unique" UNIQUE NULLS NOT DISTINCT("day_id","start_time","title");