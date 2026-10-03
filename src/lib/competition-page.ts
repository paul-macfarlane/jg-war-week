/**
 * The admin Competition page's Settings form (ticket 101): its values as
 * the form holds them, seeded from the stored Competition; each field's
 * change as `saveCompetitionSetting` takes it; and which fields the
 * Competition's Format shows. Pure: no database, no framework.
 */
import { type BracketConfig, configOf } from "@/lib/bracket/config";
import type { Format } from "@/lib/bracket/types";
import type { CompetitionSettingField } from "@/lib/competition-locks";
import type { CompetitionSettingChange } from "@/lib/competition-settings";
import {
  type COMPETITION_SCORINGS,
  type ScoreDirection,
  isGameFormat,
} from "@/lib/enums";
import { type GamesConfig, gamesConfigOf } from "@/lib/games/config";
import { enrollmentUnavailable } from "@/lib/games/enroll-rule";
import { formatPoints } from "@/lib/points";
import { type ProfilesByEmail, resolveProfile } from "@/lib/profile";
import { type Content } from "@/lib/rich-text/content";
import { fromEasternClock, toEasternClock } from "@/lib/schedule";

/** A close time as its two pickers hold it: ET date and `HH:MM`, blank for none. */
export type Clock = { date: string; time: string };

/** A description with nothing in it, as the editor starts. */
export const EMPTY_CONTENT: Content = { type: "doc", content: [] };

/** Every setting the Settings form holds, keyed by its lock-table field. */
export type CompetitionSettingsValues = {
  name: string;
  /** Rich text, as an Announcement body; empty document for none. */
  description: Content;
  group: string;
  /** Host emails (Organizers only; a Host sees names, never this). */
  hosts: string[];
  /** "10, 7, 5", as `PlacementPointsRows` edits it. */
  placementPoints: string;
  participationPoints: string;
  format: Format;
  scoring: (typeof COMPETITION_SCORINGS)[number];
  countsTowardTeam: boolean;
  scoreDirection: ScoreDirection;
  /** A Head-to-head or Best score Competition's config; else null. */
  gameConfig: GamesConfig | null;
  entrantsOpen: boolean;
  /** A Bracket's config; else null. */
  bracketConfig: BracketConfig | null;
  selfEnroll: boolean;
  entrantLimit: string;
  enrollClosesAt: Clock;
  loggingClosesAt: Clock;
  selfReport: boolean;
  selfCheckIn: boolean;
  checkInClosesAt: Clock;
};

export type SettingsField = keyof CompetitionSettingsValues &
  CompetitionSettingField;

/** The stored Competition the form is seeded from, with its Host emails. */
export type CompetitionSettingsSource = {
  name: string;
  description: Content | null;
  competitionGroup: string | null;
  hosts: string[];
  placementPoints: number[] | null;
  participationPoints: number | null;
  format: Format;
  scoring: (typeof COMPETITION_SCORINGS)[number];
  countsTowardTeam: boolean;
  scoreDirection: ScoreDirection;
  gameConfig: unknown;
  entrantsOpen: boolean;
  bracketConfig: unknown;
  selfEnroll: boolean;
  entrantLimit: number | null;
  enrollClosesAt: Date | null;
  loggingClosesAt: Date | null;
  selfReport: boolean;
  selfCheckIn: boolean;
  checkInClosesAt: Date | null;
};

/** What a close time with only its date or only its time shows. */
export const CLOCK_HALF_SET = "Choose both a date and a time, or neither.";

function clockOf(date: Date | null): Clock {
  if (!date) return { date: "", time: "" };
  const clock = toEasternClock(date);
  return { date: clock.date, time: clock.time.slice(0, 5) };
}

/** The form's values from the stored Competition. */
export function settingsValuesOf(
  source: CompetitionSettingsSource,
): CompetitionSettingsValues {
  const { format } = source;
  return {
    name: source.name,
    description: source.description ?? EMPTY_CONTENT,
    group: source.competitionGroup ?? "",
    hosts: source.hosts,
    placementPoints: source.placementPoints?.join(", ") ?? "",
    participationPoints:
      source.participationPoints === null
        ? ""
        : formatPoints(source.participationPoints),
    format,
    scoring: source.scoring,
    countsTowardTeam: source.countsTowardTeam,
    scoreDirection: source.scoreDirection,
    gameConfig: isGameFormat(format)
      ? gamesConfigOf({ format, gameConfig: source.gameConfig })
      : null,
    entrantsOpen: source.entrantsOpen,
    bracketConfig: format === "bracket" ? configOf(source) : null,
    selfEnroll: source.selfEnroll,
    entrantLimit:
      source.entrantLimit === null ? "" : String(source.entrantLimit),
    enrollClosesAt: clockOf(source.enrollClosesAt),
    loggingClosesAt: clockOf(source.loggingClosesAt),
    selfReport: source.selfReport,
    selfCheckIn: source.selfCheckIn,
    checkInClosesAt: clockOf(source.checkInClosesAt),
  };
}

