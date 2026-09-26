"use server";

import { revalidatePath } from "next/cache";

import { authorize } from "@/auth/authorize";
import type { WarWeekAction } from "@/lib/access";
import {
  isRowId,
  parseEntrantsInput,
  parseFormatInput,
  parseGenerateInput,
  parseHeatResultInput,
} from "@/lib/bracket/input";
import * as mutations from "@/mutations/brackets";
import type { MutationContext } from "@/mutations/types";

export type BracketActionResult = { ok: true } | { ok: false; error: string };

export type HeatResultActionResult =
  { ok: true; resetHeatIds: string[] } | { ok: false; error: string };

/**
 * Runs a Bracket write as an Organizer or a Host of the Competition, in the
 * Competition's own War Week (loaded from the row, never from client
 * input), then revalidates the War Week's pages. `write` parses its input.
 */
async function bracketWrite<R extends { ok: boolean }>(
  action: WarWeekAction,
  competitionId: unknown,
  write: (competitionId: string, ctx: MutationContext) => Promise<R>,
): Promise<R | { ok: false; error: string }> {
  const authorized = await authorize(action, "competition", competitionId);
  if (!authorized.ok) return authorized;

  const result = await write(competitionId as string, authorized.ctx);
  if (result.ok) {
    revalidatePath("/admin", "layout");
    revalidatePath(`/${authorized.warWeek.edition}`, "layout");
  }
  return result;
}

/** Part of the Competition's setup. */
export async function setCompetitionFormat(
  competitionId: string,
  input: unknown,
): Promise<BracketActionResult> {
  return bracketWrite("competition.edit", competitionId, async (id, ctx) => {
    const parsed = parseFormatInput(input);
    if (!parsed.ok) return parsed;
    return mutations.setCompetitionFormat(id, parsed.value, ctx);
  });
}

/** Sets the Entrants in Seed Position order; `force` clears Heat Results. */
export async function replaceEntrants(
  competitionId: string,
  input: unknown,
): Promise<BracketActionResult> {
  return bracketWrite("bracket.entrants", competitionId, async (id, ctx) => {
    const parsed = parseEntrantsInput(input);
    if (!parsed.ok) return parsed;
    return mutations.replaceEntrants(id, parsed.value.targetIds, ctx, {
      force: parsed.value.force,
    });
  });
}

/** Sets random Seed Positions and (re)builds the Bracket; `force` clears Heat Results. */
export async function generateBracket(
  competitionId: string,
  input: unknown = {},
): Promise<BracketActionResult> {
  return bracketWrite("bracket.generate", competitionId, async (id, ctx) => {
    const parsed = parseGenerateInput(input);
    if (!parsed.ok) return parsed;
    return mutations.generateBracket(id, ctx, { force: parsed.value.force });
  });
}

export async function recordHeatResult(
  competitionId: string,
  heatId: string,
  input: unknown,
): Promise<HeatResultActionResult> {
  return bracketWrite("bracket.heat-result", competitionId, async (id, ctx) => {
    if (!isRowId(heatId)) {
      return { ok: false, error: "That Heat no longer exists." };
    }
    const parsed = parseHeatResultInput(input);
    if (!parsed.ok) return parsed;
    return mutations.recordHeatResult(id, heatId, parsed.value, ctx);
  });
}

export async function finalizeBracket(
  competitionId: string,
): Promise<BracketActionResult> {
  return bracketWrite(
    "bracket.finalize",
    competitionId,
    mutations.finalizeBracket,
  );
}

export async function unfinalizeBracket(
  competitionId: string,
): Promise<BracketActionResult> {
  return bracketWrite(
    "bracket.unfinalize",
    competitionId,
    mutations.unfinalizeBracket,
  );
}
