/**
 * The admin Competition page's Settings form (ticket 101): its values as
 * the form holds them, seeded from the stored Competition; each field's
 * change as `saveCompetitionSetting` takes it; and which fields the
 * Competition's Format shows. Pure: no database, no framework.
 */
import {
  type BestScoreConfig,
  bestScoreConfigOf,
} from "@/lib/best-score/config";
import { type BracketConfig, configOf } from "@/lib/bracket/config";
import type { Format } from "@/lib/bracket/types";
import type { CompetitionSettingField } from "@/lib/competition-locks";
import type { CompetitionSettingChange } from "@/lib/competition-settings";
import type { COMPETITION_SCORINGS, ScoreDirection } from "@/lib/enums";
import { type LeagueConfig, leagueConfigOf } from "@/lib/league/config";
import { formatPoints } from "@/lib/points";
import { type Content } from "@/lib/rich-text/content";
import { type SeriesConfig, seriesConfigOf } from "@/lib/series/config";

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
  /** The Scores' unit label, like "sec"; blank for none. */
  scoreUnit: string;
  /** A Head-to-head's draws and Best of; else null. */
  seriesConfig: SeriesConfig | null;
  /** A Best score Competition's Team score; else null. */
  bestScoreConfig: BestScoreConfig | null;
  /** A Bracket's config; else null. */
  bracketConfig: BracketConfig | null;
  /** A League's Pairing and rounds; else null. */
  leagueConfig: LeagueConfig | null;
  selfEnroll: boolean;
  entrantLimit: string;
  selfReport: boolean;
  selfCheckIn: boolean;
  /** Best score's "Max attempts per person"; blank for no limit. */
  maxAttempts: string;
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
  scoreUnit: string | null;
  seriesConfig: unknown;
  bestScoreConfig: unknown;
  bracketConfig: unknown;
  /** A League's config; absent or null on every other Format. */
  leagueConfig?: unknown;
  selfEnroll: boolean;
  entrantLimit: number | null;
  selfReport: boolean;
  selfCheckIn: boolean;
  maxAttempts: number | null;
};

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
    scoreUnit: source.scoreUnit ?? "",
    seriesConfig: format === "head-to-head" ? seriesConfigOf(source) : null,
    bestScoreConfig: format === "best-score" ? bestScoreConfigOf(source) : null,
    bracketConfig: format === "bracket" ? configOf(source) : null,
    leagueConfig:
      format === "league"
        ? leagueConfigOf({ leagueConfig: source.leagueConfig })
        : null,
    selfEnroll: source.selfEnroll,
    entrantLimit:
      source.entrantLimit === null ? "" : String(source.entrantLimit),
    selfReport: source.selfReport,
    selfCheckIn: source.selfCheckIn,
    maxAttempts: source.maxAttempts === null ? "" : String(source.maxAttempts),
  };
}

/** A setting as the page posts it, before the server parses it. */
export type SettingPost = {
  field: CompetitionSettingChange["field"];
  value: unknown;
};

/** One field's change as `saveCompetitionSetting` takes it. */
export function settingChangeOf<K extends SettingsField>(
  field: K,
  value: CompetitionSettingsValues[K],
): { ok: true; change: SettingPost } | { ok: false; error: string } {
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
  // Only a Bracket or a League takes enrollment (spec R21, decision 5;
  // spec R23, decision 2).
  const enrolls = format === "bracket" || format === "league";
  const fields: (SettingsField | false)[] = [
    "name",
    "group",
    "description",
    "format",
    // A free-for-all has no Individual/Team choice, unless a Competition is
    // already Team there (so it can be fixed).
    (mode === "teams" || values.scoring === "team") && "scoring",
    mode === "teams" && "countsTowardTeam",
    !individualParticipation && "placementPoints",
    individualParticipation && "participationPoints",
    "hosts",
    format !== "participation" && "scoreDirection",
    format !== "participation" && "scoreUnit",
    format === "best-score" && values.scoring === "team" && "bestScoreConfig",
    format === "head-to-head" && "seriesConfig",
    format === "bracket" && "bracketConfig",
    format === "league" && "leagueConfig",
    format === "best-score" && "maxAttempts",
    // "Participants can log their own results" (spec R21, decision 4):
    // never Placement (ADR 0010) or Participation.
    (format === "bracket" ||
      format === "head-to-head" ||
      format === "best-score" ||
      format === "league") &&
      "selfReport",
    enrolls && "selfEnroll",
    enrolls && values.selfEnroll && "entrantLimit",
    format === "participation" && "selfCheckIn",
  ];
  return fields.filter((field): field is SettingsField => field !== false);
}

/** How each Format runs a Competition, shown under the Format field. */
export const FORMAT_DESCRIPTIONS: Record<Format, string> = {
  placement:
    "One result on one sheet: give each Team or Participant a Place, optionally a Score, then Close.",
  bracket:
    "Entrants play in Matches and a set number advance each Round, down to a final. Two per Match with one advancing is a head-to-head knockout.",
  "head-to-head":
    "Two Entrants play a Best of series; each Match has a Winner, or a draw when allowed. Players log Matches themselves.",
  "best-score":
    "Each Attempt records a Score; a person's best counts. Anyone logs Attempts as themselves and a leaderboard ranks them.",
  participation:
    "Points for taking part: the Host ticks who took part, or Participants check in.",
  league:
    "Entrants play each other one Match at a time, round robin or Swiss, for match points.",
};
