CREATE TABLE "award_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"key" varchar(80),
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "award_category_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "award" ADD COLUMN "category_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "award_category_name_lower" ON "award_category" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "award" ADD CONSTRAINT "award_category_id_award_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."award_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "award_category_id_idx" ON "award" USING btree ("category_id");