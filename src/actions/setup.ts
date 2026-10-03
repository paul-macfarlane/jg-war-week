"use server";

import { guarded } from "@/actions/result";
import { revalidateSite, revalidateWarWeek } from "@/actions/revalidate";
import { type TargetKind, authorize } from "@/auth/authorize";
import type { WarWeekAction } from "@/lib/access";
import { JG_EMAIL_MESSAGE, jgEmailListSchema } from "@/lib/jg-email";
import type { Parsed } from "@/lib/result";
import { rosterImportInputSchema } from "@/lib/roster-import";
import {
  type CompetitionInput,
  type DayInput,
  type ParticipantInput,
  type TeamInput,
  type WarWeekSettingsInput,
  parseCompetitionInput,
  parseCreateCompetitionInput,
  parseDayInput,
  parseParticipantInput,
  parseTeamInput,
  parseWarWeekSettingsFields,
} from "@/lib/setup";
import * as mutations from "@/mutations/setup";
import type {
  CreateCompetitionResult,
  ImportParticipantsInput,
  ImportParticipantsResult,
} from "@/mutations/setup";
import type { MutationContext, MutationResult } from "@/mutations/types";

export type SetupActionResult = MutationResult;

/** A setup write's refusal: access, input, or the write itself. */
type Refusal = Extract<SetupActionResult, { ok: false }>;

/**
 * Runs a setup write: authorizes `action` on the row `id` names (or, for a
 * create or the settings save, the posted War Week), only then parses the
 * input, runs `write` and, on success, revalidates the War Week's routes
 * (`revalidateWarWeek`), or the whole site when `reach` is `"site"`
 * (`revalidateSite`). Every setup action goes through here, so
 * none of them throws (`guarded`).
 */
async function setupWrite<T, R extends MutationResult = MutationResult>(
  action: WarWeekAction,
  kind: TargetKind,
  id: unknown,
  parse: () => Parsed<T>,
  write: (value: T, ctx: MutationContext) => Promise<R>,
  reach: "edition" | "site" = "edition",
): Promise<R | Refusal> {
  return guarded(async () => {
    const authorized = await authorize(action, kind, id);
    if (!authorized.ok) return authorized;
    const parsed = parse();
    if (!parsed.ok) return parsed;

    const result = await write(parsed.value, authorized.ctx);
    if (result.ok) {
      if (reach === "site") revalidateSite();
      else revalidateWarWeek(authorized.warWeek.edition);
    }
    return result;
  });
}

const nothing = (): Parsed<null> => ({ ok: true, value: null });

/**
 * Saves some of the War Week's settings: the fields one autosave sends.
 * Only those columns are written, laid over the row as it stands now
 * (`mutations.updateWarWeekSettingsFields`).
 */
export async function updateWarWeekSettingsFields(
  warWeekId: string,
  fields: Partial<WarWeekSettingsInput>,
): Promise<SetupActionResult> {
  return setupWrite(
    "settings.save",
    "warWeek",
    warWeekId,
    () => parseWarWeekSettingsFields(fields),
    mutations.updateWarWeekSettingsFields,
    // The header and the Archive show the settings and Appearance Theme.
    "site",
  );
}

export async function createDay(
  warWeekId: string,
  input: DayInput,
): Promise<SetupActionResult> {
  return setupWrite(
    "day.create",
    "warWeek",
    warWeekId,
    () => parseDayInput(input),
    mutations.createDay,
  );
}

// Every setup record belongs to one War Week: the action writes to the
// row's own, and the mutations refuse a row of any other.
export async function updateDay(
  id: string,
  input: DayInput,
): Promise<SetupActionResult> {
  return setupWrite(
    "day.edit",
    "day",
    id,
    () => parseDayInput(input),
    (value, ctx) => mutations.updateDay(id, value, ctx),
  );
}

export async function deleteDay(id: string): Promise<SetupActionResult> {
  return setupWrite("day.delete", "day", id, nothing, (_, ctx) =>
    mutations.deleteDay(id, ctx),
  );
}

