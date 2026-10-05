-- R23 0034: League (round robin and Swiss). Additive: a Format value, the
-- `league_result` type, `competition.league_config`, the `league_match`
-- table and their CHECKs. No data changes. Every CHECK compares
-- `format::text`, never the new enum literal, which Postgres can't use in
-- the transaction that adds it (R3 decision 13).

-- 1. Types.
ALTER TYPE "public"."competition_format" ADD VALUE 'league';--> statement-breakpoint
CREATE TYPE "public"."league_result" AS ENUM('a', 'b', 'draw');--> statement-breakpoint

-- 2. A League's settings: its Pairing and a Swiss League's rounds.
ALTER TABLE "competition" ADD COLUMN "league_config" jsonb;--> statement-breakpoint

-- 3. One row per League Match; no second Entrant is a bye or sit-out.
CREATE TABLE "league_match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"position" integer NOT NULL,
	"entrant_a_id" uuid NOT NULL,
	"entrant_b_id" uuid,
	"result" "league_result",
	"score_a" numeric(12, 3),
	"score_b" numeric(12, 3),
	"recorded_at" timestamp with time zone,
	"recorded_by_email" varchar(254),
	"recorded_by_participant_id" uuid,
	"seed_key" varchar(80),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "league_match_competition_id_round_position_unique" UNIQUE("competition_id","round","position"),
	CONSTRAINT "league_match_competition_id_seed_key_unique" UNIQUE("competition_id","seed_key"),
	CONSTRAINT "league_match_round_from_1" CHECK ("league_match"."round" >= 1),
	CONSTRAINT "league_match_position_from_0" CHECK ("league_match"."position" >= 0),
	CONSTRAINT "league_match_two_entrants" CHECK ("league_match"."entrant_b_id" is null or "league_match"."entrant_b_id" <> "league_match"."entrant_a_id"),
	CONSTRAINT "league_match_bye_no_result" CHECK ("league_match"."entrant_b_id" is not null or ("league_match"."result" is null and "league_match"."score_a" is null and "league_match"."score_b" is null)),
	CONSTRAINT "league_match_recorded" CHECK (("league_match"."result" is null) = ("league_match"."recorded_at" is null)),
	CONSTRAINT "league_match_scores_need_result" CHECK ("league_match"."result" is not null or ("league_match"."score_a" is null and "league_match"."score_b" is null))
);--> statement-breakpoint
ALTER TABLE "league_match" ADD CONSTRAINT "league_match_competition_id_competition_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_match" ADD CONSTRAINT "league_match_entrant_a_id_entrant_id_fk" FOREIGN KEY ("entrant_a_id") REFERENCES "public"."entrant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_match" ADD CONSTRAINT "league_match_entrant_b_id_entrant_id_fk" FOREIGN KEY ("entrant_b_id") REFERENCES "public"."entrant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_match" ADD CONSTRAINT "league_match_recorded_by_participant_id_participant_id_fk" FOREIGN KEY ("recorded_by_participant_id") REFERENCES "public"."participant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "league_match_entrant_a_id_idx" ON "league_match" USING btree ("entrant_a_id");--> statement-breakpoint
CREATE INDEX "league_match_entrant_b_id_idx" ON "league_match" USING btree ("entrant_b_id");--> statement-breakpoint
CREATE INDEX "league_match_recorded_by_participant_id_idx" ON "league_match" USING btree ("recorded_by_participant_id");--> statement-breakpoint

-- 4. The Competition CHECKs: League's config, and enrollment now a
-- Bracket's or a League's (the name is kept).
ALTER TABLE "competition" DROP CONSTRAINT "competition_self_enroll_bracket_only";--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_league_config_league" CHECK (("competition"."league_config" is not null) = ("competition"."format"::text = 'league'));--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_league_config_shape" CHECK ("competition"."league_config" is null or (
        "competition"."league_config"->>'pairing' in ('round-robin', 'swiss')
        and case when jsonb_typeof("competition"."league_config"->'rounds') = 'number'
          then ("competition"."league_config"->>'rounds')::numeric >= 1
            and ("competition"."league_config"->>'rounds')::numeric = floor(("competition"."league_config"->>'rounds')::numeric)
            and "competition"."league_config"->>'pairing' = 'swiss'
          else coalesce(jsonb_typeof("competition"."league_config"->'rounds'), 'null') = 'null'
          end));--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_self_enroll_bracket_only" CHECK ("competition"."format"::text in ('bracket', 'league') or (not "competition"."self_enroll" and "competition"."entrant_limit" is null));
