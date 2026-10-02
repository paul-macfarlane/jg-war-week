import { type SQL, and, eq, ne, notInArray, sql } from "drizzle-orm";
import type {
  IndexColumn,
  PgColumn,
  PgInsertValue,
  PgTable,
  PgUpdateSetSource,
} from "drizzle-orm/pg-core";

import { DBOrTx, DBTx, db } from "@/db";
import {
  WarWeek,
  announcement,
  award,
  awardParticipant,
  competition,
  day,
  faqItem,
  organizer,
  participant,
  pointsEntry,
  scheduleItem,
  team,
  warWeek,
} from "@/db/schema";
import type { GamesConfig } from "@/lib/games/config";
import { WarWeekSeed } from "@/seed/schema";

/**
 * Loads a validated War Week seed in one transaction. See CONTEXT.md, "Seed
 * idempotence rules":
 *
 * - `war_week` is upserted by `edition`; `status`, `winner` and
 *   `highlights` are set only on first insert. A `live` seed that would
 *   make a second live War Week is refused.
 * - Setup data (Days, Schedule Items, Teams, Participants, Competitions, FAQ
 *   Items) is upserted by natural key and anything absent from the seed is
 *   deleted, so setup always matches the seed after a load.
 * - Organizer-owned data (Points Entries, Awards, Announcements) is inserted
 *   by seed key only when absent, and never updated or deleted.
 * - The seed's `organizers` are added to the global Organizer list when
 *   missing; a load never removes an Organizer, even with `reset`.
 *
 * `reset` first deletes the War Week and everything under it, including
 * organizer-owned data and its Competitions' Hosts, so the load starts from
 * exactly the seed. Use it to
 * reset demo data, never on a War Week organizers are running.
 */
export async function loadWarWeekSeed(
  seed: WarWeekSeed,
  dbOrTx: DBOrTx = db,
  { reset = false }: { reset?: boolean } = {},
): Promise<WarWeek> {
  return dbOrTx.transaction(async (tx) => {
    if (reset) {
      await tx.delete(warWeek).where(eq(warWeek.edition, seed.edition));
    }
    const warWeekRow = await upsertWarWeek(tx, seed);
    const warWeekId = warWeekRow.id;
    await insertOrganizers(tx, seed);

    const teamIds = await syncTeams(tx, warWeekId, seed);
    const participantIds = await syncParticipants(tx, warWeekId, seed, teamIds);
    const competitionIds = await syncCompetitions(tx, warWeekId, seed);
    await syncDays(tx, warWeekId, seed, competitionIds);
    await syncFaqItems(tx, warWeekId, seed);

    await insertPointsEntries(
      tx,
      seed,
      competitionIds,
      teamIds,
      participantIds,
    );
    await insertAwards(tx, warWeekId, seed, teamIds, participantIds);
    await insertAnnouncements(tx, warWeekId, seed);

    return warWeekRow;
  });
}

/** Resolves a seed reference that the seed schema has already checked. */
function resolve(ids: Map<string, string>, name: string): string {
  const id = ids.get(name);
  if (!id) {
    throw new Error(`Seed reference "${name}" did not resolve`);
  }
  return id;
}

function resolveOptional(
  ids: Map<string, string>,
  name: string | null | undefined,
): string | null {
  return name == null ? null : resolve(ids, name);
}