/** A setting as the page posts it, before the server parses it. */
export type SettingPost = {
  field: CompetitionSettingChange["field"];
  value: unknown;
};

/** A close time as posted: its instant (ISO), null for none, or a refusal. */
function closesAt(clock: Clock): { ok: true; value: string | null } | null {
  if (!clock.date && !clock.time) return { ok: true, value: null };
  const instant = fromEasternClock(clock.date, clock.time);
  return instant ? { ok: true, value: instant.toISOString() } : null;
}

/**
 * One field's change as `saveCompetitionSetting` takes it, or why it
 * can't be sent yet (a close time with only half set).
 */
export function settingChangeOf<K extends SettingsField>(
  field: K,
  value: CompetitionSettingsValues[K],
): { ok: true; change: SettingPost } | { ok: false; error: string } {
  if (
    field === "enrollClosesAt" ||
    field === "loggingClosesAt" ||
    field === "checkInClosesAt"
  ) {
    const instant = closesAt(value as Clock);
    return instant
      ? { ok: true, change: { field, value: instant.value } }
      : { ok: false, error: CLOCK_HALF_SET };
  }
  return { ok: true, change: { field, value } };
}

/**
 * The fields the form shows for the Competition as it stands: the shared
 * ones, then the Format's own (and those its switches turn on).
 */
export function shownSettings(
  values: CompetitionSettingsValues,
  mode: "teams" | "free-for-all",
): SettingsField[] {
  const { format } = values;
  const individualParticipation =
    format === "participation" && values.scoring === "individual";
  const enrolls =
    (format === "bracket" || isGameFormat(format)) &&
    enrollmentUnavailable({
      format,
      entrantsOpen: values.entrantsOpen,
      gameConfig: values.gameConfig,
    }) === null;
  const fields: (SettingsField | false)[] = [
    "name",
    "group",
    "description",
    "format",
    "scoring",
    mode === "teams" && "countsTowardTeam",
    !individualParticipation && "placementPoints",
    individualParticipation && "participationPoints",
    "hosts",
    format === "placement" && "scoreDirection",
    isGameFormat(format) && "gameConfig",
    isGameFormat(format) && "entrantsOpen",
    isGameFormat(format) && "loggingClosesAt",
    format === "bracket" && "bracketConfig",
    format === "bracket" && "selfReport",
    enrolls && "selfEnroll",
    enrolls && values.selfEnroll && "entrantLimit",
    enrolls && values.selfEnroll && "enrollClosesAt",
    format === "participation" && "selfCheckIn",
    format === "participation" && values.selfCheckIn && "checkInClosesAt",
  ];
  return fields.filter((field): field is SettingsField => field !== false);
}

/** A Host with neither a Profile name nor a roster name, on a Host's page. */
export const HOST_NOT_ON_ROSTER = "A Host not on the roster";

/**
 * A Host as a Host's Competition page names them, by the one name rule
 * (`resolveProfile`): their Profile name, else their roster name in this
 * War Week (`rosterNames`, by lowercase email); with neither,
 * `HOST_NOT_ON_ROSTER`. Never anything from the email, so the page holds
 * no other Host's email or part of one.
 */
export function hostNameOnPage(
  email: string,
  profiles: ProfilesByEmail,
  rosterNames: Map<string, string>,
): string {
  const key = email.trim().toLowerCase();
  return (
    resolveProfile({
      rosterName: rosterNames.get(key) ?? "",
      ...profiles.get(key),
    }).name || HOST_NOT_ON_ROSTER
  );
}

/** How each Format runs a Competition, shown under the Format field. */
export const FORMAT_DESCRIPTIONS: Record<Format, string> = {
  placement:
    "One result on one sheet: give each Team or Participant a Place, optionally a Score, then Finalize.",
  bracket:
    "Entrants play in Heats and a set number advance each Round, down to a final. Two per Heat with one advancing is a head-to-head knockout.",
  "head-to-head":
    "Two players per Game; a winner, or a draw when allowed. Players log Games themselves and a leaderboard ranks them.",
  "best-score":
    "Each Game records a score; the best or the total counts. Players log Games themselves and a leaderboard ranks them.",
  participation:
    "Points for taking part: the Host ticks who took part, or Participants check in.",
};
