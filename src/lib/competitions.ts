import type { Competition } from "@/db/schema";
import type { Format } from "@/lib/bracket/view";
import type { ProfilesByEmail } from "@/lib/profile";

export type CompetitionListItem = Pick<
  Competition,
  | "id"
  | "name"
  | "description"
  | "scoring"
  | "countsTowardTeam"
  | "competitionGroup"
  | "format"
>;

/**
 * The most places a Bracket can preset Placement Points for: its places
 * come only from the final (and the 3rd place Match), up to 4th.
 */
export const BRACKET_PLACEMENTS = 4;

/**
 * The most places a Competition of this Format can preset Placement Points
 * for, or null for no limit. The one place the rule lives: the Bracket
 * Format is limited; every other Format is not.
 */
export function placementLimit(format: Format): number | null {
  return format === "bracket" ? BRACKET_PLACEMENTS : null;
}

/** Why Placement Points can't have this many places for the Format, or null. */
export function placementLimitRefusal(
  format: Format,
  placementPoints: readonly number[] | null,
): string | null {
  const limit = placementLimit(format);
  if (limit === null || (placementPoints?.length ?? 0) <= limit) return null;
  return placementLimitMessage(limit);
}

/** The one wording for Placement Points over a Format's `placementLimit`. */
export function placementLimitMessage(limit: number): string {
  return `Placement Points cover at most ${limit} places for this Format.`;
}

/**
 * The Placement Points preset for a place (1 = 1st), or null when the
 * Competition has no preset for it.
 */
export function pointsForPlacement(
  competition: Pick<Competition, "placementPoints">,
  place: number,
): number | null {
  if (!Number.isInteger(place) || place < 1) return null;
  return competition.placementPoints?.[place - 1] ?? null;
}

/**
 * Whether a Competition has Placement Points, so closing its Bracket or
 * closing its Matches or Attempts creates Points Entries.
 */
export function hasPlacementPoints(placementPoints: number[] | null): boolean {
  return placementPoints !== null && placementPoints.length > 0;
}

const ORDINAL_SUFFIXES = ["st", "nd", "rd"];

/** "1st", "2nd", "3rd", "4th", "5th". */
export function placementLabel(place: number): string {
  return `${place}${ORDINAL_SUFFIXES[place - 1] ?? "th"}`;
}

export type CompetitionGroups<T> = {
  groups: { name: string; competitions: T[] }[];
  ungrouped: T[];
};

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

/**
 * Groups Competitions by Competition Group for the Competitions list.
 * Groups and the Competitions within each are ordered by name; Competitions
 * with no group are returned separately.
 */
export function groupCompetitions<
  T extends Pick<Competition, "name" | "competitionGroup">,
>(competitions: T[]): CompetitionGroups<T> {
  const groups = new Map<string, T[]>();
  const ungrouped: T[] = [];
  for (const competition of competitions) {
    const group = competition.competitionGroup;
    if (group === null) {
      ungrouped.push(competition);
    } else {
      groups.set(group, [...(groups.get(group) ?? []), competition]);
    }
  }

  return {
    groups: [...groups]
      .map(([name, inGroup]) => ({ name, competitions: inGroup.sort(byName) }))
      .sort(byName),
    ungrouped: ungrouped.sort(byName),
  };
}

/** "Team", "Individual", or "Individual · counts toward <Team Label>". */
export function describeScoring(
  competition: Pick<Competition, "scoring" | "countsTowardTeam">,
  teamLabel: string,
): string {
  if (competition.scoring === "team") return "Team";
  return competition.countsTowardTeam
    ? `Individual · counts toward ${teamLabel}`
    : "Individual";
}

/**
 * A Host as the admin Competitions row shows them: their Profile name, else
 * their email (Hosts are email-keyed and need not be Participants).
 */
export function hostName(email: string, profiles: ProfilesByEmail): string {
  return profiles.get(email.trim().toLowerCase())?.profileName || email;
}

/**
 * A Competition's one admin page (ticket 101): its Settings and its
 * Format's run area. Every old setup route redirects here.
 */
export function competitionPageHref(id: string): string {
  return `/admin/competitions/${id}`;
}
