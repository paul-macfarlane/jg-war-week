import {
  type SQL,
  and,
  eq,
  inArray,
  isNull,
  ne,
  notInArray,
  sql,
} from "drizzle-orm";
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
  awardCategory,
  awardParticipant,
  competition,
  day,
  faqItem,
  finaleSlide,
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
 *   by seed key only when absent, and never updated or deleted. One
 *   exception: a seeded Award with no Category that was never edited in the
 *   app (`updated_at = created_at`) gets the seed's Category.
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
    await syncFinaleSlides(tx, warWeekId, seed);

    await insertPointsEntries(
      tx,
      warWeekId,
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
      finaleAwardsLayout: seed.finaleAwardsLayout ?? "one-slide",
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
      // An individual `participation` Competition has none; a team one has
      // them, not N (the CHECK `competition_participation_columns`).
      placementPoints:
        c.format === "participation" && c.scoring === "individual"
          ? null
          : (c.placementPoints ?? null),
      scoring: c.scoring,
      countsTowardTeam: c.countsTowardTeam,
      competitionGroup: c.group ?? null,
      format: c.format,
      bracketConfig: c.bracketConfig ?? null,
      // Checked against the Format by `competitionSeedSchema`.
      gameConfig: (c.gameConfig ?? null) as GamesConfig | null,
      entrantsOpen: c.entrantsOpen ?? false,
      ...(c.format === "participation"
        ? {
            participationPoints:
              c.scoring === "individual" ? (c.participationPoints ?? 1) : null,
            selfCheckIn: c.selfCheckIn ?? false,
            checkInClosesAt: c.checkInClosesAt
              ? new Date(c.checkInClosesAt)
              : null,
          }
        : {}),
    })),
    target: [competition.warWeekId, competition.name],
    set: {
      description: sql`excluded.description`,
      placementPoints: sql`excluded.placement_points`,
      scoring: sql`excluded.scoring`,
      countsTowardTeam: sql`excluded.counts_toward_team`,
      competitionGroup: sql`excluded.competition_group`,
      // A `participation` Competition's N follows its scoring (the CHECK
      // `competition_participation_columns`, with the Placement Points
      // above): none for a team one, the Host's N kept (else the seed's) for
      // an individual one.
      participationPoints: sql`case when excluded.participation_points is null
        then null
        else coalesce(${competition.participationPoints}, excluded.participation_points) end`,
      // `format`, `bracketConfig`, `gameConfig`, `entrantsOpen` and the
      // other Participation settings are set on insert only: a reload must
      // never turn an Organizer's Bracket back into `placement` or undo its
      // Heats, Games or Participation settings.
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

/**
 * Keeps the War Week's Finale slide list equal to the seed's `finaleSlides`
 * (order, hidden, a Custom slide's fields), upserted by kind and heading so
 * ids stay the same across loads; a seed without `finaleSlides` leaves the
 * saved list alone.
 */
async function syncFinaleSlides(
  tx: DBTx,
  warWeekId: string,
  seed: WarWeekSeed,
) {
  if (!seed.finaleSlides) return;
  await upsertDeletingAbsent(tx, finaleSlide, {
    rows: seed.finaleSlides.map((slide, index) => ({
      warWeekId,
      kind: slide.kind,
      sortOrder: index,
      hidden: slide.hidden,
      heading: slide.heading ?? null,
      body: slide.body ?? null,
      backgroundColor: slide.backgroundColor ?? null,
    })),
    target: [finaleSlide.warWeekId, finaleSlide.kind, finaleSlide.heading],
    set: {
      sortOrder: sql`excluded.sort_order`,
      hidden: sql`excluded.hidden`,
      body: sql`excluded.body`,
      backgroundColor: sql`excluded.background_color`,
      updatedAt: new Date(),
    },
    scope: eq(finaleSlide.warWeekId, warWeekId),
    key: finaleSlide.id,
    keep: (kept) => kept.map((k) => k.id),
  });
}

async function insertPointsEntries(
  tx: DBTx,
  warWeekId: string,
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
        warWeekId,
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
      target: [pointsEntry.warWeekId, pointsEntry.seedKey],
    });
}

/** The seed's Award Category keys as ids; an unknown key fails naming it. */
async function resolveAwardCategories(
  tx: DBTx,
  seed: WarWeekSeed,
): Promise<Map<string, string>> {
  const keys = [
    ...new Set(seed.awards.flatMap((a) => (a.category ? [a.category] : []))),
  ];
  if (keys.length === 0) return new Map();
  const rows = await tx
    .select({ id: awardCategory.id, key: awardCategory.key })
    .from(awardCategory)
    .where(inArray(awardCategory.key, keys));
  const ids = new Map(rows.map((r) => [r.key ?? "", r.id]));
  const unknown = keys.filter((key) => !ids.has(key));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown Award Category key ${unknown.map((k) => `"${k}"`).join(", ")}`,
    );
  }
  return ids;
}

async function insertAwards(
  tx: DBTx,
  warWeekId: string,
  seed: WarWeekSeed,
  teamIds: Map<string, string>,
  participantIds: Map<string, string>,
) {
  if (!seed.awards.length) return;
  const categoryIds = await resolveAwardCategories(tx, seed);
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
        categoryId: resolveOptional(categoryIds, a.category),
        seedKey: a.key,
      })),
    )
    .onConflictDoNothing({ target: [award.warWeekId, award.seedKey] })
    .returning({ id: award.id, seedKey: award.seedKey });

  const insertedKeys = new Map(inserted.map((a) => [a.seedKey, a.id]));
  // Fill if empty: an Award loaded before it had a Category, and never edited
  // since, gets the seed's. An Organizer's choice, even "None", is kept.
  for (const a of seed.awards) {
    if (!a.category || insertedKeys.has(a.key)) continue;
    await tx
      .update(award)
      .set({ categoryId: resolve(categoryIds, a.category) })
      .where(
        and(
          eq(award.warWeekId, warWeekId),
          eq(award.seedKey, a.key),
          isNull(award.categoryId),
          eq(award.updatedAt, award.createdAt),
        ),
      );
  }
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