async function upsertWarWeek(tx: DBTx, seed: WarWeekSeed): Promise<WarWeek> {
  const values = {
    edition: seed.edition,
    editionNumber: seed.editionNumber,
    year: seed.year,
    startDate: seed.startDate,
    endDate: seed.endDate,
    storyTheme: seed.storyTheme,
    mode: seed.mode,
    teamLabel: seed.teamLabel,
    leaderTitle: seed.leaderTitle,
    slackChannelUrl: seed.slackChannelUrl,
    primaryColor: seed.primary,
    primaryForegroundColor: seed.primaryForeground,
    accentColor: seed.accent,
    backgroundColor: seed.background,
    foregroundColor: seed.foreground,
    overridePrimaryColor: seed.overridePrimary ?? null,
    overridePrimaryForegroundColor: seed.overridePrimaryForeground ?? null,
    overrideAccentColor: seed.overrideAccent ?? null,
    overrideBackgroundColor: seed.overrideBackground ?? null,
    overrideForegroundColor: seed.overrideForeground ?? null,
    logoUrl: seed.logoUrl ?? null,
    bannerUrl: seed.bannerUrl ?? null,
    fontPreset: seed.fontPreset,
    wikiUrl: seed.wikiUrl ?? null,
    updatedAt: new Date(),
  };

  if (seed.status === "live") await refuseSecondLive(tx, seed.edition);

  // Seed-initialized only: the lifecycle actions own these once it exists.
  const [row] = await tx
    .insert(warWeek)
    .values({
      ...values,
      status: seed.status,
      winner: seed.winner ?? null,
      highlights: seed.highlights,
    })
    .onConflictDoUpdate({ target: warWeek.edition, set: values })
    .returning();
  return row;
}

/**
 * A `live` seed for a War Week that doesn't exist yet would make a second
 * live War Week (the `war_week_one_live` index refuses it too): say which
 * one to end instead of a bare constraint error.
 */
async function refuseSecondLive(tx: DBTx, edition: string) {
  const [existing] = await tx
    .select({ id: warWeek.id })
    .from(warWeek)
    .where(eq(warWeek.edition, edition));
  if (existing) return;
  const [live] = await tx
    .select({ edition: warWeek.edition })
    .from(warWeek)
    .where(and(eq(warWeek.status, "live"), ne(warWeek.edition, edition)))
    .limit(1);
  if (live) {
    throw new Error(
      `Seed "${edition}" is live, but War Week ${live.edition.toUpperCase()} is already live. End it first or give the seed another status.`,
    );
  }
}

/** Adds the seed's Organizers that aren't already on the list. */
async function insertOrganizers(tx: DBTx, seed: WarWeekSeed) {
  if (!seed.organizers.length) return;
  await tx
    .insert(organizer)
    .values(seed.organizers.map((email) => ({ email })))
    .onConflictDoNothing({ target: organizer.email });
}

/**
 * Keeps one table's rows under a War Week (or a Day) equal to the seed:
 * upserts the seed's `rows` by their natural key (`target`, rewriting
 * `set`), then deletes the rows in `scope` whose `key` isn't among those
 * `keep` returns. Returns the upserted rows.
 */
async function upsertDeletingAbsent<T extends PgTable>(
  tx: DBTx,
  table: T,
  spec: {
    rows: PgInsertValue<T>[];
    target: IndexColumn | IndexColumn[];
    set: PgUpdateSetSource<T>;
    scope: SQL;
    key: PgColumn;
    keep: (upserted: T["$inferSelect"][]) => unknown[];
  },
): Promise<T["$inferSelect"][]> {
  const upserted = (
    spec.rows.length
      ? await tx
          .insert(table)
          .values(spec.rows)
          .onConflictDoUpdate({ target: spec.target, set: spec.set })
          .returning()
      : []
  ) as T["$inferSelect"][];
  await tx
    .delete(table)
    .where(and(spec.scope, notInArray(spec.key, spec.keep(upserted))));
  return upserted;
}

async function syncTeams(
  tx: DBTx,
  warWeekId: string,
  seed: WarWeekSeed,
): Promise<Map<string, string>> {
  const rows = await upsertDeletingAbsent(tx, team, {
    rows: seed.teams.map((t) => ({
      warWeekId,
      name: t.name,
      color: t.color,
      logoUrl: t.logoUrl ?? null,
    })),
    target: [team.warWeekId, team.name],
    set: {
      color: sql`excluded.color`,
      logoUrl: sql`excluded.logo_url`,
      updatedAt: new Date(),
    },
    scope: eq(team.warWeekId, warWeekId),
    key: team.name,
    keep: () => seed.teams.map((t) => t.name),
  });
  return new Map(rows.map((r) => [r.name, r.id]));
}

