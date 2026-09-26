CREATE INDEX "award_team_id_idx" ON "award" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "award_participant_participant_id_idx" ON "award_participant" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "competition_host_competition_id_idx" ON "competition_host" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "heat_winner_to_heat_id_idx" ON "heat" USING btree ("winner_to_heat_id");--> statement-breakpoint
CREATE INDEX "heat_entrant_entrant_id_idx" ON "heat_entrant" USING btree ("entrant_id");--> statement-breakpoint
CREATE INDEX "participant_team_id_idx" ON "participant" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "points_entry_team_id_idx" ON "points_entry" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "points_entry_participant_id_idx" ON "points_entry" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "schedule_item_competition_id_idx" ON "schedule_item" USING btree ("competition_id");--> statement-breakpoint
ALTER TABLE "heat_entrant" ADD CONSTRAINT "heat_entrant_slot_0_or_1" CHECK ("heat_entrant"."slot" in (0, 1));--> statement-breakpoint
ALTER TABLE "heat_entrant" ADD CONSTRAINT "heat_entrant_place_from_1" CHECK ("heat_entrant"."place" is null or "heat_entrant"."place" >= 1);