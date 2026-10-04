import { getActor } from "@/auth/actor";
import {
  type AccessTarget,
  type Actor,
  type OrganizerListAction,
  SIGN_IN_REFUSAL,
  type SelfAction,
  type WarWeekAction,
  can,
} from "@/lib/access";
import { postedAttemptParticipantId } from "@/lib/best-score/input";
import { ATTEMPT_MISSING } from "@/lib/best-score/log-rule";
import { SQUAD_MISSING } from "@/lib/bracket/enroll-rule";
import { NOT_LOGGED_FORMAT } from "@/lib/logged-results";
import { postedMatchPlayerIds } from "@/lib/series/input";
import { MATCH_MISSING } from "@/lib/series/log-rule";
import { isUuid } from "@/lib/uuid";
import type { MutationContext } from "@/mutations/types";
import { type EnrollFacts, getEnrollFacts } from "@/queries/enrollment";
import {
  type LoggedCompetition,
  getAttemptLogFacts,
  getLoggedCompetition,
  getSeriesLogFacts,
} from "@/queries/logged-results";
import {
  type MatchReportFacts,
  getMatchReportFacts,
} from "@/queries/match-reports";
import { getCheckInFacts } from "@/queries/participation";
import {
  type LoadedTarget,
  type TargetWarWeek,
  loadAnnouncementTarget,
  loadAwardTarget,
  loadCompetitionTarget,
  loadDayTarget,
  loadFaqItemTarget,
  loadFinaleSlideTarget,
  loadParticipantTarget,
  loadPointsEntryTarget,
  loadScheduleItemTarget,
  loadTeamTarget,
  loadWarWeekTarget,
} from "@/queries/targets";

type Refused = { ok: false; error: string };

export type Authorized = {
  ok: true;
  actor: NonNullable<Actor>;
  warWeek: TargetWarWeek;
  /** The loaded row, with what `can` checked on it. */
  target: LoadedTarget;
  ctx: MutationContext;
};

/** What an action's id names, with the family's not-found message. */
const TARGETS = {
  warWeek: ["That War Week no longer exists.", loadWarWeekTarget],
  day: ["That Day no longer exists.", loadDayTarget],
  team: ["That Team no longer exists.", loadTeamTarget],
  participant: ["That Participant no longer exists.", loadParticipantTarget],
  competition: ["That Competition no longer exists.", loadCompetitionTarget],
  pointsEntry: ["That Points Entry no longer exists.", loadPointsEntryTarget],
  scheduleItem: [
    "That Schedule Item no longer exists.",
    loadScheduleItemTarget,
  ],
  faqItem: ["That FAQ Item no longer exists.", loadFaqItemTarget],
  finaleSlide: ["That Finale slide no longer exists.", loadFinaleSlideTarget],
  award: ["That Award no longer exists.", loadAwardTarget],
  announcement: ["That Announcement no longer exists.", loadAnnouncementTarget],
} as const satisfies Record<
  string,
  readonly [string, (id: string) => Promise<LoadedTarget | undefined>]
>;

export type TargetKind = keyof typeof TARGETS;

/**
 * The one authorize step every War Week action runs before touching its
 * input (ADR 0003):
 * 1. authenticate: load the actor ("Sign in to continue." when anonymous);
 * 2. check the id is shaped like a row id (the family's not-found message);
 * 3. load the row and its War Week (a create or the settings save passes
 *    the posted `warWeekId` as a `warWeek` target);
 * 4. run `can`, with any posted Competition the request carries.
 * The caller parses its input only after this. Never throws on a refusal.
 */
export async function authorize(
  action: WarWeekAction,
  kind: TargetKind,
  id: unknown,
  options: {
    postedCompetitionId?: string | null;
    notFound?: string;
  } = {},
): Promise<Authorized | Refused> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };
  const [defaultNotFound, load] = TARGETS[kind];
  const notFound = options.notFound ?? defaultNotFound;
  if (!isUuid(id)) return { ok: false, error: notFound };
  const target = await load(id);
  if (!target) return { ok: false, error: notFound };

  const access: AccessTarget = {
    warWeekId: target.warWeek.id,
    competitionId: target.competitionId,
    authorEmail: target.authorEmail,
  };
  if ("postedCompetitionId" in options) {
    access.postedCompetitionId = options.postedCompetitionId;
  }
  const refusal = can(actor, action, access);
  if (refusal) return { ok: false, error: refusal };
  return {
    ok: true,
    actor,
    warWeek: target.warWeek,
    target,
    ctx: { warWeekId: target.warWeek.id, actorEmail: actor.email },
  };
}

