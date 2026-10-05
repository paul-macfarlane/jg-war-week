/**
 * The words the League screens show (spec R23, decisions 10 and 11): a
 * Match as a line, its Scores, the Edit pairings warning, the Rounds help
 * and what the Scores decide in the result form. Pure, so the components
 * and the tests share one rule.
 */
import type { LeagueResult, ScoreDirection } from "@/lib/enums";
import { swissDefaultRounds } from "@/lib/league/config";
import type { LeaguePairing } from "@/lib/league/config";
import type { Pairing } from "@/lib/league/pairing";
import { parseLeagueResult } from "@/lib/league/result";

const RESULT_TEXT: Record<LeagueResult, string> = {
  a: "1–0",
  b: "0–1",
  draw: "½–½",
};

/** "Ada 1–0 Bo", "Ada ½–½ Bo", or "Ada v Bo" while it has no result. */
export function matchLine({
  aName,
  bName,
  result,
}: {
  aName: string;
  bName: string;
  result: LeagueResult | null;
}): string {
  return result === null
    ? `${aName} v ${bName}`
    : `${aName} ${RESULT_TEXT[result]} ${bName}`;
}

/** "Scores 21–18 kg"; a missing Score reads "?" ("Scores 3–?"); null when the Match has no Score. */
export function scoresText({
  scoreA,
  scoreB,
  unit,
}: {
  scoreA: number | null;
  scoreB: number | null;
  unit: string | null;
}): string | null {
  if (scoreA === null && scoreB === null) return null;
  const show = (score: number | null) =>
    score === null
      ? "?"
      : score.toLocaleString("en-US", { maximumFractionDigits: 3 });
  const trimmed = unit?.trim();
  return `Scores ${show(scoreA)}–${show(scoreB)}${trimmed ? ` ${trimmed}` : ""}`;
}

/** An Entrant with no opponent: "Ada has a bye" (Swiss), "Ada sits out" (round robin). */
export function byeLine(name: string, pairing: LeaguePairing): string {
  return pairing === "swiss" ? `${name} has a bye` : `${name} sits out`;
}

/** The Rounds field's help: the blank default for the Entrants so far. */
export function roundsHelp(entrantCount: number): string {
  if (entrantCount < 2) {
    return "Blank: ⌈log₂ N⌉ rounds, once there are 2 or more Entrants.";
  }
  const n = swissDefaultRounds(entrantCount);
  return `Blank: ⌈log₂ N⌉, ${n} for ${entrantCount} Entrants.`;
}

/**
 * The Edit pairings warning, one line per pair or Entrant (reading R7;
 * Paul, Q4): the pairs that would meet twice, in a round robin the pairs
 * that would never meet, and in a Swiss League an Entrant who would have a
 * second bye. Empty when the swap causes none of them.
 */
export function swapWarningLines(
  warnings: { repeats: Pairing[]; neverMeet: Pairing[]; secondByes: string[] },
  nameOf: (id: string) => string,
): string[] {
  const pair = (p: Pairing) => `${nameOf(p.a)} and ${nameOf(p.b!)}`;
  return [
    ...warnings.repeats.map((p) => `${pair(p)} would meet twice.`),
    ...warnings.neverMeet.map((p) => `${pair(p)} would never meet.`),
    ...warnings.secondByes.map(
      (id) => `${nameOf(id)} would have a second bye.`,
    ),
  ];
}

/**
 * "Your next Match": "Round 2 · v Bo", or with no opponent "Round 2 · You
 * have a bye" (Swiss) or "Round 2 · You sit out" (round robin).
 */
export function nextMatchText(
  next: { round: number; opponent: string | null },
  pairing: LeaguePairing,
): string {
  if (next.opponent !== null) return `Round ${next.round} · v ${next.opponent}`;
  return pairing === "swiss"
    ? `Round ${next.round} · You have a bye`
    : `Round ${next.round} · You sit out`;
}

/**
 * The result the Scores decide, or null when they don't (direction none, a
 * Score missing or not a number): the same rule the server posts against
 * (`parseLeagueResult`, reading R2).
 */
export function decidedResult(
  direction: ScoreDirection,
  scoreA: string,
  scoreB: string,
): LeagueResult | null {
  const parsed = parseLeagueResult(direction, { scoreA, scoreB, result: "" });
  return parsed.ok ? parsed.value.result : null;
}
