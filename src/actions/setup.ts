"use server";

import { revalidatePath } from "next/cache";

import { type TargetKind, authorize } from "@/auth/authorize";
import type { WarWeekAction } from "@/lib/access";
import {
  type CompetitionInput,
  type DayInput,
  type ParticipantInput,
  type TeamInput,
  type WarWeekSettingsInput,
  parseCompetitionInput,
  parseDayInput,
  parseParticipantInput,
  parseTeamInput,
  parseWarWeekSettingsInput,
} from "@/lib/setup";
import * as mutations from "@/mutations/setup";
import type { MutationContext, MutationResult } from "@/mutations/types";

export type SetupActionResult = MutationResult;

// The Appearance Theme and settings show on every page of the War Week,
// the admin shell and the Archive, so revalidate the whole site.
function revalidateSite() {
  revalidatePath("/", "layout");
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const RECORD_NOT_FOUND = "That record no longer exists.";

/**
 * Runs a setup write: authorizes `action` on the row `id` names (or, for a
 * create or the settings save, the posted War Week), only then parses the
 * input, runs `write` and revalidates the site on success. Every setup
 * action goes through here.
 */
async function setupWrite<T>(
  action: WarWeekAction,
  kind: TargetKind,
  id: unknown,
  parse: () => Parsed<T>,
  write: (value: T, ctx: MutationContext) => Promise<MutationResult>,
): Promise<SetupActionResult> {
  const authorized = await authorize(action, kind, id, {
    notFound: kind === "warWeek" ? undefined : RECORD_NOT_FOUND,
  });
  if (!authorized.ok) return authorized;
  const parsed = parse();
  if (!parsed.ok) return parsed;

  const result = await write(parsed.value, authorized.ctx);
  if (result.ok) revalidateSite();
  return result;
}

const nothing = (): Parsed<null> => ({ ok: true, value: null });

export async function updateWarWeekSettings(
  warWeekId: string,
  input: WarWeekSettingsInput,
): Promise<SetupActionResult> {
  return setupWrite(
    "settings.save",
    "warWeek",
    warWeekId,
    () => parseWarWeekSettingsInput(input),
    mutations.updateWarWeekSettings,
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

export async function createCompetition(
  warWeekId: string,
  input: CompetitionInput,
): Promise<SetupActionResult> {
  return setupWrite(
    "competition.create",
    "warWeek",
    warWeekId,
    () => parseCompetitionInput(input),
    mutations.createCompetition,
  );
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
    (): Parsed<string[]> =>
      Array.isArray(emails) && emails.every((e) => typeof e === "string")
        ? { ok: true, value: emails }
        : { ok: false, error: "Hosts must be a list of emails." },
    (value, ctx) => mutations.setCompetitionHosts(competitionId, value, ctx),
  );
}