/**
 * The authorize step for self-report, the one Participant write (ADR 0005),
 * in ADR 0003's order: authenticate; both ids shaped like row ids; load the
 * Competition and its War Week; load the Match's facts for the actor's email
 * (account linking); run `can("bracket.match-report")`,
 * which binds Organizers and Hosts too. The caller parses its input only
 * after this. Never throws on a refusal.
 */
export async function authorizeMatchReport(
  competitionId: unknown,
  matchId: unknown,
): Promise<
  | {
      ok: true;
      actor: NonNullable<Actor>;
      warWeek: TargetWarWeek;
      ctx: MutationContext;
      linked: NonNullable<MatchReportFacts["linked"]>;
    }
  | Refused
> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };
  const [competitionNotFound, load] = TARGETS.competition;
  if (!isUuid(competitionId)) return { ok: false, error: competitionNotFound };
  if (!isUuid(matchId)) {
    return { ok: false, error: "That Match no longer exists." };
  }
  const target = await load(competitionId);
  if (!target) return { ok: false, error: competitionNotFound };

  const facts = await getMatchReportFacts(competitionId, matchId, actor.email);
  const refusal = can(actor, "bracket.match-report", {
    warWeekId: target.warWeek.id,
    competitionId: target.competitionId,
    matchReport: facts.matchReport,
  });
  if (refusal) return { ok: false, error: refusal };
  // `can` refuses an unlinked actor, so this is only for the type.
  if (!facts.linked) return { ok: false, error: SIGN_IN_REFUSAL };
  return {
    ok: true,
    actor,
    warWeek: target.warWeek,
    ctx: { warWeekId: target.warWeek.id, actorEmail: actor.email },
    linked: facts.linked,
  };
}

/**
 * The authorize step for self-enrollment (ADR 0006): enroll or withdraw,
 * or with a `squadId` join or leave that Squad. In ADR 0003's order:
 * authenticate; the ids shaped like row ids; load the Competition and its
 * War Week; load the enrollment facts for the actor's email (account
 * linking); run `can`, which binds Organizers and Hosts
 * too. Never throws on a refusal.
 */
export async function authorizeEnroll(
  action: "competition.enroll" | "competition.withdraw",
  competitionId: unknown,
  squadId?: unknown,
): Promise<
  | {
      ok: true;
      actor: NonNullable<Actor>;
      warWeek: TargetWarWeek;
      ctx: MutationContext;
      linked: NonNullable<EnrollFacts["linked"]>;
    }
  | Refused
> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };
  const [competitionNotFound, load] = TARGETS.competition;
  if (!isUuid(competitionId)) return { ok: false, error: competitionNotFound };
  if (squadId !== undefined && !isUuid(squadId)) {
    return { ok: false, error: SQUAD_MISSING };
  }
  const target = await load(competitionId);
  if (!target) return { ok: false, error: competitionNotFound };

  const facts = await getEnrollFacts(competitionId, actor.email, {
    squadId: squadId as string | undefined,
  });
  const refusal = can(actor, action, {
    warWeekId: target.warWeek.id,
    competitionId: target.competitionId,
    enroll: facts.enroll,
  });
  if (refusal) return { ok: false, error: refusal };
  // `can` refuses an unlinked actor, so this is only for the type.
  if (!facts.linked) return { ok: false, error: SIGN_IN_REFUSAL };
  return {
    ok: true,
    actor,
    warWeek: target.warWeek,
    ctx: { warWeekId: target.warWeek.id, actorEmail: actor.email },
    linked: facts.linked,
  };
}

/**
 * The authorize step for checking in or out (ADR 0009), in ADR 0003's
 * order: authenticate; the id shaped like a row id; load the Competition
 * and its War Week; load the check-in facts for the actor's email (account
 * linking); run `can`, which binds Organizers and Hosts too. Never throws
 * on a refusal.
 */
export async function authorizeCheckIn(
  action: "participation.check-in" | "participation.check-out",
  competitionId: unknown,
): Promise<
  | {
      ok: true;
      actor: NonNullable<Actor>;
      warWeek: TargetWarWeek;
      ctx: MutationContext;
    }
  | Refused
> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };
  const [competitionNotFound, load] = TARGETS.competition;
  if (!isUuid(competitionId)) return { ok: false, error: competitionNotFound };
  const target = await load(competitionId);
  if (!target) return { ok: false, error: competitionNotFound };

  const facts = await getCheckInFacts(competitionId, actor.email);
  const refusal = can(actor, action, {
    warWeekId: target.warWeek.id,
    competitionId: target.competitionId,
    checkIn: facts.checkIn,
  });
  if (refusal) return { ok: false, error: refusal };
  return {
    ok: true,
    actor,
    warWeek: target.warWeek,
    ctx: { warWeekId: target.warWeek.id, actorEmail: actor.email },
  };
}

