/**
 * The Finale's slides (CONTEXT.md, "Finale rules"): which slides a War Week
 * shows, in what order, and what each one needs to render. Pure: the page
 * loads the rows and the data; the slideshow steps through them.
 */
import { z } from "zod";

import type { Competition, WarWeek } from "@/db/schema";
import { type AwardView, groupAwardsByCategory } from "@/lib/awards";
import {
  type CustomSlideColors,
  customSlideColors,
  customSlideFields,
} from "@/lib/custom-finale-slide";
import {
  FINALE_AWARDS_LAYOUTS,
  FINALE_SLIDE_KINDS,
  type FinaleAwardsLayout,
  type FinaleSlideKind,
} from "@/lib/enums";
import { formatPoints } from "@/lib/points";
import {
  type ResultCompetition,
  type ResultEntry,
  type ResultTarget,
  finalWinners,
} from "@/lib/recent-results";
import type { Parsed } from "@/lib/result";
import type { Content } from "@/lib/rich-text/content";
import type { Standings } from "@/lib/standings";
import { defaultWinner, tieTitle } from "@/lib/war-week-lifecycle";

/** The built-in slides, in their default order. */
export const BUILT_IN_FINALE_SLIDE_KINDS = FINALE_SLIDE_KINDS.filter(
  (kind): kind is Exclude<FinaleSlideKind, "custom"> => kind !== "custom",
);

export type BuiltInFinaleSlideKind =
  (typeof BUILT_IN_FINALE_SLIDE_KINDS)[number];

/** What the admin list and the slideshow call each built-in slide. */
export const BUILT_IN_FINALE_SLIDE_NAMES: Record<
  BuiltInFinaleSlideKind,
  string
> = {
  title: "Title",
  numbers: "By the numbers",
  awards: "Awards",
  champions: "Champions",
  standings: "Standings countdown",
  winner: "Winner",
};

/**
 * One slide in a seed file's `finaleSlides` list (its place is its order):
 * a built-in by kind, or a Custom slide with a heading, an optional body
 * and an optional background (`customSlideFields`).
 */
export const finaleSlideSeedSchema = z
  .object({
    kind: z.enum(FINALE_SLIDE_KINDS),
    hidden: z.boolean().default(false),
    heading: customSlideFields.heading.optional(),
    body: customSlideFields.body.optional(),
    backgroundColor: customSlideFields.backgroundColor.optional(),
  })
  .superRefine((slide, ctx) => {
    if (slide.kind === "custom") {
      if (slide.heading === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["heading"],
          message: "a Custom slide needs a heading",
        });
      }
      return;
    }
    for (const field of ["heading", "body", "backgroundColor"] as const) {
      if (slide[field] !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `only a Custom slide has a ${field}`,
        });
      }
    }
  });

export type FinaleSlideSeed = z.infer<typeof finaleSlideSeedSchema>;

/** A saved `finale_slide` row, as the resolution reads it. */
export type FinaleSlideRow = {
  id: string;
  kind: FinaleSlideKind;
  sortOrder: number;
  hidden: boolean;
  heading: string | null;
  body: Content | null;
  backgroundColor: string | null;
};

/**
 * One slide in a War Week's list: a saved row, or (`id` and `sortOrder`
 * null) a built-in not saved yet. `key` is the kind for a built-in and the
 * id for a Custom slide, unique within the list. `sortOrder` is the row's
 * stored one, which can differ from its place in the list.
 */
export type ResolvedFinaleSlide = {
  key: string;
  id: string | null;
  sortOrder: number | null;
  kind: FinaleSlideKind;
  name: string;
  hidden: boolean;
  heading: string | null;
  body: Content | null;
  backgroundColor: string | null;
};

/** How an action names a slide: a built-in by kind, a Custom slide by id. */
export type FinaleSlideRef = { kind: BuiltInFinaleSlideKind } | { id: string };

function builtIn(kind: BuiltInFinaleSlideKind): ResolvedFinaleSlide {
  return {
    key: kind,
    id: null,
    sortOrder: null,
    kind,
    name: BUILT_IN_FINALE_SLIDE_NAMES[kind],
    hidden: false,
    heading: null,
    body: null,
    backgroundColor: null,
  };
}

/**
 * A War Week's slide list. No rows: the default order, nothing hidden.
 * Otherwise the rows by `sortOrder` (then id), with any built-in missing
 * from them appended in its default relative order, so a new built-in
 * shows up without a migration. Hidden slides stay in the list (the admin
 * list shows them); `visibleFinaleSlides` drops them.
 */
