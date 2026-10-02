import { z } from "zod";

import { fieldErrorsFrom } from "@/lib/form-errors";
import type { Parsed } from "@/lib/result";

/**
 * The seven seeded Award Categories, by key. The key is what a seed's
 * `category` names, so an Organizer's rename never breaks a seed; the names
 * are what the migration `seed-award-categories` inserts.
 */
export const SEEDED_AWARD_CATEGORIES = [
  { key: "war-week-mvp", name: "War Week MVP" },
  { key: "billable-hours-champ", name: "Billable Hours Champ" },
  { key: "black-midnight", name: "Black Midnight" },
  { key: "grow", name: "Grow" },
  { key: "grind", name: "Grind" },
  { key: "serve", name: "Serve" },
  { key: "inspire", name: "Inspire" },
] as const;

export type AwardCategoryKey = (typeof SEEDED_AWARD_CATEGORIES)[number]["key"];

/** The Award Category name's column length. */
export const AWARD_CATEGORY_NAME_MAX = 80;

const EXACT_NAMES: Record<string, AwardCategoryKey> = {
  "war week mvp": "war-week-mvp",
  mvp: "war-week-mvp",
  "mvp 1st place": "war-week-mvp",
  "billable hours champ": "billable-hours-champ",
  "billing hours champ": "billable-hours-champ",
  "black midnight": "black-midnight",
  grow: "grow",
  grind: "grind",
  serve: "serve",
  inspire: "inspire",
};

/**
 * The seeded Category an Award's name belongs to, or null. Case and
 * surrounding space don't matter. "MVP 2nd Place", "Hours Champ" and "Top
 * Billers" are deliberately none. Used once to tag the seed files;
 * `seeds.test.ts` keeps the tags equal to this answer.
 */
export function categoryKeyForAwardName(name: string): AwardCategoryKey | null {
  const normalized = name.trim().replace(/\s+/g, " ").toLowerCase();
  const exact = EXACT_NAMES[normalized];
  if (exact) return exact;
  if (/^midnight club(\s|$)/.test(normalized)) return "black-midnight";
  return null;
}

/** An Award Category form's input: the name, trimmed, 1 to 80 characters. */
export const awardCategoryInputSchema = z.object({
  name: z
    .string({ error: "Name must be text." })
    .trim()
    .min(1, { error: "Name must not be empty." })
    .max(AWARD_CATEGORY_NAME_MAX, {
      error: `Name must be at most ${AWARD_CATEGORY_NAME_MAX} characters.`,
    }),
});

export const AWARD_CATEGORY_NOT_FOUND = "That Category no longer exists.";

/** The Category an action names: a uuid, else it no longer exists. */
export const awardCategoryIdSchema = z.uuid({
  error: AWARD_CATEGORY_NOT_FOUND,
});

/** Parses an Award Category form's input. Never throws. */
export function parseAwardCategoryInput(
  input: unknown,
): Parsed<{ name: string }> {
  const result = awardCategoryInputSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, ...fieldErrorsFrom(result.error) };
}

/**
 * The Award's own name when it adds something to its Category's ("MVP 1st
 * Place" under War Week MVP); null when it just repeats it.
 */
export function awardNameUnderCategory(
  awardName: string,
  categoryName: string,
): string | null {
  const same =
    awardName.trim().toLowerCase() === categoryName.trim().toLowerCase();
  return same ? null : awardName;
}

/** One Award of a Category, with its recipients, in a War Week. */
export type CategoryHistoryAward = {
  id: string;
  name: string;
  team: { id: string; name: string; color: string } | null;
  /** The Profile name where linked, else the roster name. */
  participants: { id: string; displayName: string }[];
};

/** One War Week's Awards in a Category. */
export type CategoryHistoryWarWeek = {
  edition: string;
  year: number;
  awards: CategoryHistoryAward[];
};

/** A Category through the years: War Weeks newest first. */
export type CategoryHistory = {
  category: { id: string; name: string; archived: boolean };
  warWeeks: CategoryHistoryWarWeek[];
};