/** What a logged-result write does: log one, edit one, or delete one. */
export type ResultOperation = "log" | "edit" | "delete";

/**
 * The authorize step for logging, editing and deleting a Head-to-head
 * Match or a Best score Attempt (ADR 0006), in ADR 0003's order:
 * authenticate; the ids shaped like row ids; load the Competition and its
 * War Week; load the Format's facts for the actor's email (whether they
 * run this Competition, account linking) with what `input` posts for that
 * Format (`postedMatchPlayerIds` or `postedAttemptParticipantId`, so
 * another Format's keys never reach `can`; none for a delete); run `can`
 * with `series.<op>` or `attempts.<op>`, which binds Organizers and Hosts
 * too when closed. Returns the Competition, whose Format and config the
 * caller parses its input with only after this. Never throws on a refusal.
 */
export async function authorizeResultWrite(
  operation: ResultOperation,
  competitionId: unknown,
  resultId: unknown,
  input: unknown = null,
): Promise<
  | {
      ok: true;
      actor: NonNullable<Actor>;
      warWeek: TargetWarWeek;
      ctx: MutationContext;
      competition: LoggedCompetition;
    }
  | Refused
> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };
  const [competitionNotFound, load] = TARGETS.competition;
  if (!isUuid(competitionId)) return { ok: false, error: competitionNotFound };
  const target = await load(competitionId);
  if (!target) return { ok: false, error: competitionNotFound };
  const found = await getLoggedCompetition(competitionId);
  if (!found) return { ok: false, error: NOT_LOGGED_FORMAT };
  const isLog = operation === "log";
  const missing =
    found.format === "head-to-head" ? MATCH_MISSING : ATTEMPT_MISSING;
  if (!isLog && !isUuid(resultId)) return { ok: false, error: missing };
  const id = isLog ? null : (resultId as string);
  const posted = operation === "delete" ? null : input;
  const access: AccessTarget = {
    warWeekId: target.warWeek.id,
    competitionId: target.competitionId,
  };
  let gone = false;
  if (found.format === "head-to-head") {
    const facts = await getSeriesLogFacts(
      competitionId,
      id,
      actor.email,
      postedMatchPlayerIds(posted),
    );
    if (!facts) return { ok: false, error: NOT_LOGGED_FORMAT };
    access.seriesLog = facts.seriesLog;
    gone = facts.seriesLog.match === "missing";
  } else {
    const facts = await getAttemptLogFacts(
      competitionId,
      id,
      actor.email,
      postedAttemptParticipantId(posted),
    );
    if (!facts) return { ok: false, error: NOT_LOGGED_FORMAT };
    access.attemptLog = facts.attemptLog;
    gone = facts.attemptLog.attempt === "missing";
  }
  const family = found.format === "head-to-head" ? "series" : "attempts";
  const refusal = can(actor, `${family}.${operation}`, access);
  if (refusal) return { ok: false, error: refusal };
  // A Host or Organizer passes the rule before the result is looked up.
  if (gone) return { ok: false, error: missing };
  return {
    ok: true,
    actor,
    warWeek: target.warWeek,
    ctx: { warWeekId: target.warWeek.id, actorEmail: actor.email },
    competition: found,
  };
}

/** The authorize step for the global Organizer list: no target to load. */
export async function authorizeOrganizerList(
  action: OrganizerListAction,
): Promise<{ ok: true; actor: NonNullable<Actor> } | Refused> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: SIGN_IN_REFUSAL };
  const refusal = can(actor, action);
  return refusal ? { ok: false, error: refusal } : { ok: true, actor };
}

/**
 * The authorize step for a self action (your own Profile or account): no
 * target to load; the caller keys its write on the returned actor's email.
 * Never throws on a refusal.
 */
export async function authorizeSelf(
  action: SelfAction,
): Promise<{ ok: true; actor: NonNullable<Actor> } | Refused> {
  const actor = await getActor();
  const refusal = can(actor, action);
  if (refusal || !actor)
    return { ok: false, error: refusal ?? SIGN_IN_REFUSAL };
  return { ok: true, actor };
}

/**
 * A Competition id a request posts, read before the input is parsed so
 * `can` can check it: a string as sent, blank or missing as null (none).
 */
export function postedCompetitionId(input: unknown): string | null {
  if (typeof input !== "object" || input === null) return null;
  const value = (input as { competitionId?: unknown }).competitionId;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
