import { z } from "zod";

import type { WarWeek } from "@/db/schema";
import { canAdministerWarWeek, isOrganizer } from "@/lib/access";
import {
  type Parsed,
  optional,
  parseWith,
  splitLines,
  trimmed,
} from "@/lib/setup";
import type { Standings } from "@/lib/standings";
import { warWeekSettingsSeedShape as seed } from "@/seed/schema";

type Status = WarWeek["status"];

/** How the admin names each status (the edition switcher, `/admin/setup`). */
export const STATUS_LABELS: Record<Status, string> = {
  upcoming: "Upcoming",
  live: "Live",
  complete: "Archive",
};

/**
 * Why a War Week can't move from `from` to `to`, or null when it can. The
 * only moves are Start (`upcoming → live`), End (`live → complete`) and
 * Reopen (`complete → live`); there's no way back to `upcoming`.
 * `liveEdition` is another War Week that is `live` now, if any: at most one
 * War Week is live, so going live waits for it to end.
 */
export function transitionError(
  from: Status,
  to: Status,
  { liveEdition }: { liveEdition: string | null },
): string | null {
  if (from === to) return `This War Week is already ${to}.`;
  if (to === "upcoming") return "A War Week can't go back to upcoming.";
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

export type LifecycleAction = "start" | "end" | "reopen" | "create-next";

type LifecycleWarWeek = Pick<
  WarWeek,
  | "id"
  | "edition"
  | "editionNumber"
  | "status"
  | "startDate"
  | "organizerEmails"
>;

const warWeekName = (w: Pick<WarWeek, "edition">) =>
  `War Week ${w.edition.toUpperCase()}`;

/**
 * Why `email` can't run a lifecycle action on `target`, or null when it
 * can. `current` is the current War Week and `warWeeks` every edition.
 * - End: whoever may administer the target (`canAdministerWarWeek`).
 * - Create next War Week: an Organizer of the current War Week, from any
 *   edition they may administer.
 * - Start (an `upcoming` target): an Organizer of the target or of the
 *   current War Week.
 * - Reopen (a `complete` target, whichever button asked): an Organizer of
 *   the current War Week who may administer the target, and only for the
 *   most recently ended edition while no later edition is upcoming.
 * So an Organizer of only a past edition can never make it current again.
 * The one-live rule (`transitionError`) is checked after this.
 */
export function lifecycleActionError({
  action,
  target,
  current,
  warWeeks,
  email,
}: {
  action: LifecycleAction;
  target: LifecycleWarWeek;
  current: LifecycleWarWeek | undefined;
  warWeeks: LifecycleWarWeek[];
  email: string | null | undefined;
}): string | null {
  const notOrganizer = `You're not an Organizer for ${warWeekName(target)}.`;
  const administers = canAdministerWarWeek(email, target, current);
  const organizesCurrent = current !== undefined && isOrganizer(email, current);
  const currentOnly = (what: string) =>
    current
      ? `Only an Organizer of ${warWeekName(current)}, the current War Week, can ${what}.`
      : notOrganizer;

  if (action === "end") return administers ? null : notOrganizer;
  if (action === "create-next") {
    if (!administers) return notOrganizer;
    return organizesCurrent ? null : currentOnly("create the next War Week");
  }
  if (target.status === "upcoming") {
    if (!isOrganizer(email, target) && !organizesCurrent) return notOrganizer;
    return action === "reopen" ? moveError("reopen", "upcoming") : null;
  }
  // Already live: the transition itself says so.
  if (target.status === "live") return administers ? null : notOrganizer;

  // A complete target: the move is Reopen, whichever button asked.
  if (!administers) return notOrganizer;
  if (action === "start") return moveError("start", "complete");
  if (!organizesCurrent) return currentOnly("reopen a War Week");
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
 * The Winner to prefill on End: first place on the main leaderboard (Team
 * Standings, or individual Standings in free-for-all). Tied first places
 * are joined with " & ". Blank when nobody has points.
 */
export function defaultWinner(standings: Standings): string {
  const rows =
    standings.main === "team" ? standings.team : standings.individual;
  return rows
    .filter((row) => row.rank === 1)
    .map((row) => row.name)
    .join(" & ");
}

const closingSchema = z.object({
  winner: optional(seed.winner),
  highlights: z.preprocess(splitLines, seed.highlights),
});

/** What End War Week records, as the dialog holds it. */
export type ClosingInput = { winner: string; highlights: string };
export type ClosingValues = Pick<WarWeek, "winner" | "highlights">;

/** Validates the End War Week dialog. Never throws; returns the first error. */
export function parseClosingInput(input: ClosingInput): Parsed<ClosingValues> {
  return parseWith(closingSchema, input);
}

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
