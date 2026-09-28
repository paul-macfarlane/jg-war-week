ALTER TABLE "heat" ADD COLUMN "day_id" uuid;--> statement-breakpoint
ALTER TABLE "heat" ADD COLUMN "start_time" time;--> statement-breakpoint
ALTER TABLE "heat" ADD COLUMN "location" varchar(200);--> statement-breakpoint
ALTER TABLE "heat" ADD CONSTRAINT "heat_day_id_day_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."day"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "heat_day_id_idx" ON "heat" USING btree ("day_id");