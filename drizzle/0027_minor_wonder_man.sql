CREATE TYPE "public"."finale_awards_layout" AS ENUM('one-slide', 'per-category');--> statement-breakpoint
CREATE TYPE "public"."finale_slide_kind" AS ENUM('title', 'numbers', 'awards', 'champions', 'standings', 'winner', 'custom');--> statement-breakpoint
CREATE TABLE "finale_slide" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"war_week_id" uuid NOT NULL,
	"kind" "finale_slide_kind" NOT NULL,
	"sort_order" integer NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"heading" varchar(120),
	"body" jsonb,
	"background_color" varchar(7),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finale_slide_war_week_kind_heading" UNIQUE NULLS NOT DISTINCT("war_week_id","kind","heading"),
	CONSTRAINT "finale_slide_custom_columns" CHECK (("finale_slide"."kind"::text = 'custom') = ("finale_slide"."heading" is not null) and ("finale_slide"."kind"::text = 'custom' or ("finale_slide"."body" is null and "finale_slide"."background_color" is null))),
	CONSTRAINT "finale_slide_background_color_hex" CHECK ("finale_slide"."background_color" is null or "finale_slide"."background_color" ~ '^#[0-9a-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "war_week" ADD COLUMN "finale_awards_layout" "finale_awards_layout" DEFAULT 'one-slide' NOT NULL;--> statement-breakpoint
ALTER TABLE "finale_slide" ADD CONSTRAINT "finale_slide_war_week_id_war_week_id_fk" FOREIGN KEY ("war_week_id") REFERENCES "public"."war_week"("id") ON DELETE cascade ON UPDATE no action;