export function resolveFinaleSlides(
  rows: FinaleSlideRow[],
): ResolvedFinaleSlide[] {
  const saved = [...rows]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .map((row): ResolvedFinaleSlide => {
      const isBuiltIn = row.kind !== "custom";
      return {
        key: isBuiltIn ? row.kind : row.id,
        id: row.id,
        sortOrder: row.sortOrder,
        kind: row.kind,
        name:
          row.kind === "custom"
            ? (row.heading ?? "Custom slide")
            : BUILT_IN_FINALE_SLIDE_NAMES[row.kind],
        hidden: row.hidden,
        heading: row.heading,
        body: row.body,
        backgroundColor: row.backgroundColor,
      };
    });
  const savedKinds = new Set(saved.map((slide) => slide.kind));
  const missing = BUILT_IN_FINALE_SLIDE_KINDS.filter(
    (kind) => !savedKinds.has(kind),
  ).map(builtIn);
  return [...saved, ...missing];
}

/** The slides the Finale plays: the list without its hidden slides. */
export function visibleFinaleSlides<T extends { hidden: boolean }>(
  slides: T[],
): T[] {
  return slides.filter((slide) => !slide.hidden);
}

/** Whether `slide` is the one `ref` names. */
export function isFinaleSlide(
  slide: Pick<ResolvedFinaleSlide, "id" | "kind">,
  ref: FinaleSlideRef,
): boolean {
  return "kind" in ref
    ? slide.kind === ref.kind
    : slide.kind === "custom" && slide.id === ref.id;
}

/**
 * How the admin list names a saved Custom slide (by id) or a built-in (by
 * kind) in a request; null for a Custom slide without an id, which can't
 * happen for a listed one.
 */
export function finaleSlideRef(
  slide: Pick<ResolvedFinaleSlide, "id" | "kind">,
): FinaleSlideRef | null {
  if (slide.kind !== "custom") return { kind: slide.kind };
  return slide.id === null ? null : { id: slide.id };
}

const SLIDE_NOT_FOUND = "That Finale slide no longer exists.";

/** A built-in by kind, or a Custom slide by id. */
const slideRefSchema = z.union([
  z.strictObject({ kind: z.enum(BUILT_IN_FINALE_SLIDE_KINDS) }),
  z.strictObject({ id: z.uuid() }),
]);

/**
 * Parses a request naming one slide plus `fields`; a slide that doesn't
 * parse is refused as gone, anything else with `invalid`.
 */
function parseSlideRequest<T extends z.ZodRawShape>(
  fields: T,
  input: unknown,
  invalid: string,
) {
  const parsed = z
    .object({ slide: slideRefSchema, ...fields })
    .safeParse(input);
  if (parsed.success) return { ok: true as const, value: parsed.data };
  const slide = (input as { slide?: unknown } | null)?.slide;
  return {
    ok: false as const,
    error: slideRefSchema.safeParse(slide).success ? invalid : SLIDE_NOT_FOUND,
  };
}

/** Validates a Move request: the slide and the index it goes to. */
export function parseFinaleSlideMove(
  input: unknown,
): Parsed<{ slide: FinaleSlideRef; toIndex: number }> {
  return parseSlideRequest(
    { toIndex: z.number().int().min(0) },
    input,
    "Move a Finale slide to a place in the list.",
  );
}

/** Validates a Hide or Show request: the slide and whether it's hidden. */
export function parseFinaleSlideHidden(
  input: unknown,
): Parsed<{ slide: FinaleSlideRef; hidden: boolean }> {
  return parseSlideRequest(
    { hidden: z.boolean() },
    input,
    "Hide or show a Finale slide.",
  );
}

/** Validates an Awards layout: "one-slide" or "per-category". */
export function parseFinaleAwardsLayout(
  input: unknown,
): Parsed<FinaleAwardsLayout> {
  const parsed = z.enum(FINALE_AWARDS_LAYOUTS).safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: "Pick how the Finale shows Awards." };
}

/**
 * `ids` with `id` moved to `index` (clamped to the list), or null when
 * `id` isn't in the list.
 */
export function moveToIndex(
  ids: string[],
  id: string,
  index: number,
): string[] | null {
  const from = ids.indexOf(id);
  if (from === -1) return null;
  const to = Math.max(0, Math.min(ids.length - 1, Math.trunc(index)));
  const moved = ids.filter((other) => other !== id);
  moved.splice(to, 0, id);
  return moved;
}

