import { z } from "zod";

import type { WarWeek } from "@/db/schema";
import type { Parsed } from "@/lib/result";
import {
  parseWith,
  warWeekSettingsSeedShape as seed,
  splitLines,
  trimmed,
} from "@/lib/setup";
import type { Standings } from "@/lib/standings";

type Status = WarWeek["status"];

/** How the admin names each status (the edition switcher, `/admin/settings`). */
export const STATUS_LABELS: Record<Status, string> = {
  upcoming: "Upcoming",
  live: "Live",
  complete: "Archive",
};

/**
 * Why a War Week can't move from `from` to `to`, or null when it can. The
 * only moves are Start (`upcoming → live`), End (`live → complete`),
 * Reopen (`complete → live`) and Unstart (`live → upcoming`, only while
 * nothing is scored: `unstartError`); an ended War Week can't go back to
 * `upcoming`.
 * `liveEdition` is another War Week that is `live` now, if any: at most one
 * War Week is live, so going live waits for it to end.
 */
export function transitionError(
  from: Status,
  to: Status,
  { liveEdition }: { liveEdition: string | null },
): string | null {
  if (from === to) return `This War Week is already ${to}.`;
  if (to === "upcoming") {
    return from === "live" ? null : "A War Week can't go back to upcoming.";
  }
  if (to === "complete") {
    return from === "live" ? null : "Start this War Week before ending it.";
  }
  // to === "live", from upcoming (Start) or complete (Reopen).
  return liveEdition ? `End ${liveEdition.toUpperCase()} first.` : null;
}

/**
 * Why Start or Reopen can't move a War Week that is `from`, or null. Both
 * make a War Week live, so each refuses the other's starting point:
 * Start never reopens an ended edition and Reopen never starts one.
 */
export function moveError(
  action: "start" | "reopen",
  from: Status,
): string | null {
  if (action === "start" && from === "complete") {
    return "This War Week has ended. Reopen it instead.";
  }
  if (action === "reopen" && from === "upcoming") {
    return "This War Week hasn't started. Start it instead.";
  }
  return null;
}

export type LifecycleAction =
  "start" | "end" | "reopen" | "unstart" | "create-next";

/** What has been scored in a War Week; Unstart needs all three at zero. */
export type ScoredCounts = {
  pointsEntries: number;
  matchResults: number;
  games: number;
};

type LifecycleWarWeek = Pick<
  WarWeek,
  "id" | "edition" | "editionNumber" | "status" | "startDate" | "winner"
>;

/**
 * Why Unstart can't move a War Week back to `upcoming`, or null. Only a
 * `live` edition that has never been ended (End sets its `winner`, and
 * Reopen keeps it) and has nothing scored: no Points Entry, no Match result
 * (`played`) and no Game. Refusals in that order.
 */
export function unstartError({
  status,
  winner,
  scored,
}: {
  status: Status;
  winner: string | null;
  scored: ScoredCounts;
}): string | null {
  if (status !== "live") return "Only a live War Week can be unstarted.";
  if (winner !== null) {
    return "This War Week has been ended; Unstart isn't available.";
  }
  if (scored.pointsEntries > 0) {
    return "Points have been entered; Unstart isn't available.";
  }
  if (scored.matchResults > 0) {
    return "A Match has a result; Unstart isn't available.";
  }
  if (scored.games > 0) {
    return "A Match or Attempt has been logged; Unstart isn't available.";
  }
  return null;
}

const NOTHING_SCORED: ScoredCounts = {
  pointsEntries: 0,
  matchResults: 0,
  games: 0,
};

const warWeekName = (w: Pick<WarWeek, "edition">) =>
  `War Week ${w.edition.toUpperCase()}`;

/**
 * Why a lifecycle action can't run on `target` given every edition
 * (`warWeeks`), or null when it can. Only the status rules: who may run it
 * is `can` (Organizers only), checked first.
 * - Start only moves an `upcoming` edition; on a `complete` one it says to
 *   reopen instead.
 * - Reopen (a `complete` target, whichever button asked) only for the most
 *   recently ended edition, and never while a later edition is upcoming.
 * - Unstart: `unstartError`, with `scored` read by the caller (none given
 *   counts as nothing scored).
 * The one-live rule (`transitionError`) is checked after this.
 */
export function lifecycleActionError({
  action,
  target,
  warWeeks,
  scored,
}: {
  action: LifecycleAction;
  target: LifecycleWarWeek;
  warWeeks: LifecycleWarWeek[];
  scored?: ScoredCounts;
}): string | null {
  if (action === "unstart") {
    return unstartError({ ...target, scored: scored ?? NOTHING_SCORED });
  }
  if (action === "end" || action === "create-next") return null;
  if (target.status === "upcoming") {
    return action === "reopen" ? moveError("reopen", "upcoming") : null;
  }
  // Already live: the transition itself says so.
  if (target.status === "live") return null;

  // A complete target: the move is Reopen, whichever button asked.
  if (action === "start") return moveError("start", "complete");
  const latest = warWeeks
    .filter((w) => w.status === "complete")
    .reduce<LifecycleWarWeek | undefined>(
      (best, w) => (!best || w.editionNumber > best.editionNumber ? w : best),
      undefined,
    );
  if (latest && latest.id !== target.id) {
    return `Only ${warWeekName(latest)}, the most recently ended War Week, can be reopened.`;
  }
  const next = warWeeks
    .filter((w) => w.status === "upcoming" && w.startDate > target.startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (next) return `${warWeekName(next)} is next; reopen isn't available.`;
  return null;
}

const NUMERALS: [number, string][] = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
];

