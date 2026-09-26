import { and, eq, inArray, ne, or, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type WarWeek,
  competition,
  competitionHost,
  faqItem,
  warWeek,
} from "@/db/schema";
import {
  type ClosingValues,
  type NextWarWeekValues,
  moveError,
  transitionError,
} from "@/lib/war-week-lifecycle";
import { isUniqueViolation } from "@/mutations/setup";
import type { MutationResult } from "@/mutations/types";

const WAR_WEEK_NOT_FOUND = "That War Week no longer exists.";

/** The edition that is `live` now, other than `exceptId`, if any. */
async function liveEdition(
  dbOrTx: DBOrTx,
  exceptId: string,
): Promise<string | null> {
  const [live] = await dbOrTx
    .select({ edition: warWeek.edition })
    .from(warWeek)
    .where(and(eq(warWeek.status, "live"), ne(warWeek.id, exceptId)))
    .limit(1);
  return live?.edition ?? null;
}

/**
 * Moves a War Week to `to` when `transitionError` (and, for Start or
 * Reopen, `moveError`) allows it. A second
 * `live` War Week is refused by the check and, for a concurrent Start that
 * slipped past it, by the `war_week_one_live` index: both read
 * "End <EDITION> first."
 */
async function transition(
  warWeekId: string,
  to: WarWeek["status"],
  set: Partial<ClosingValues>,
  dbOrTx: DBOrTx,
  action?: "start" | "reopen",
): Promise<MutationResult> {
  try {
    return await dbOrTx.transaction(async (tx): Promise<MutationResult> => {
      const [row] = await tx
        .select({ status: warWeek.status })
        .from(warWeek)
        .where(eq(warWeek.id, warWeekId))
        .for("update");
      if (!row) return { ok: false, error: WAR_WEEK_NOT_FOUND };
      const refusal =
        (action && moveError(action, row.status)) ||
        transitionError(row.status, to, {
          liveEdition: await liveEdition(tx, warWeekId),
        });
      if (refusal) return { ok: false, error: refusal };
      await tx
        .update(warWeek)
        .set({ ...set, status: to, updatedAt: sql`now()` })
        .where(eq(warWeek.id, warWeekId));
      return { ok: true };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const live = await liveEdition(dbOrTx, warWeekId);
    return {
      ok: false,
      error: live
        ? `End ${live.toUpperCase()} first.`
        : "Another War Week just went live. Refresh and try again.",
    };
  }
}

/** Start War Week: `upcoming → live`, when no other War Week is live. */
export function startWarWeek(
  warWeekId: string,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return transition(warWeekId, "live", {}, dbOrTx, "start");
}

/** End War Week: `live → complete`, recording the Winner and highlights. */
export function endWarWeek(
  warWeekId: string,
  closing: ClosingValues,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return transition(warWeekId, "complete", closing, dbOrTx);
}

/** Reopen: `complete → live` for corrections, when nothing else is live. */
export function reopenWarWeek(
  warWeekId: string,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return transition(warWeekId, "live", {}, dbOrTx, "reopen");
}

/** Settings a new War Week gets when they aren't copied. */
const DEFAULT_SETTINGS = {
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
  fontPreset: "sans",
  logoUrl: null,
  bannerUrl: null,
} as const;

/** Why the new edition, edition number or year is taken, or null. */
async function takenError(
  values: NextWarWeekValues,
  dbOrTx: DBOrTx,
): Promise<string | null> {
  const [taken] = await dbOrTx
    .select({
      edition: warWeek.edition,
      editionNumber: warWeek.editionNumber,
      year: warWeek.year,
    })
    .from(warWeek)
    .where(
      or(
        eq(warWeek.edition, values.edition),
        eq(warWeek.editionNumber, values.editionNumber),
        eq(warWeek.year, values.year),
      ),
    )
    .limit(1);
  if (!taken) return null;
  const name = `War Week ${taken.edition.toUpperCase()}`;
  if (taken.edition === values.edition) return `${name} already exists.`;
  if (taken.editionNumber === values.editionNumber) {
    return `Edition number ${values.editionNumber} is already ${name}.`;
  }
  return `${values.year} already has ${name}.`;
}

/**
 * Create next War Week: inserts an `upcoming` War Week and the chosen
 * copies from `fromWarWeekId` in one transaction. Copies settings with the
 * Appearance Theme, Competitions (new ids, with their Hosts, no Points
 * Entries) and the FAQ as chosen; never Teams, roster, Days, Schedule,
 * Points Entries, Awards or Announcements. Organizers are global, so there
 * are none to copy. `actorEmail` is who asked; nothing records it yet.
 */
export async function createNextWarWeek(
  fromWarWeekId: string,
  values: NextWarWeekValues,
  actorEmail: string,
  dbOrTx: DBOrTx = db,
): Promise<{ ok: true; edition: string } | { ok: false; error: string }> {
  try {
    return await dbOrTx.transaction(async (tx) => {
      const [source] = await tx
        .select()
        .from(warWeek)
        .where(eq(warWeek.id, fromWarWeekId));
      if (!source) return { ok: false as const, error: WAR_WEEK_NOT_FOUND };
      const taken = await takenError(values, tx);
      if (taken) return { ok: false as const, error: taken };

      const settings = values.copySettings
        ? {
            mode: source.mode,
            teamLabel: source.teamLabel,
            leaderTitle: source.leaderTitle,
            slackChannelUrl: source.slackChannelUrl,
            wikiUrl: source.wikiUrl,
            primaryColor: source.primaryColor,
            primaryForegroundColor: source.primaryForegroundColor,
            accentColor: source.accentColor,
            backgroundColor: source.backgroundColor,
            foregroundColor: source.foregroundColor,
            fontPreset: source.fontPreset,
            logoUrl: source.logoUrl,
            bannerUrl: source.bannerUrl,
          }
        : DEFAULT_SETTINGS;

      const [created] = await tx
        .insert(warWeek)
        .values({
          edition: values.edition,
          editionNumber: values.editionNumber,
          year: values.year,
          startDate: values.startDate,
          endDate: values.endDate,
          storyTheme: values.storyTheme,
          status: "upcoming",
          ...settings,
        })
        .returning({ id: warWeek.id });

      if (values.copyCompetitions) {
        const competitions = await tx
          .select()
          .from(competition)
          .where(eq(competition.warWeekId, source.id));
        if (competitions.length > 0) {
          const copies = await tx
            .insert(competition)
            .values(
              competitions.map((c) => ({
                warWeekId: created.id,
                name: c.name,
                description: c.description,
                maxPoints: c.maxPoints,
                placementPoints: c.placementPoints,
                scoring: c.scoring,
                countsTowardTeam: c.countsTowardTeam,
                competitionGroup: c.competitionGroup,
              })),
            )
            .returning({ id: competition.id, name: competition.name });
          // Names are unique per War Week, so they pair each copy with its
          // source.
          const copyIdByName = new Map(copies.map((c) => [c.name, c.id]));
          const hosts = await tx
            .select({
              competitionId: competitionHost.competitionId,
              email: competitionHost.email,
            })
            .from(competitionHost)
            .where(
              inArray(
                competitionHost.competitionId,
                competitions.map((c) => c.id),
              ),
            );
          const sourceNameById = new Map(
            competitions.map((c) => [c.id, c.name]),
          );
          if (hosts.length > 0) {
            await tx.insert(competitionHost).values(
              hosts.map((h) => ({
                competitionId: copyIdByName.get(
                  sourceNameById.get(h.competitionId)!,
                )!,
                email: h.email,
              })),
            );
          }
        }
      }

      if (values.copyFaq) {
        const items = await tx
          .select()
          .from(faqItem)
          .where(eq(faqItem.warWeekId, source.id));
        if (items.length > 0) {
          await tx.insert(faqItem).values(
            items.map((item) => ({
              warWeekId: created.id,
              question: item.question,
              answer: item.answer,
              sortOrder: item.sortOrder,
            })),
          );
        }
      }

      return { ok: true as const, edition: values.edition };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Another Organizer took the edition, number or year meanwhile.
    return {
      ok: false,
      error:
        (await takenError(values, dbOrTx)) ??
        "That War Week already exists. Refresh and try again.",
    };
  }
}
