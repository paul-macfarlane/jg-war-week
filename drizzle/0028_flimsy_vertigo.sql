-- R16, the Competition model (Epic R16, "The migration"). Hand-edited from
-- the generated diff so it applies to rows of the old shape; drizzle runs
-- every pending migration in one transaction. Deployed data is reset by a
-- reseed afterwards; this coerces just enough to apply, not to keep Standings.
--
-- Step 1: drop the CHECKs naming changed columns; they're re-added last.
ALTER TABLE "competition" DROP CONSTRAINT "competition_game_type_iff_games";--> statement-breakpoint
ALTER TABLE "competition" DROP CONSTRAINT "competition_participation_columns";--> statement-breakpoint
-- New: Score direction and the placement table.
CREATE TYPE "public"."score_direction" AS ENUM('none', 'higher', 'lower');--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "score_direction" "score_direction" DEFAULT 'none' NOT NULL;--> statement-breakpoint
CREATE TABLE "placement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"team_id" uuid,
	"participant_id" uuid,
	"place" integer,
	"score" numeric(12, 3),
	"seed_key" varchar(80),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "placement_competition_id_team_id_unique" UNIQUE("competition_id","team_id"),
	CONSTRAINT "placement_competition_id_participant_id_unique" UNIQUE("competition_id","participant_id"),
	CONSTRAINT "placement_competition_id_seed_key_unique" UNIQUE("competition_id","seed_key"),
	CONSTRAINT "placement_exactly_one_target" CHECK (num_nonnulls("placement"."team_id", "placement"."participant_id") = 1),
	CONSTRAINT "placement_place_from_1" CHECK ("placement"."place" is null or "placement"."place" >= 1)
);
--> statement-breakpoint
ALTER TABLE "placement" ADD CONSTRAINT "placement_competition_id_competition_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement" ADD CONSTRAINT "placement_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement" ADD CONSTRAINT "placement_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "placement_competition_id_idx" ON "placement" USING btree ("competition_id");--> statement-breakpoint
-- Step 2: recreate competition_format. The column goes through text so the
-- new type can take the old one's name (no ALTER TYPE … ADD VALUE, no
-- rename); the CASE reads game_type, which step 6 drops.
ALTER TABLE "competition" ALTER COLUMN "format" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "competition" ALTER COLUMN "format" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."competition_format";--> statement-breakpoint
CREATE TYPE "public"."competition_format" AS ENUM('placement', 'single-elimination', 'heats', 'head-to-head', 'best-score', 'participation');--> statement-breakpoint
ALTER TABLE "competition" ALTER COLUMN "format" SET DATA TYPE "public"."competition_format" USING (
	CASE
		WHEN "format" = 'points' THEN 'placement'
		WHEN "format" = 'games' AND "game_type"::text = 'head-to-head' THEN 'head-to-head'
		WHEN "format" = 'games' AND "game_type"::text = 'best-score' THEN 'best-score'
		WHEN "format" = 'games' THEN 'placement'
		ELSE "format"
	END
)::"public"."competition_format";--> statement-breakpoint
ALTER TABLE "competition" ALTER COLUMN "format" SET DEFAULT 'placement'::"public"."competition_format";--> statement-breakpoint
-- Step 3: a former ranked Competition (now a Placement, still found by its
-- game_type) loses its Games, Entrants and generated Points Entries, and its
-- Games settings.
DELETE FROM "game" WHERE "competition_id" IN (SELECT "id" FROM "competition" WHERE "game_type"::text = 'ranked');--> statement-breakpoint
DELETE FROM "entrant" WHERE "competition_id" IN (SELECT "id" FROM "competition" WHERE "game_type"::text = 'ranked');--> statement-breakpoint
DELETE FROM "points_entry" WHERE "generated_by_bracket" AND "competition_id" IN (SELECT "id" FROM "competition" WHERE "game_type"::text = 'ranked');--> statement-breakpoint
UPDATE "competition" SET "finalized_at" = NULL, "game_config" = NULL, "logging_closes_at" = NULL, "entrants_open" = DEFAULT WHERE "game_type"::text = 'ranked';--> statement-breakpoint
-- Step 4: Participation follows scoring. A team row takes its N as one
-- Placement Points place where it had none (a per-person row), then loses N;
-- an individual row loses Placement Points.
UPDATE "competition" SET "placement_points" = ARRAY["participation_points"] WHERE "format" = 'participation' AND "scoring" = 'team' AND "placement_points" IS NULL;--> statement-breakpoint
UPDATE "competition" SET "participation_points" = NULL WHERE "format" = 'participation' AND "scoring" = 'team';--> statement-breakpoint
UPDATE "competition" SET "placement_points" = NULL WHERE "format" = 'participation' AND "scoring" = 'individual';--> statement-breakpoint
ALTER TABLE "competition" DROP COLUMN "participation_team_scoring";--> statement-breakpoint
DROP TYPE "public"."participation_team_scoring";--> statement-breakpoint
-- Step 5: points_entry.war_week_id, added nullable, backfilled from the
-- Competition, then not null; competition_id becomes optional and seed
-- uniqueness moves to the War Week.
ALTER TABLE "points_entry" ADD COLUMN "war_week_id" uuid;--> statement-breakpoint
UPDATE "points_entry" SET "war_week_id" = "competition"."war_week_id" FROM "competition" WHERE "competition"."id" = "points_entry"."competition_id";--> statement-breakpoint
ALTER TABLE "points_entry" ALTER COLUMN "war_week_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "points_entry" ADD CONSTRAINT "points_entry_war_week_id_war_week_id_fk" FOREIGN KEY ("war_week_id") REFERENCES "public"."war_week"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_entry" ALTER COLUMN "competition_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "points_entry" DROP CONSTRAINT "points_entry_competition_id_seed_key_unique";--> statement-breakpoint
ALTER TABLE "points_entry" ADD CONSTRAINT "points_entry_war_week_id_seed_key_unique" UNIQUE("war_week_id","seed_key");--> statement-breakpoint
CREATE INDEX "points_entry_competition_id_idx" ON "points_entry" USING btree ("competition_id");--> statement-breakpoint
-- Step 6: Max Points and Game Types go; Finish Points leave game_config,
-- which only Head-to-head and Best score keep.
ALTER TABLE "competition" DROP COLUMN "max_points";--> statement-breakpoint
ALTER TABLE "competition" DROP COLUMN "game_type";--> statement-breakpoint
DROP TYPE "public"."game_type";--> statement-breakpoint
UPDATE "competition" SET "game_config" = "game_config" - 'finishPoints' WHERE jsonb_typeof("game_config") = 'object';--> statement-breakpoint
UPDATE "competition" SET "game_config" = NULL WHERE "game_config" IS NOT NULL AND "format" NOT IN ('head-to-head', 'best-score');--> statement-breakpoint
-- Last: re-add the CHECKs, now on the new columns and Formats.
ALTER TABLE "competition" ADD CONSTRAINT "competition_score_direction_placement_only" CHECK ("competition"."score_direction"::text = 'none' or "competition"."format"::text = 'placement');--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_game_config_head_to_head_or_best_score" CHECK ("competition"."game_config" is null or "competition"."format"::text in ('head-to-head', 'best-score'));--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_participation_columns" CHECK (case when "competition"."format"::text = 'participation'
        then case when "competition"."scoring" = 'individual'
          then "competition"."participation_points" is not null
            and "competition"."placement_points" is null
          else "competition"."placement_points" is not null
            and "competition"."participation_points" is null
          end
        else "competition"."participation_points" is null
          and "competition"."check_in_closes_at" is null
          and not "competition"."self_check_in"
        end);--> statement-breakpoint
ALTER TABLE "points_entry" ADD CONSTRAINT "points_entry_reason_without_competition" CHECK ("points_entry"."competition_id" is not null or "points_entry"."note" is not null);