/** What every slide carries, whatever its kind. */
type SlideBase = { key: string; name: string };

/**
 * The War Week's figures for the By the numbers slide (`getFinaleCounts`).
 * `pointsHandedOut` sums every Points Entry, generated ones included: it
 * is not a Standings total.
 */
export type FinaleCounts = {
  /** Competitions with at least one Points Entry. */
  competitionsRun: number;
  /** Games logged in Head-to-head or Best score Competitions. */
  gamesLogged: number;
  /** Heats played (a forfeit is not played). */
  heatsPlayed: number;
  pointsEntries: number;
  pointsHandedOut: number;
  /** The War Week's roster. */
  participants: number;
};

/** One figure on the By the numbers slide: "18" over "Points Entries". */
export type FinaleFigure = { label: string; value: string };

const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Each figure's label, in the slide's order: plural, then singular. */
const FIGURES: [keyof FinaleCounts, string, string][] = [
  ["competitionsRun", "Competitions run", "Competition run"],
  ["gamesLogged", "Games logged", "Game logged"],
  ["heatsPlayed", "Heats played", "Heat played"],
  ["pointsEntries", "Points Entries", "Points Entry"],
  ["pointsHandedOut", "Points handed out", "Point handed out"],
  ["participants", "Participants", "Participant"],
];

/**
 * The By the numbers slide's figures, in order, without the zeros
 * (CONTEXT.md, "Finale rules"). Counts are grouped by thousands; the
 * points read as the leaderboard shows them. Empty when every figure is
 * zero, so the slide is skipped.
 */
export function byTheNumbers(counts: FinaleCounts): FinaleFigure[] {
  return FIGURES.flatMap(([field, plural, singular]) => {
    const value = counts[field];
    if (value === 0) return [];
    const shown =
      field === "pointsHandedOut" ? formatPoints(value) : count.format(value);
    return [{ label: shown === "1" ? singular : plural, value: shown }];
  });
}

/** One line of the Champions slide. */
export type FinaleChampion = {
  competitionId: string;
  competition: string;
  format: Competition["format"];
  /** "Champion" for a Bracket's, "Winner" for a closed Competition's. */
  label: "Champion" | "Winner";
  /** The winner's name, or "Tie: A & B" (`tieTitle`). */
  title: string;
  /** More than one on a tie for first. */
  winners: ResultTarget[];
};

/**
 * The Champions slide's lines: every finalized Bracket's champion and every
 * Finalized Placement's or closed Head-to-head, Best score or team-scoring `participation`
 * Competition's winner (ties
 * listed together), by the rule Recent results uses (`finalWinners`), never
 * capped, ordered by when each was finalized or closed. An
 * individual-scoring Participation Competition has no winner and is left
 * out.
 */
export function championsList(
  competitions: ResultCompetition[],
  entries: ResultEntry[],
): FinaleChampion[] {
  return finalWinners(competitions, entries)
    .filter((final) => final.winners.length > 0)
    .sort(
      (a, b) =>
        a.competition.finalizedAt.getTime() -
          b.competition.finalizedAt.getTime() ||
        a.competition.name.localeCompare(b.competition.name),
    )
    .map(({ competition, winners }) => ({
      competitionId: competition.id,
      competition: competition.name,
      format: competition.format,
      label:
        competition.format === "single-elimination" ||
        competition.format === "heats"
          ? "Champion"
          : "Winner",
      title: tieTitle(winners.map((winner) => winner.name)),
      winners,
    }));
}

/** An Award as the Awards slide shows it. */
export type FinaleAward = {
  id: string;
  name: string;
  description: string | null;
  team: { name: string; color: string } | null;
  participants: {
    id: string;
    displayName: string;
    image?: string | null;
    teamColor: string | null;
  }[];
};

/** A heading's worth of Awards on an Awards slide; `name` null: no heading. */
export type FinaleAwardGroup = {
  key: string;
  name: string | null;
  awards: FinaleAward[];
};

/** What the Winner slide shows of each row tied at first place. */
export type FinaleWinnerRow = {
  id: string;
  name: string;
  /** Formatted as the leaderboard shows it. */
  total: string;
  /** The Team's color (a Team, or a Participant's Team); null without one. */
  color: string | null;
  image?: string | null;
  kind: "team" | "participant";
};

/**
 * What one Finale slide needs to render, by kind (the slideshow's `kind →
 * component` switch reads it).
 */
