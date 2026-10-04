ALTER TYPE "public"."heat_status" RENAME TO "bracket_match_status";--> statement-breakpoint
ALTER TABLE "heat" RENAME TO "bracket_match";--> statement-breakpoint
ALTER TABLE "heat_entrant" RENAME TO "bracket_match_entrant";--> statement-breakpoint
ALTER TABLE "bracket_match" RENAME COLUMN "winner_to_heat_id" TO "winner_to_match_id";--> statement-breakpoint
ALTER TABLE "bracket_match" RENAME COLUMN "loser_to_heat_id" TO "loser_to_match_id";--> statement-breakpoint
ALTER TABLE "bracket_match_entrant" RENAME COLUMN "heat_id" TO "bracket_match_id";--> statement-breakpoint
ALTER TABLE "competition" RENAME COLUMN "finalized_at" TO "closed_at";--> statement-breakpoint
ALTER TABLE "points_entry" RENAME COLUMN "generated_by_bracket" TO "generated";--> statement-breakpoint
ALTER TABLE "bracket_match" RENAME CONSTRAINT "heat_pkey" TO "bracket_match_pkey";--> statement-breakpoint
ALTER TABLE "bracket_match" RENAME CONSTRAINT "heat_competition_id_round_position_unique" TO "bracket_match_competition_id_round_position_unique";--> statement-breakpoint
ALTER TABLE "bracket_match" RENAME CONSTRAINT "heat_competition_id_competition_id_fk" TO "bracket_match_competition_id_competition_id_fk";--> statement-breakpoint
ALTER TABLE "bracket_match" RENAME CONSTRAINT "heat_winner_to_heat_id_heat_id_fk" TO "bracket_match_winner_to_match_id_bracket_match_id_fk";--> statement-breakpoint
ALTER TABLE "bracket_match" RENAME CONSTRAINT "heat_loser_to_heat_id_heat_id_fk" TO "bracket_match_loser_to_match_id_bracket_match_id_fk";--> statement-breakpoint
ALTER TABLE "bracket_match" RENAME CONSTRAINT "heat_reported_by_participant_id_participant_id_fk" TO "bracket_match_reported_by_participant_id_participant_id_fk";--> statement-breakpoint
ALTER TABLE "bracket_match_entrant" RENAME CONSTRAINT "heat_entrant_heat_id_slot_pk" TO "bracket_match_entrant_bracket_match_id_slot_pk";--> statement-breakpoint
ALTER TABLE "bracket_match_entrant" RENAME CONSTRAINT "heat_entrant_heat_id_entrant_id_unique" TO "bracket_match_entrant_bracket_match_id_entrant_id_unique";--> statement-breakpoint
ALTER TABLE "bracket_match_entrant" RENAME CONSTRAINT "heat_entrant_slot_from_0" TO "bracket_match_entrant_slot_from_0";--> statement-breakpoint
ALTER TABLE "bracket_match_entrant" RENAME CONSTRAINT "heat_entrant_place_from_1" TO "bracket_match_entrant_place_from_1";--> statement-breakpoint
ALTER TABLE "bracket_match_entrant" RENAME CONSTRAINT "heat_entrant_heat_id_heat_id_fk" TO "bracket_match_entrant_bracket_match_id_bracket_match_id_fk";--> statement-breakpoint
ALTER TABLE "bracket_match_entrant" RENAME CONSTRAINT "heat_entrant_entrant_id_entrant_id_fk" TO "bracket_match_entrant_entrant_id_entrant_id_fk";--> statement-breakpoint
ALTER INDEX "heat_winner_to_heat_id_idx" RENAME TO "bracket_match_winner_to_match_id_idx";--> statement-breakpoint
ALTER INDEX "heat_loser_to_heat_id_idx" RENAME TO "bracket_match_loser_to_match_id_idx";--> statement-breakpoint
ALTER INDEX "heat_reported_by_participant_id_idx" RENAME TO "bracket_match_reported_by_participant_id_idx";--> statement-breakpoint
ALTER INDEX "heat_entrant_entrant_id_idx" RENAME TO "bracket_match_entrant_entrant_id_idx";
