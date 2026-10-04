/**
 * Award names across War Weeks (CONTEXT.md, "Award presets and history by
 * name"): the preset list an Organizer adds an Award from, and the slug a
 * name's history page lives at. Pure; the queries load the rows.
 */

/**
 * The seven names that used to be seeded Award Categories. They are always
 * offered as presets, even before any War Week has an Award of that name.
 */
export const FORMER_CATEGORY_NAMES = [
  "War Week MVP",
  "Billable Hours Champ",
  "Black Midnight",
  "Grow",
  "Grind",
  "Serve",
  "Inspire",
] as const;

/**
 * The page slug of an Award name: lowercased, each run of non-alphanumeric
 * characters collapsed to one "-", none leading or trailing. Names that
 * differ only in case or punctuation share a slug, so they share a page.
 * Empty when the name has no letter or digit.
 */
export function awardNameSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** An Award name to offer when adding an Award. */
export type AwardPreset = { name: string; description: string | null };

/**
 * Every distinct Award name (one per slug, so case and punctuation don't
 * split a name) with its most recent description, then the former Category names not already there, by name.
 * `awards` must be newest first: the first spelling of a name wins, and the
 * most recent description that isn't empty.
 */
export function awardPresets(
  awards: { name: string; description: string | null }[],
): AwardPreset[] {
  const byName = new Map<string, AwardPreset>();
  for (const { name, description } of awards) {
    const key = awardNameSlug(name);
    if (!key) continue;
    const found = byName.get(key);
    if (!found) {
      byName.set(key, { name: name.trim(), description: description || null });
    } else if (!found.description && description) {
      found.description = description;
    }
  }
  for (const name of FORMER_CATEGORY_NAMES) {
    const key = awardNameSlug(name);
    if (!byName.has(key)) byName.set(key, { name, description: null });
  }
  return [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
}

/**
 * The distinct Award names to list, one per slug, by name. `names` must be
 * newest first: the first spelling of a name is the one shown. A name with
 * no slug (no letter or digit) has no page, so it isn't listed.
 */
export function awardNameList(
  names: string[],
): { slug: string; name: string }[] {
  const bySlug = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim();
    const slug = awardNameSlug(name);
    if (slug && !bySlug.has(slug)) bySlug.set(slug, name);
  }
  return [...bySlug.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );
}

/** One Award of a name, with its recipients, in a War Week. */
export type AwardHistoryAward = {
  id: string;
  name: string;
  team: { id: string; name: string; color: string } | null;
  /** The Profile name where linked, else the roster name. */
  participants: {
    id: string;
    displayName: string;
    /** That War Week's Team for them; null with none. */
    teamName?: string | null;
    teamColor?: string | null;
  }[];
};

/** One War Week's Awards of a name. */
export type AwardHistoryWarWeek = {
  edition: string;
  year: number;
  awards: AwardHistoryAward[];
};

/** An Award name through the years: War Weeks newest first. */
export type AwardNameHistory = {
  /** The most recent spelling. */
  name: string;
  warWeeks: AwardHistoryWarWeek[];
};
