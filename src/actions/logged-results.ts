"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import {
  type ResultOperation,
  authorize,
  authorizeResultWrite,
} from "@/auth/authorize";
import type { WarWeekAction } from "@/lib/access";
import { parseAttemptInput } from "@/lib/best-score/input";
import type { Parsed } from "@/lib/result";
import type { SeriesConfig } from "@/lib/series/config";
import { parseMatchInput } from "@/lib/series/input";
import * as attempts from "@/mutations/attempts";
import { closeCompetition, reopenCompetition } from "@/mutations/close";
import * as series from "@/mutations/series";
import type { MutationContext, MutationResult } from "@/mutations/types";
import type { LoggedCompetition } from "@/queries/logged-results";

export type LogResultResult =
  { ok: true; resultId: string } | { ok: false; error: string };

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)
    : {};
}

/** The write a parsed input runs, per the Competition's Format. */
type Write<R> = {
  match: (
    parsed: Parameters<typeof series.logMatch>[1],
    ctx: MutationContext,
  ) => Promise<R>;
  attempt: (
    parsed: Parameters<typeof attempts.logAttempt>[1],
    ctx: MutationContext,
  ) => Promise<R>;
};

/** The input parsed by the Competition's Format. */
function parsedFor(
  competition: LoggedCompetition,
  input: unknown,
):
  | Parsed<{ kind: "match"; value: Parameters<typeof series.logMatch>[1] }>
  | Parsed<{
      kind: "attempt";
      value: Parameters<typeof attempts.logAttempt>[1];
    }> {
  if (competition.format === "head-to-head") {
    const parsed = parseMatchInput(
      competition.config as SeriesConfig,
      competition.scoringConfig.direction,
      asRecord(input),
    );
    return parsed.ok
      ? { ok: true, value: { kind: "match", value: parsed.value } }
      : parsed;
  }
  const parsed = parseAttemptInput(asRecord(input));
  return parsed.ok
    ? { ok: true, value: { kind: "attempt", value: parsed.value } }
    : parsed;
}

/**
 * Runs a Match or Attempt write (ADR 0011): authorizes the actor with the
 * Format's facts and the posted input first, so a refusal wins over
 * malformed input, then parses the input by the Competition's Format. The
 * mutation checks the facts again under the Competition's lock.
 */
async function resultWrite<R extends { ok: boolean }>(
  operation: ResultOperation,
  competitionId: string,
  resultId: string | null,
  input: unknown,
  write: Write<R>,
): Promise<R | { ok: false; error: string }> {
  return guarded(async () => {
    const authorized = await authorizeResultWrite(
      operation,
      competitionId,
      resultId,
      operation === "delete" ? null : input,
    );
    if (!authorized.ok) return authorized;
    const parsed = parsedFor(authorized.competition, input);
    if (!parsed.ok) return parsed;
    const result =
      parsed.value.kind === "match"
        ? await write.match(parsed.value.value, authorized.ctx)
        : await write.attempt(parsed.value.value, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/**
 * Logs a Match or an Attempt: a Host or Organizer for anyone; with
 * self-report on, an Entrant their Match or a Participant their own
 * Attempt (at "Max attempts per person" 1, saving again edits it).
 */
export async function logResult(
  competitionId: string,
  input: unknown,
): Promise<LogResultResult> {
  return resultWrite("log", competitionId, null, input, {
    match: (parsed, ctx) => series.logMatch(competitionId, parsed, ctx),
    attempt: (parsed, ctx) => attempts.logAttempt(competitionId, parsed, ctx),
  });
}

/** Changes a Match or Attempt: a Host or Organizer, or with self-report on anyone who could have logged it. */
export async function updateResult(
  competitionId: string,
  resultId: string,
  input: unknown,
): Promise<MutationResult> {
  return resultWrite("edit", competitionId, resultId, input, {
    match: (parsed, ctx) =>
      series.updateMatch(competitionId, resultId, parsed, ctx),
    attempt: (parsed, ctx) =>
      attempts.updateAttempt(competitionId, resultId, parsed, ctx),
  });
}

/** Deletes a Match or Attempt: a Host or Organizer, or with self-report on anyone who could have logged it. */
export async function deleteResult(
  competitionId: string,
  resultId: string,
): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorizeResultWrite(
      "delete",
      competitionId,
      resultId,
    );
    if (!authorized.ok) return authorized;
    const result =
      authorized.competition.format === "head-to-head"
        ? await series.deleteMatch(competitionId, resultId, authorized.ctx)
        : await attempts.deleteAttempt(competitionId, resultId, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/**
 * Runs a Host or Organizer write on a Head-to-head or Best score
 * Competition, in its own War Week (loaded from the row), then
 * revalidates the War Week's pages.
 */
async function hostWrite(
  action: WarWeekAction,
  competitionId: string,
  write: (ctx: MutationContext) => Promise<MutationResult>,
): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorize(action, "competition", competitionId);
    if (!authorized.ok) return authorized;
    const result = await write(authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** Closes a Head-to-head or Best score Competition for its Placement Points. */
export async function closeLoggedResults(
  competitionId: string,
): Promise<MutationResult> {
  return hostWrite("results.close", competitionId, (ctx) =>
    closeCompetition(competitionId, ctx),
  );
}

/** Reopens a closed Head-to-head or Best score Competition, withdrawing its generated Points Entries. */
export async function reopenLoggedResults(
  competitionId: string,
): Promise<MutationResult> {
  return hostWrite("results.reopen", competitionId, (ctx) =>
    reopenCompetition(competitionId, ctx),
  );
}
