-- R21 0032: reshape. Splits `game` / `game_player` into Head-to-head
-- `series_match` / `series_match_entrant` and Best score `attempt`; moves
-- Best score's direction and unit into the scoring columns; drops the
-- scheduled close times and `entrants_open`; rewrites `bracket_config` to
-- its new keys; makes Bracket Match Scores numeric. Row fates: the R21
-- execution plan (P10b). `scripts/r21-migration-report.ts`, run before
-- this, lists every row it drops or nulls.

-- 1. CHECKs that name a column this migration drops or widens.
ALTER TABLE "competition" DROP CONSTRAINT "competition_score_direction_placement_only";--> statement-breakpoint
ALTER TABLE "competition" DROP CONSTRAINT "competition_game_config_head_to_head_or_best_score";--> statement-breakpoint
ALTER TABLE "competition" DROP CONSTRAINT "competition_participation_columns";--> statement-breakpoint

-- 2. The new tables.
CREATE TABLE "attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"team_id" uuid,
	"score" numeric(12, 3) NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"logged_by_email" varchar(254) NOT NULL,
	"logged_by_participant_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series_match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"logged_by_email" varchar(254) NOT NULL,
	"logged_by_participant_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series_match_entrant" (
	"series_match_id" uuid NOT NULL,
	"entrant_id" uuid NOT NULL,
	"place" integer,
	"score" numeric(12, 3),
	CONSTRAINT "series_match_entrant_series_match_id_entrant_id_pk" PRIMARY KEY("series_match_id","entrant_id"),
	CONSTRAINT "series_match_entrant_place_from_1" CHECK ("series_match_entrant"."place" is null or "series_match_entrant"."place" >= 1)
);
--> statement-breakpoint
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_competition_id_competition_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_logged_by_participant_id_participant_id_fk" FOREIGN KEY ("logged_by_participant_id") REFERENCES "public"."participant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_match" ADD CONSTRAINT "series_match_competition_id_competition_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_match" ADD CONSTRAINT "series_match_logged_by_participant_id_participant_id_fk" FOREIGN KEY ("logged_by_participant_id") REFERENCES "public"."participant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_match_entrant" ADD CONSTRAINT "series_match_entrant_series_match_id_series_match_id_fk" FOREIGN KEY ("series_match_id") REFERENCES "public"."series_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_match_entrant" ADD CONSTRAINT "series_match_entrant_entrant_id_entrant_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempt_competition_id_idx" ON "attempt" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "attempt_participant_id_idx" ON "attempt" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "attempt_team_id_idx" ON "attempt" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "attempt_logged_by_participant_id_idx" ON "attempt" USING btree ("logged_by_participant_id");--> statement-breakpoint
CREATE INDEX "series_match_competition_id_idx" ON "series_match" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "series_match_logged_by_participant_id_idx" ON "series_match" USING btree ("logged_by_participant_id");--> statement-breakpoint
CREATE INDEX "series_match_entrant_entrant_id_idx" ON "series_match_entrant" USING btree ("entrant_id");--> statement-breakpoint

-- 3. The new columns (`advance_count` nullable until step 6).
ALTER TABLE "competition" ADD COLUMN "score_unit" varchar(20);--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "series_config" jsonb;--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "best_score_config" jsonb;--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "max_attempts" integer;--> statement-breakpoint
ALTER TABLE "bracket_match" ADD COLUMN "advance_count" smallint;--> statement-breakpoint

-- 4. Data.
-- A Bracket's config under its new keys; null is the head-to-head default.
UPDATE "competition" SET "bracket_config" = jsonb_build_object(
	'kind', CASE
		WHEN coalesce(("bracket_config"->>'entrantsPerHeat')::int, 2) = 2
			AND coalesce(("bracket_config"->>'advancePerHeat')::int, 1) = 1
		THEN 'head-to-head' ELSE 'group' END,
	'entrantsPerMatch', coalesce(("bracket_config"->>'entrantsPerHeat')::int, 2),
	'advancePerMatch', coalesce(("bracket_config"->>'advancePerHeat')::int, 1),
	'thirdPlaceMatch', coalesce(("bracket_config"->>'thirdPlaceGame')::boolean, false),
	'rounds', '{}'::jsonb)
WHERE "format"::text = 'bracket';--> statement-breakpoint
-- Each Match's advancing count: 1 head-to-head and in the final, else the
-- config's.
UPDATE "bracket_match" SET "advance_count" = CASE
	WHEN c."bracket_config"->>'kind' = 'head-to-head' THEN 1
	WHEN NOT "bracket_match"."third_place" AND "bracket_match"."round" = (
		SELECT max(last."round") FROM "bracket_match" last
		WHERE last."competition_id" = "bracket_match"."competition_id") THEN 1
	ELSE coalesce((c."bracket_config"->>'advancePerMatch')::int, 1) END