export type FinaleSlideData =
  | (SlideBase & {
      kind: "title";
      edition: string;
      year: number;
      storyTheme: string;
      logoUrl: string | null;
      bannerUrl: string | null;
    })
  | (SlideBase & { kind: "numbers"; figures: FinaleFigure[] })
  | (SlideBase & {
      kind: "awards";
      /** "Awards", or the Category's name on a per-Category slide. */
      heading: string;
      groups: FinaleAwardGroup[];
      primaryColor: string;
    })
  | (SlideBase & {
      kind: "champions";
      champions: FinaleChampion[];
      primaryColor: string;
    })
  | (SlideBase & {
      kind: "standings";
      /** The page's one `getStandings` result, shown as is. */
      standings: Standings;
      teamLabel: string;
      /** The Appearance Theme primary color, for Avatars with no Team. */
      primaryColor: string;
    })
  | (SlideBase & {
      kind: "winner";
      /** "Red", or "Tie: Red & Blue" (`defaultWinner`'s wording). */
      title: string;
      tie: boolean;
      rows: FinaleWinnerRow[];
      primaryColor: string;
    })
  | (SlideBase & {
      kind: "custom";
      heading: string;
      body: Content | null;
      backgroundColor: string | null;
      /**
       * Text colors that read on `backgroundColor` (null with none): the
       * stage overrides the theme's with them (`customSlideColors`).
       */
      colors: CustomSlideColors | null;
    });

/** Everything the page reads once for the slides' data. */
export type FinaleSlideContext = {
  warWeek: Pick<
    WarWeek,
    | "edition"
    | "year"
    | "storyTheme"
    | "logoUrl"
    | "bannerUrl"
    | "teamLabel"
    | "primaryColor"
    | "foregroundColor"
  > & { finaleAwardsLayout: FinaleAwardsLayout };
  /** The page's one `getStandings` result. */
  standings: Standings;
  counts: FinaleCounts;
  awards: AwardView[];
  champions: FinaleChampion[];
};

function finaleAward(award: AwardView): FinaleAward {
  return {
    id: award.id,
    name: award.name,
    description: award.description,
    team: award.team && { name: award.team.name, color: award.team.color },
    participants: award.participants.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      image: p.image ?? null,
      teamColor: p.teamColor,
    })),
  };
}

/** The Awards slide (or slides, one per Category), none without Awards. */
function awardSlides(
  base: SlideBase,
  context: FinaleSlideContext,
): FinaleSlideData[] {
  const groups = groupAwardsByCategory(context.awards);
  if (groups.length === 0) return [];
  const primaryColor = context.warWeek.primaryColor;
  // Headings (and per-Category slides) only once some Award has a
  // Category, as the Awards page.
  const headed = groups.some((group) => group.category !== null);
  const categoryName = (group: (typeof groups)[number]) =>
    group.category?.name ?? "Other Awards";
  const groupKey = (group: (typeof groups)[number]) =>
    group.category?.id ?? "other";

  if (headed && context.warWeek.finaleAwardsLayout === "per-category") {
    return groups.map((group) => ({
      kind: "awards",
      key: `${base.key}:${groupKey(group)}`,
      name: group.category ? `Awards: ${group.category.name}` : "Other Awards",
      heading: categoryName(group),
      groups: [
        {
          key: groupKey(group),
          name: null,
          awards: group.awards.map(finaleAward),
        },
      ],
      primaryColor,
    }));
  }
  return [
    {
      ...base,
      kind: "awards",
      heading: "Awards",
      groups: groups.map((group) => ({
        key: groupKey(group),
        name: headed ? categoryName(group) : null,
        awards: group.awards.map(finaleAward),
      })),
      primaryColor,
    },
  ];
}

/** The Winner slide: the main Standings' first place, ties together. */
function winnerSlide(
  base: SlideBase,
  context: FinaleSlideContext,
): FinaleSlideData[] {
  const { standings } = context;
  const title = defaultWinner(standings);
  if (title === "") return [];
  const rows: FinaleWinnerRow[] =
    standings.main === "team"
      ? standings.team
          .filter((row) => row.rank === 1)
          .map((row) => ({
            id: row.id,
            name: row.name,
            total: formatPoints(row.total),
            color: row.color,
            kind: "team",
          }))
      : standings.individual
          .filter((row) => row.rank === 1)
          .map((row) => ({
            id: row.id,
            name: row.name,
            total: formatPoints(row.total),
            color: row.team?.color ?? null,
            image: row.image ?? null,
            kind: "participant",
          }));
  return [
    {
      ...base,
      kind: "winner",
      title,
      tie: rows.length > 1,
      rows,
      primaryColor: context.warWeek.primaryColor,
    },
  ];
}