export async function createTeam(
  warWeekId: string,
  input: TeamInput,
): Promise<SetupActionResult> {
  return setupWrite(
    "team.create",
    "warWeek",
    warWeekId,
    () => parseTeamInput(input),
    mutations.createTeam,
  );
}

export async function updateTeam(
  id: string,
  input: TeamInput,
): Promise<SetupActionResult> {
  return setupWrite(
    "team.edit",
    "team",
    id,
    () => parseTeamInput(input),
    (value, ctx) => mutations.updateTeam(id, value, ctx),
  );
}

export async function deleteTeam(id: string): Promise<SetupActionResult> {
  return setupWrite("team.delete", "team", id, nothing, (_, ctx) =>
    mutations.deleteTeam(id, ctx),
  );
}

export async function createParticipant(
  warWeekId: string,
  input: ParticipantInput,
): Promise<SetupActionResult> {
  return setupWrite(
    "participant.create",
    "warWeek",
    warWeekId,
    () => parseParticipantInput(input),
    mutations.createParticipant,
  );
}

export async function updateParticipant(
  id: string,
  input: ParticipantInput,
): Promise<SetupActionResult> {
  return setupWrite(
    "participant.edit",
    "participant",
    id,
    () => parseParticipantInput(input),
    (value, ctx) => mutations.updateParticipant(id, value, ctx),
  );
}

export async function deleteParticipant(
  id: string,
): Promise<SetupActionResult> {
  return setupWrite(
    "participant.delete",
    "participant",
    id,
    nothing,
    (_, ctx) => mutations.deleteParticipant(id, ctx),
  );
}

/**
 * Imports the roster from pasted cells or a CSV (ticket 67), Organizer
 * only: the Adds and Updates the preview showed (`expected`), or nothing
 * if the roster changed since.
 */
export async function importParticipants(
  warWeekId: string,
  input: ImportParticipantsInput,
): Promise<ImportParticipantsResult> {
  return setupWrite(
    "participant.import",
    "warWeek",
    warWeekId,
    (): Parsed<ImportParticipantsInput> => {
      const parsed = rosterImportInputSchema.safeParse(input);
      return parsed.success
        ? { ok: true, value: parsed.data }
        : { ok: false, error: "The import's rows are missing." };
    },
    mutations.importParticipants,
  );
}

/**
 * Creates a Competition, with the Format an Organizer chose on the create
 * form. Returns the new row's id, so the form can send a Bracket Format
 * straight to its Bracket setup.
 */
export async function createCompetition(
  warWeekId: string,
  input: CompetitionInput,
): Promise<CreateCompetitionResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "competition.create",
      "warWeek",
      warWeekId,
    );
    if (!authorized.ok) return authorized;
    const parsed = parseCreateCompetitionInput(input);
    if (!parsed.ok) return parsed;
    const result = await mutations.createCompetition(
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** A Competition's setup: its Organizers, or a Host of that Competition. */
export async function updateCompetition(
  id: string,
  input: CompetitionInput,
): Promise<SetupActionResult> {
  return setupWrite(
    "competition.edit",
    "competition",
    id,
    () => parseCompetitionInput(input),
    (value, ctx) => mutations.updateCompetition(id, value, ctx),
  );
}

export async function deleteCompetition(
  id: string,
): Promise<SetupActionResult> {
  return setupWrite(
    "competition.delete",
    "competition",
    id,
    nothing,
    (_, ctx) => mutations.deleteCompetition(id, ctx),
  );
}

/**
 * Replaces a Competition's Hosts ("assign Hosts", Organizer only). Saved on
 * its own, never with the Competition's setup, so a Host's setup save can't
 * carry a Hosts list.
 */
export async function setCompetitionHosts(
  competitionId: string,
  emails: string[],
): Promise<SetupActionResult> {
  return setupWrite(
    "competition.assign-hosts",
    "competition",
    competitionId,
    (): Parsed<string[]> => {
      const parsed = jgEmailListSchema.safeParse(emails);
      return parsed.success
        ? { ok: true, value: parsed.data }
        : { ok: false, error: JG_EMAIL_MESSAGE };
    },
    (value, ctx) => mutations.setCompetitionHosts(competitionId, value, ctx),
  );
}