FROM "competition" c
WHERE c."id" = "bracket_match"."competition_id";--> statement-breakpoint
UPDATE "bracket_match" SET "advance_count" = 1 WHERE "advance_count" IS NULL;--> statement-breakpoint

-- Head-to-head: draws as saved, Best of as saved or 7 (so existing Matches fit).
UPDATE "competition" SET "series_config" = jsonb_build_object(
	'drawsAllowed', coalesce(("game_config"->>'drawsAllowed')::boolean, false),
	'bestOf', coalesce(("game_config"->>'bestOf')::int, 7))
WHERE "format"::text = 'head-to-head';--> statement-breakpoint

-- Head-to-head Games: each player as a Team or Participant id.
CREATE TEMP TABLE "r21_h2h_player" AS
SELECT g."competition_id", g."id" AS "game_id", gp."id" AS "game_player_id",
	coalesce(gp."team_id", gp."participant_id") AS "player_id",
	gp."team_id", gp."participant_id", gp."place", gp."score"
FROM "game" g
JOIN "game_player" gp ON gp."game_id" = g."id"
JOIN "competition" c ON c."id" = g."competition_id"
WHERE c."format"::text = 'head-to-head';--> statement-breakpoint
-- The series that convert: exactly two players, every Game between both,
-- at most 7 Games.
CREATE TEMP TABLE "r21_h2h_kept" AS
SELECT p."competition_id"
FROM "r21_h2h_player" p
GROUP BY p."competition_id"
HAVING count(DISTINCT p."player_id") = 2
	AND count(DISTINCT p."game_id") <= 7
	AND count(*) = 2 * count(DISTINCT p."game_id");--> statement-breakpoint
-- Both players become Entrants (reused when already entered).
INSERT INTO "entrant" ("competition_id", "team_id", "participant_id", "seed_position")
SELECT x."competition_id", x."team_id", x."participant_id",
	coalesce((SELECT max(e."seed_position") FROM "entrant" e
		WHERE e."competition_id" = x."competition_id"), 0)
	+ row_number() OVER (PARTITION BY x."competition_id" ORDER BY x."player_id")
FROM (
	SELECT DISTINCT p."competition_id", p."team_id", p."participant_id", p."player_id"
	FROM "r21_h2h_player" p
	JOIN "r21_h2h_kept" k ON k."competition_id" = p."competition_id"
) x
WHERE NOT EXISTS (
	SELECT 1 FROM "entrant" e
	WHERE e."competition_id" = x."competition_id"
		AND (e."team_id" = x."team_id" OR e."participant_id" = x."participant_id"));--> statement-breakpoint
-- A converted series keeps only the two who played.
DELETE FROM "entrant" e
USING "r21_h2h_kept" k
WHERE e."competition_id" = k."competition_id"
	AND NOT EXISTS (
		SELECT 1 FROM "r21_h2h_player" p
		WHERE p."competition_id" = e."competition_id"
			AND (p."team_id" = e."team_id" OR p."participant_id" = e."participant_id"));--> statement-breakpoint
-- Any other Head-to-head keeps its first two Entrants by Seed Position.
DELETE FROM "entrant" e
USING "competition" c
WHERE c."id" = e."competition_id"
	AND c."format"::text = 'head-to-head'
	AND NOT EXISTS (SELECT 1 FROM "r21_h2h_kept" k WHERE k."competition_id" = e."competition_id")
	AND (SELECT count(*) FROM "entrant" earlier
		WHERE earlier."competition_id" = e."competition_id"
			AND earlier."seed_position" < e."seed_position") >= 2;--> statement-breakpoint
INSERT INTO "series_match" ("id", "competition_id", "recorded_at", "logged_by_email",
	"logged_by_participant_id", "created_at", "updated_at")
SELECT g."id", g."competition_id", g."logged_at", g."logged_by_email",
	g."logged_by_participant_id", g."created_at", g."updated_at"
FROM "game" g
JOIN "r21_h2h_kept" k ON k."competition_id" = g."competition_id";--> statement-breakpoint
INSERT INTO "series_match_entrant" ("series_match_id", "entrant_id", "place", "score")
SELECT p."game_id", e."id", p."place", p."score"
FROM "r21_h2h_player" p
JOIN "r21_h2h_kept" k ON k."competition_id" = p."competition_id"
JOIN "entrant" e ON e."competition_id" = p."competition_id"
	AND (e."team_id" = p."team_id" OR e."participant_id" = p."participant_id");--> statement-breakpoint
DROP TABLE "r21_h2h_kept";--> statement-breakpoint
DROP TABLE "r21_h2h_player";--> statement-breakpoint

-- Best score: direction and unit become the scoring columns; a team
-- Competition that counted totals becomes Sum of members.
UPDATE "competition" SET
	"score_direction" = (CASE WHEN "game_config"->>'betterIs' = 'lower'
		THEN 'lower' ELSE 'higher' END)::"score_direction",
	"score_unit" = left(nullif(btrim("game_config"->>'unit'), ''), 20),
	"best_score_config" = jsonb_build_object('teamScore', CASE
		WHEN "scoring" = 'team' AND "game_config"->>'count' = 'total'
		THEN 'sum-of-members' ELSE 'best-member' END)
