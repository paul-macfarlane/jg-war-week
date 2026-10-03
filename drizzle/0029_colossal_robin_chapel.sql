-- R17, Brackets (Epic R17, "The migration"). Hand-edited from the generated
-- diff so it applies to rows of the old shape; drizzle runs every pending
-- migration in one transaction. Deployed data is reset by a reseed
-- afterwards: every Bracket returns to not generated rather than converted.
--
-- Step 1: drop the CHECKs naming competition.format, whose type changes;
-- they're re-added last.
ALTER TABLE "competition" DROP CONSTRAINT "competition_score_direction_placement_only";--> statement-breakpoint
ALTER TABLE "competition" DROP CONSTRAINT "competition_game_config_head_to_head_or_best_score";--> statement-breakpoint
ALTER TABLE "competition" DROP CONSTRAINT "competition_participation_columns";--> statement-breakpoint
-- Step 2: every Bracket returns to not generated. Its Heats go (heat_entrant
-- cascades, taking every forfeit Heat and forfeited row), then its generated
-- Points Entries and its finalized_at.
DELETE FROM "heat" WHERE "competition_id" IN (SELECT "id" FROM "competition" WHERE "format"::text IN ('single-elimination', 'heats'));--> statement-breakpoint
DELETE FROM "points_entry" WHERE "generated_by_bracket" AND "competition_id" IN (SELECT "id" FROM "competition" WHERE "format"::text IN ('single-elimination', 'heats'));--> statement-breakpoint
UPDATE "competition" SET "finalized_at" = NULL WHERE "format"::text IN ('single-elimination', 'heats');--> statement-breakpoint
-- Step 3: recreate competition_format with bracket in place of
-- single-elimination and heats. The column goes through text so the new
-- type can take the old one's name (no ALTER TYPE … ADD VALUE, no rename).
ALTER TABLE "competition" ALTER COLUMN "format" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "competition" ALTER COLUMN "format" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."competition_format";--> statement-breakpoint
CREATE TYPE "public"."competition_format" AS ENUM('placement', 'bracket', 'head-to-head', 'best-score', 'participation');--> statement-breakpoint
-- Step 4, while the text column still tells the two old Formats apart:
-- bracket_config is set for every Bracket. A former single elimination is
-- 2 / 1; a former Heats keeps its saved values (4 / 2 where null). Neither
-- has a 3rd place game.
UPDATE "competition" SET "bracket_config" = '{"entrantsPerHeat":2,"advancePerHeat":1,"thirdPlaceGame":false}'::jsonb WHERE "format" = 'single-elimination';--> statement-breakpoint
UPDATE "competition" SET "bracket_config" = jsonb_build_object(
	'entrantsPerHeat', COALESCE(("bracket_config"->>'entrantsPerHeat')::int, 4),
	'advancePerHeat', COALESCE(("bracket_config"->>'advancePerHeat')::int, 2),
	'thirdPlaceGame', false
) WHERE "format" = 'heats';--> statement-breakpoint
ALTER TABLE "competition" ALTER COLUMN "format" SET DATA TYPE "public"."competition_format" USING (
	CASE
		WHEN "format" IN ('single-elimination', 'heats') THEN 'bracket'
		ELSE "format"
	END
)::"public"."competition_format";--> statement-breakpoint
ALTER TABLE "competition" ALTER COLUMN "format" SET DEFAULT 'placement'::"public"."competition_format";--> statement-breakpoint
-- Step 5: a Bracket places at most 4, so longer Placement Points are cut
-- to their first 4.
UPDATE "competition" SET "placement_points" = "placement_points"[1:4] WHERE "format" = 'bracket' AND cardinality("placement_points") > 4;--> statement-breakpoint
-- Step 6: heat_status loses forfeit (no forfeit Heat is left after step 2);
-- a Heat's Day, time and place and an Entrant's Forfeit go; the recorded
-- time and the 3rd place game's columns are added.
ALTER TABLE "heat" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "heat" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."heat_status";--> statement-breakpoint
CREATE TYPE "public"."heat_status" AS ENUM('pending', 'ready', 'played');--> statement-breakpoint
ALTER TABLE "heat" ALTER COLUMN "status" SET DATA TYPE "public"."heat_status" USING "status"::"public"."heat_status";--> statement-breakpoint
ALTER TABLE "heat" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."heat_status";--> statement-breakpoint
ALTER TABLE "heat_entrant" DROP COLUMN "forfeited";--> statement-breakpoint
ALTER TABLE "heat" DROP CONSTRAINT "heat_day_id_day_id_fk";--> statement-breakpoint
DROP INDEX "heat_day_id_idx";--> statement-breakpoint
ALTER TABLE "heat" DROP COLUMN "day_id";--> statement-breakpoint
ALTER TABLE "heat" DROP COLUMN "start_time";--> statement-breakpoint
ALTER TABLE "heat" DROP COLUMN "location";--> statement-breakpoint
ALTER TABLE "heat" ADD COLUMN "loser_to_heat_id" uuid;--> statement-breakpoint
ALTER TABLE "heat" ADD COLUMN "loser_to_slot" integer;--> statement-breakpoint
ALTER TABLE "heat" ADD COLUMN "third_place" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "heat" ADD COLUMN "recorded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "heat" ADD CONSTRAINT "heat_loser_to_heat_id_heat_id_fk" FOREIGN KEY ("loser_to_heat_id") REFERENCES "public"."heat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "heat_loser_to_heat_id_idx" ON "heat" USING btree ("loser_to_heat_id");--> statement-breakpoint
-- Last: re-add the CHECKs, now on the new Formats.
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
        end);
