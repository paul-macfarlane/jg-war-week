CREATE TABLE "squad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "squad_competition_id_name_unique" UNIQUE("competition_id","name")
);
--> statement-breakpoint
CREATE TABLE "squad_participant" (
	"squad_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	CONSTRAINT "squad_participant_squad_id_participant_id_pk" PRIMARY KEY("squad_id","participant_id")
);
--> statement-breakpoint
ALTER TABLE "entrant" DROP CONSTRAINT "entrant_exactly_one_target";--> statement-breakpoint
ALTER TABLE "competition" ADD COLUMN "self_report" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "entrant" ADD COLUMN "squad_id" uuid;--> statement-breakpoint
ALTER TABLE "heat" ADD COLUMN "reported_by_email" varchar(254);--> statement-breakpoint
ALTER TABLE "heat" ADD COLUMN "reported_by_participant_id" uuid;--> statement-breakpoint
ALTER TABLE "squad" ADD CONSTRAINT "squad_competition_id_competition_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad" ADD CONSTRAINT "squad_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_participant" ADD CONSTRAINT "squad_participant_squad_id_squad_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_participant" ADD CONSTRAINT "squad_participant_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "squad_team_id_idx" ON "squad" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "squad_participant_participant_id_idx" ON "squad_participant" USING btree ("participant_id");--> statement-breakpoint
ALTER TABLE "entrant" ADD CONSTRAINT "entrant_squad_id_squad_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heat" ADD CONSTRAINT "heat_reported_by_participant_id_participant_id_fk" FOREIGN KEY ("reported_by_participant_id") REFERENCES "public"."participant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "heat_reported_by_participant_id_idx" ON "heat" USING btree ("reported_by_participant_id");--> statement-breakpoint
ALTER TABLE "entrant" ADD CONSTRAINT "entrant_competition_id_squad_id_unique" UNIQUE("competition_id","squad_id");--> statement-breakpoint
ALTER TABLE "entrant" ADD CONSTRAINT "entrant_exactly_one_target" CHECK (num_nonnulls("entrant"."team_id", "entrant"."participant_id", "entrant"."squad_id") = 1);