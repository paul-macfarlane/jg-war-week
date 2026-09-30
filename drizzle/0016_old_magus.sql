CREATE TABLE "game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"logged_by_email" varchar(254) NOT NULL,
	"logged_by_participant_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_player" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"team_id" uuid,
	"participant_id" uuid,
	"place" integer,
	"score" numeric(10, 2),
	CONSTRAINT "game_player_game_id_team_id_unique" UNIQUE("game_id","team_id"),
	CONSTRAINT "game_player_game_id_participant_id_unique" UNIQUE("game_id","participant_id"),
	CONSTRAINT "game_player_exactly_one_target" CHECK (num_nonnulls("game_player"."team_id", "game_player"."participant_id") = 1),
	CONSTRAINT "game_player_place_from_1" CHECK ("game_player"."place" is null or "game_player"."place" >= 1)
);
--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "game_type" "game_type";--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "game_config" jsonb;--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "entrants_open" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "logging_closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "self_enroll" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "entrant_limit" integer;--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "enroll_closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_competition_id_competition_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_logged_by_participant_id_participant_id_fk" FOREIGN KEY ("logged_by_participant_id") REFERENCES "public"."participant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_player" ADD CONSTRAINT "game_player_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_player" ADD CONSTRAINT "game_player_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_player" ADD CONSTRAINT "game_player_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_competition_id_idx" ON "game" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "game_logged_by_participant_id_idx" ON "game" USING btree ("logged_by_participant_id");--> statement-breakpoint
CREATE INDEX "game_player_team_id_idx" ON "game_player" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "game_player_participant_id_idx" ON "game_player" USING btree ("participant_id");--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_game_type_iff_games" CHECK (("competition"."game_type" is not null) = ("competition"."format"::text = 'games'));--> statement-breakpoint
ALTER TABLE "competition" ADD CONSTRAINT "competition_entrant_limit_above_1" CHECK ("competition"."entrant_limit" is null or "competition"."entrant_limit" > 1);