/** A positive whole number as a lowercase Roman numeral (12 → "xii"). */
export function toRoman(n: number): string {
  let rest = n;
  let roman = "";
  for (const [value, numeral] of NUMERALS) {
    while (rest >= value) {
      roman += numeral;
      rest -= value;
    }
  }
  return roman;
}

/**
 * The next edition after every existing War Week: the highest edition
 * number + 1 as a Roman numeral, and the latest year + 1. With no War Week,
 * edition I in `fallbackYear` (the caller's clock, never read here).
 */
export function nextEditionDefaults(
  warWeeks: Pick<WarWeek, "editionNumber" | "year">[],
  fallbackYear: number,
): { edition: string; editionNumber: number; year: number } {
  if (warWeeks.length === 0) {
    return { edition: "i", editionNumber: 1, year: fallbackYear };
  }
  const editionNumber = Math.max(...warWeeks.map((w) => w.editionNumber)) + 1;
  const year = Math.max(...warWeeks.map((w) => w.year)) + 1;
  return { edition: toRoman(editionNumber), editionNumber, year };
}

/**
 * The Winner, computed on End: first place on the main leaderboard (Team
 * Standings, or individual Standings in free-for-all), read-only and never
 * an Organizer override. A single first place is its name; a shared first
 * place is a tie, formatted "Tie: A & B" ("Tie: A & B & C" for three or
 * more). Blank when every row is on 0 points (or there are no rows) —
 * otherwise a unique rank 1 wins even with a non-positive total, as long as
 * it is strictly ahead of the rest (0 beats -3).
 */
export function defaultWinner(standings: Standings): string {
  const rows =
    standings.main === "team" ? standings.team : standings.individual;
  if (rows.length === 0 || rows.every((row) => row.total === 0)) return "";
  return tieTitle(rows.filter((row) => row.rank === 1).map((row) => row.name));
}

/** One name as is; more than one (a tie) as "Tie: A & B & C". */
export function tieTitle(names: string[]): string {
  return names.length > 1 ? `Tie: ${names.join(" & ")}` : names.join("");
}

const closingSchema = z.object({
  highlights: z.preprocess(splitLines, seed.highlights),
});

/** What the End War Week dialog submits: highlights only. The Winner is
 * computed server-side from the Standings and is never client input. */
export type ClosingInput = { highlights: string };
export type ClosingValues = Pick<WarWeek, "highlights">;

/** Validates the End War Week dialog. Never throws; returns the first error. */
export function parseClosingInput(input: ClosingInput): Parsed<ClosingValues> {
  return parseWith(closingSchema, input);
}

/** Settings a new War Week gets when they aren't copied. */
export const DEFAULT_SETTINGS = {
  mode: "teams",
  teamLabel: "Team",
  leaderTitle: "Captain",
  slackChannelUrl: "https://jahnelgroup.slack.com/",
  wikiUrl: null,
  primaryColor: "#1d4ed8",
  primaryForegroundColor: "#ffffff",
  accentColor: "#f59e0b",
  backgroundColor: "#ffffff",
  foregroundColor: "#111827",
  overridePrimaryColor: null,
  overridePrimaryForegroundColor: null,
  overrideAccentColor: null,
  overrideBackgroundColor: null,
  overrideForegroundColor: null,
  fontPreset: "sans",
  logoUrl: null,
  bannerUrl: null,
} as const;

const nextWarWeekSchema = z
  .object({
    edition: z.preprocess(
      (value) =>
        typeof value === "string" ? value.trim().toLowerCase() : value,
      z
        .string()
        .min(1)
        .max(8)
        .regex(/^[ivxlcdm]+$/, "must be a Roman numeral like XII"),
    ),
    editionNumber: z.coerce.number().int().min(1),
    year: z.coerce.number().int().min(2000).max(2999),
    startDate: trimmed(seed.startDate),
    endDate: trimmed(seed.endDate),
    storyTheme: trimmed(seed.storyTheme),
    copySettings: z.boolean().default(true),
    copyCompetitions: z.boolean().default(false),
    copyFaq: z.boolean().default(false),
  })
  .refine((s) => s.startDate <= s.endDate, {
    error: "Start date must not be after the end date.",
    path: ["startDate"],
  });

/** The Create next War Week form, as it holds its fields. */
export type NextWarWeekInput = {
  edition: string;
  editionNumber: string | number;
  year: string | number;
  startDate: string;
  endDate: string;
  storyTheme: string;
  /** Default on: mode, labels, links and the Appearance Theme. */
  copySettings?: boolean;
  /** Default off: Competitions with their Placement Points, scoring and Hosts. */
  copyCompetitions?: boolean;
  /** Default off. */
  copyFaq?: boolean;
};
export type NextWarWeekValues = z.infer<typeof nextWarWeekSchema>;

/** Validates Create next War Week. Never throws; returns the first error. */
export function parseNextWarWeekInput(
  input: NextWarWeekInput,
): Parsed<NextWarWeekValues> {
  return parseWith(
    nextWarWeekSchema,
    input,
    (issue) => (issue.code === "custom" ? issue.message : null),
    {
      edition: "Edition",
      editionNumber: "Edition number",
      year: "Year",
    },
  );
}