WHERE "format"::text = 'best-score';--> statement-breakpoint
-- Each scored Best score Game becomes an Attempt by a Participant: the
-- player (individual, credited to their Team now), or the logger when on
-- the Team that played (team). Null-score and Host-logged team Games drop.
INSERT INTO "attempt" ("id", "competition_id", "participant_id", "team_id", "score",
	"recorded_at", "logged_by_email", "logged_by_participant_id", "created_at", "updated_at")
SELECT DISTINCT ON (g."id") g."id", g."competition_id",
	CASE WHEN c."scoring" = 'individual' THEN gp."participant_id"
		ELSE g."logged_by_participant_id" END,
	CASE WHEN c."scoring" = 'individual' THEN player."team_id"
		ELSE gp."team_id" END,
	gp."score", g."logged_at", g."logged_by_email", g."logged_by_participant_id",
	g."created_at", g."updated_at"
FROM "game" g
JOIN "competition" c ON c."id" = g."competition_id"
JOIN "game_player" gp ON gp."game_id" = g."id"
LEFT JOIN "participant" player ON player."id" = gp."participant_id"
LEFT JOIN "participant" logger ON logger."id" = g."logged_by_participant_id"
WHERE c."format"::text = 'best-score'
	AND gp."score" IS NOT NULL
	AND ((c."scoring" = 'individual' AND gp."participant_id" IS NOT NULL)
		OR (c."scoring" = 'team' AND gp."team_id" IS NOT NULL
			AND logger."team_id" = gp."team_id"))
ORDER BY g."id", gp."id";--> statement-breakpoint
-- Best score has no Entrant list.
DELETE FROM "entrant" e
USING "competition" c
WHERE c."id" = e."competition_id" AND c."format"::text = 'best-score';--> statement-breakpoint
-- Enrollment is a Bracket's alone.
UPDATE "competition" SET "self_enroll" = false, "entrant_limit" = NULL
WHERE "format"::text <> 'bracket' AND ("self_enroll" OR "entrant_limit" IS NOT NULL);--> statement-breakpoint

-- 5. Bracket Match Scores become numbers; anything else becomes null.
ALTER TABLE "bracket_match_entrant" ALTER COLUMN "score" SET DATA TYPE numeric(12, 3)
USING CASE WHEN "score" ~ '^\s*-?\d{1,9}(\.\d{1,3})?\s*$' THEN btrim("score")::numeric END;--> statement-breakpoint

-- The Finale's Winners slide.
ALTER TYPE "public"."finale_slide_kind" RENAME VALUE 'champions' TO 'winners';--> statement-breakpoint

-- 6. Tighten and drop.
ALTER TABLE "bracket_match" ALTER COLUMN "advance_count" SET NOT NULL;--> statement-breakpoint
DROP TABLE "game_player";--> statement-breakpoint
DROP TABLE "game";--> statement-breakpoint
ALTER TABLE "competition" DROP COLUMN "game_config";--> statement-breakpoint
ALTER TABLE "competition" DROP COLUMN "entrants_open";--> statement-breakpoint
ALTER TABLE "competition" DROP COLUMN "logging_closes_at";--> statement-breakpoint
ALTER TABLE "competition" DROP COLUMN "enroll_closes_at";--> statement-breakpoint
ALTER TABLE "competition" DROP COLUMN "check_in_closes_at";--> statement-breakpoint

-- 7. The new CHECKs.
ALTER TABLE "bracket_match" ADD CONSTRAINT "bracket_match_advance_count_from_1" CHECK ("bracket_match"."advance_count" >= 1);--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_score_direction_by_format" CHECK (case "competition"."format"::text
        when 'participation' then "competition"."score_direction"::text = 'none'
        when 'best-score' then "competition"."score_direction"::text in ('higher', 'lower')
        else true
        end);--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_series_config_head_to_head" CHECK (("competition"."series_config" is not null) = ("competition"."format"::text = 'head-to-head'));--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_best_score_config_best_score" CHECK ("competition"."best_score_config" is null or "competition"."format"::text = 'best-score');--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_max_attempts" CHECK ("competition"."max_attempts" is null or ("competition"."max_attempts" >= 1 and "competition"."format"::text = 'best-score'));--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_self_enroll_bracket_only" CHECK ("competition"."format"::text = 'bracket' or (not "competition"."self_enroll" and "competition"."entrant_limit" is null));--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_participation_columns" CHECK (case when "competition"."format"::text = 'participation'
        then case when "competition"."scoring" = 'individual'
          then "competition"."participation_points" is not null
            and "competition"."placement_points" is null
          else "competition"."placement_points" is not null
            and "competition"."participation_points" is null
          end
        else "competition"."participation_points" is null
          and not "competition"."self_check_in"
        end);
