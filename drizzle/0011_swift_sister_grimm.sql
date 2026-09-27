ALTER TYPE "public"."competition_format" ADD VALUE 'heats';--> statement-breakpoint
ALTER TABLE "heat_entrant" DROP CONSTRAINT "heat_entrant_slot_0_or_1";--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "bracket_config" jsonb;--> statement-breakpoint
ALTER TABLE "heat" ADD COLUMN "slot_count" smallint DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "heat_entrant" ADD CONSTRAINT "heat_entrant_slot_from_0" CHECK ("heat_entrant"."slot" >= 0);