async function syncParticipants(
  tx: DBTx,
  warWeekId: string,
  seed: WarWeekSeed,
  teamIds: Map<string, string>,
): Promise<Map<string, string>> {
  // Clear the rows' emails before the upsert rewrites them, so an email
  // that moved between two Participants cannot hit the unique constraint.
  await tx
    .update(participant)
    .set({ email: null })
    .where(eq(participant.warWeekId, warWeekId));

  const rows = await upsertDeletingAbsent(tx, participant, {
    rows: seed.participants.map((p) => ({
      warWeekId,
      displayName: p.displayName,
      companyTag: p.companyTag ?? null,
      email: p.email ?? null,
      teamId: resolveOptional(teamIds, p.team),
      isLeader: p.isLeader,
    })),
    target: [participant.warWeekId, participant.displayName],
    set: {
      companyTag: sql`excluded.company_tag`,
      email: sql`excluded.email`,
      teamId: sql`excluded.team_id`,
      isLeader: sql`excluded.is_leader`,
      updatedAt: new Date(),
    },
    scope: eq(participant.warWeekId, warWeekId),
    key: participant.displayName,
    keep: () => seed.participants.map((p) => p.displayName),
  });
  return new Map(rows.map((r) => [r.displayName, r.id]));
}

async function syncCompetitions(
  tx: DBTx,
  warWeekId: string,
  seed: WarWeekSeed,
): Promise<Map<string, string>> {
  const rows = await upsertDeletingAbsent(tx, competition, {
    rows: seed.competitions.map((c) => ({
      warWeekId,
      name: c.name,
      description: c.description ?? null,
      maxPoints: c.maxPoints ?? null,
      placementPoints: c.placementPoints ?? null,
      scoring: c.scoring,
      countsTowardTeam: c.countsTowardTeam,
      competitionGroup: c.group ?? null,
      format: c.format,
      bracketConfig: c.bracketConfig ?? null,
      gameType: c.gameType ?? null,
      // Checked against the Game Type by `competitionSeedSchema`.
      gameConfig: (c.gameConfig ?? null) as GamesConfig | null,
      entrantsOpen: c.entrantsOpen ?? false,
    })),
    target: [competition.warWeekId, competition.name],
    set: {
      description: sql`excluded.description`,
      maxPoints: sql`excluded.max_points`,
      placementPoints: sql`excluded.placement_points`,
      scoring: sql`excluded.scoring`,
      countsTowardTeam: sql`excluded.counts_toward_team`,
      competitionGroup: sql`excluded.competition_group`,
      // `format`, `bracketConfig`, `gameType`, `gameConfig` and
      // `entrantsOpen` are set on insert only: a reload must never turn an
      // Organizer's Bracket back into `points` or undo its Heats or Games
      // settings.
      updatedAt: new Date(),
    },
    scope: eq(competition.warWeekId, warWeekId),
    key: competition.name,
    keep: () => seed.competitions.map((c) => c.name),
  });
  return new Map(rows.map((r) => [r.name, r.id]));
}

async function syncDays(
  tx: DBTx,
  warWeekId: string,
  seed: WarWeekSeed,
  competitionIds: Map<string, string>,
) {
  const days = await upsertDeletingAbsent(tx, day, {
    rows: seed.days.map((d) => ({
      warWeekId,
      date: d.date,
      dayTheme: d.dayTheme,
      description: d.description?.trim() || null,
    })),
    target: [day.warWeekId, day.date],
    set: {
      dayTheme: sql`excluded.day_theme`,
      description: sql`excluded.description`,
      updatedAt: new Date(),
    },
    scope: eq(day.warWeekId, warWeekId),
    key: day.date,
    keep: () => seed.days.map((d) => d.date),
  });
  const dayIds = new Map(days.map((d) => [d.date, d.id]));

  for (const daySeed of seed.days) {
    const dayId = resolve(dayIds, daySeed.date);
    // A Schedule Item's natural key includes its time and title, so the
    // absent ones are found by the ids the upsert kept.
    await upsertDeletingAbsent(tx, scheduleItem, {
      rows: daySeed.scheduleItems.map((item) => ({
        dayId,
        startTime: item.startTime,
        endTime: item.endTime ?? null,
        title: item.title,
        host: item.host ?? null,
        location: item.location ?? null,
        virtualLink: item.virtualLink ?? null,
        description: item.description ?? null,
        category: item.category,
        competitionId: resolveOptional(competitionIds, item.competition),
      })),
      target: [scheduleItem.dayId, scheduleItem.startTime, scheduleItem.title],
      set: {
        endTime: sql`excluded.end_time`,
        host: sql`excluded.host`,
        location: sql`excluded.location`,
        virtualLink: sql`excluded.virtual_link`,
        description: sql`excluded.description`,
        category: sql`excluded.category`,
        competitionId: sql`excluded.competition_id`,
        updatedAt: new Date(),
      },
      scope: eq(scheduleItem.dayId, dayId),
      key: scheduleItem.id,
      keep: (kept) => kept.map((k) => k.id),
    });
  }
}