/**
 * Each slide the Finale plays, in order, with its data: the visible slides,
 * less any with nothing to show (By the numbers with every figure zero, no
 * Awards, no Champions, no Standings rows, or a Winner with every total
 * zero). In the per-Category Awards layout the Awards slide becomes one
 * slide per Category. The Standings countdown and the Winner read the
 * page's one `getStandings` result, so the Finale never recomputes
 * Standings.
 */
export function finaleSlideData(
  slides: ResolvedFinaleSlide[],
  context: FinaleSlideContext,
): FinaleSlideData[] {
  const { warWeek, standings } = context;
  const mainRows =
    standings.main === "team" ? standings.team : standings.individual;
  return visibleFinaleSlides(slides).flatMap((slide): FinaleSlideData[] => {
    const base = { key: slide.key, name: slide.name };
    switch (slide.kind) {
      case "title":
        return [
          {
            ...base,
            kind: "title",
            edition: warWeek.edition,
            year: warWeek.year,
            storyTheme: warWeek.storyTheme,
            logoUrl: warWeek.logoUrl,
            bannerUrl: warWeek.bannerUrl,
          },
        ];
      case "numbers": {
        const figures = byTheNumbers(context.counts);
        return figures.length > 0
          ? [{ ...base, kind: "numbers", figures }]
          : [];
      }
      case "awards":
        return awardSlides(base, context);
      case "champions":
        return context.champions.length > 0
          ? [
              {
                ...base,
                kind: "champions",
                champions: context.champions,
                primaryColor: warWeek.primaryColor,
              },
            ]
          : [];
      case "standings":
        return mainRows.length > 0
          ? [
              {
                ...base,
                kind: "standings",
                standings,
                teamLabel: warWeek.teamLabel,
                primaryColor: warWeek.primaryColor,
              },
            ]
          : [];
      case "winner":
        return winnerSlide(base, context);
      case "custom":
        return [
          {
            ...base,
            kind: "custom",
            heading: slide.heading ?? slide.name,
            body: slide.body,
            backgroundColor: slide.backgroundColor,
            colors: slide.backgroundColor
              ? customSlideColors(slide.backgroundColor, {
                  foreground: warWeek.foregroundColor,
                  primary: warWeek.primaryColor,
                })
              : null,
          },
        ];
    }
  });
}

/**
 * How many steps a slide reveals before Next moves on (the step protocol):
 * 0 shows everything on arrival; the Standings countdown is one step (its
 * countdown, finished by Next or by itself); an Awards slide reveals one
 * Award per step.
 */
export function finaleSlideSteps(data: FinaleSlideData): number {
  switch (data.kind) {
    case "standings":
      return 1;
    case "awards":
      return data.groups.reduce((sum, group) => sum + group.awards.length, 0);
    default:
      return 0;
  }
}

/** Where the presenter is: a slide, and how many of its steps are shown. */
export type FinalePosition = { index: number; step: number };

/**
 * Next (`→`, `Space`, `PageDown`, a click on the stage): the current
 * slide's next step, else the next slide on arrival (step 0). At the end
 * of the last slide it does nothing; nothing auto-advances. `steps` holds
 * each slide's `finaleSlideSteps`.
 */
export function nextFinalePosition(
  position: FinalePosition,
  steps: number[],
): FinalePosition {
  const { index, step } = position;
  if (step < (steps[index] ?? 0)) return { index, step: step + 1 };
  if (index < steps.length - 1) return { index: index + 1, step: 0 };
  return position;
}

/** Back (`←`, `PageUp`): the previous slide, every step shown. */
export function backFinalePosition(
  position: FinalePosition,
  steps: number[],
): FinalePosition {
  const index = position.index - 1;
  return index < 0 ? position : { index, step: steps[index] ?? 0 };
}

/**
 * A slide that finished by itself (the countdown landing): every step
 * shown, so Next moves on. Only while the presenter is still on it.
 */
export function completeFinaleSlide(
  position: FinalePosition,
  index: number,
  steps: number[],
): FinalePosition {
  if (position.index !== index) return position;
  const last = steps[index] ?? 0;
  return position.step === last ? position : { index, step: last };
}