async function syncFaqItems(tx: DBTx, warWeekId: string, seed: WarWeekSeed) {
  await upsertDeletingAbsent(tx, faqItem, {
    rows: seed.faqItems.map((f, index) => ({
      warWeekId,
      question: f.question,
      answer: f.answer,
      sortOrder: index,
    })),
    target: [faqItem.warWeekId, faqItem.question],
    set: {
      answer: sql`excluded.answer`,
      sortOrder: sql`excluded.sort_order`,
      updatedAt: new Date(),
    },
    scope: eq(faqItem.warWeekId, warWeekId),
    key: faqItem.question,
    keep: () => seed.faqItems.map((f) => f.question),
  });
}

async function insertPointsEntries(
  tx: DBTx,
  seed: WarWeekSeed,
  competitionIds: Map<string, string>,
  teamIds: Map<string, string>,
  participantIds: Map<string, string>,
) {
  if (!seed.pointsEntries.length) return;
  await tx
    .insert(pointsEntry)
    .values(
      seed.pointsEntries.map((e) => ({
        competitionId: resolve(competitionIds, e.competition),
        teamId: resolveOptional(teamIds, e.team),
        participantId: resolveOptional(participantIds, e.participant),
        points: e.points,
        note: e.note ?? null,
        enteredByEmail: e.enteredByEmail,
        enteredAt: new Date(e.enteredAt),
        seedKey: e.key,
      })),
    )
    .onConflictDoNothing({
      target: [pointsEntry.competitionId, pointsEntry.seedKey],
    });
}

async function insertAwards(
  tx: DBTx,
  warWeekId: string,
  seed: WarWeekSeed,
  teamIds: Map<string, string>,
  participantIds: Map<string, string>,
) {
  if (!seed.awards.length) return;
  // Only the Awards actually inserted get recipients; an Award that already
  // exists keeps whatever recipients organizers have given it.
  const inserted = await tx
    .insert(award)
    .values(
      seed.awards.map((a) => ({
        warWeekId,
        name: a.name,
        description: a.description ?? null,
        teamId: resolveOptional(teamIds, a.team),
        seedKey: a.key,
      })),
    )
    .onConflictDoNothing({ target: [award.warWeekId, award.seedKey] })
    .returning({ id: award.id, seedKey: award.seedKey });

  const insertedKeys = new Map(inserted.map((a) => [a.seedKey, a.id]));
  const recipients = seed.awards.flatMap((a) => {
    const awardId = insertedKeys.get(a.key);
    return awardId
      ? a.participants.map((name) => ({
          awardId,
          participantId: resolve(participantIds, name),
        }))
      : [];
  });
  if (recipients.length) {
    await tx.insert(awardParticipant).values(recipients);
  }
}

async function insertAnnouncements(
  tx: DBTx,
  warWeekId: string,
  seed: WarWeekSeed,
) {
  if (!seed.announcements.length) return;
  await tx
    .insert(announcement)
    .values(
      seed.announcements.map((a) => ({
        warWeekId,
        title: a.title,
        body: a.body,
        pinned: a.pinned,
        authorEmail: a.authorEmail,
        publishedAt: new Date(a.publishedAt),
        seedKey: a.key,
      })),
    )
    .onConflictDoNothing({
      target: [announcement.warWeekId, announcement.seedKey],
    });
}
