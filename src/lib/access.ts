import type { WarWeek } from "@/db/schema";
import {
  type HeatReportFacet,
  heatReportError,
} from "@/lib/bracket/heat-report-rule";
import {
  type EnrollFacet,
  enrollError,
  withdrawError,
} from "@/lib/games/enroll-rule";
import {
  type GameLogFacet,
  gameChangeError,
  gameLogError,
} from "@/lib/games/log-rule";
import {
  type CheckInFacet,
  checkInError,
  checkOutError,
} from "@/lib/participation/check-in-rule";

/** The only Google Workspace domain allowed to sign in. */
export const JG_EMAIL_DOMAIN = "jahnelgroup.com";

/**
 * Whether an email belongs to Jahnel Group: exactly one `@` and a domain of
 * exactly `jahnelgroup.com`, ignoring case and surrounding whitespace.
 * Subdomains and look-alike domains are rejected.
 */
export function isJahnelGroupEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && domain === JG_EMAIL_DOMAIN;
}

/**
 * Who is asking: `null` when anonymous, otherwise the signed-in JG email,
 * whether it's on the global Organizer list, and the Competitions it hosts
 * (each with its War Week). Loaded once per request (`getActor`); a
 * signed-in actor with no role is a Participant for access purposes.
 */
export type Actor = {
  email: string;
  isOrganizer: boolean;
  hosts: { competitionId: string; warWeekId: string }[];
} | null;

/**
 * What a signed-in person does to their own Profile or account: no target,
 * since the write is keyed on the actor's own email.
 */
export type SelfAction = "profile.save" | "account.delete";

/**
 * The global Organizer-only families (the Organizer list, Award Categories):
 * no War Week, so they take no target.
 */
export type OrganizerListAction =
  | "organizers.view"
  | "organizers.add"
  | "organizers.remove"
  | `award-category.${"create" | "rename" | "archive" | "restore"}`;

type Crud = "create" | "edit" | "delete";

/** Every other action family; each is checked against a War Week. */
export type WarWeekAction =
  | "admin.view"
  | "settings.save"
  | "lifecycle.start"
  | "lifecycle.end"
  | "lifecycle.reopen"
  | "lifecycle.unstart"
  | "lifecycle.create-next"
  | `${"day" | "team" | "participant" | "award"}.${Crud}`
  /** Importing the roster from a spreadsheet (ticket 67). */
  | "participant.import"
  | `faq-item.${Crud | "move"}`
  /** Reordering, hiding and showing Finale slides (ticket 72). */
  | "finale-slide.move"
  | "finale-slide.hide"
  /** How the Finale shows Awards: one slide, or one per Category (ticket 73). */
  | "finale.awards-layout"
  | "competition.create"
  | "competition.delete"
  | "competition.assign-hosts"
  | "competition.edit"
  | "bracket.entrants"
  | "bracket.generate"
  | "bracket.heat-result"
  | "bracket.heat-schedule"
  | "bracket.finalize"
  | "bracket.unfinalize"
  | "bracket.squads"
  | "competition.self-report"
  | "games.settings"
  | "games.entrants"
  | "games.close"
  | "games.reopen"
  | "competition.self-enroll"
  /** A `participation` Competition's setup, took-part list and close. */
  | "participation.settings"
  | "participation.mark"
  | "participation.close"
  | "participation.reopen"
  /** Checking yourself in or out (ADR 0009). */
  | "participation.check-in"
  | "participation.check-out"
  /** Self-report (ADR 0005). */
  | "bracket.heat-report"
  /** Logging, editing and deleting a Game (ADR 0006). */
  | "games.log"
  | "games.edit"
  | "games.delete"
  /** Self-enrollment (ADR 0006). */
  | "competition.enroll"
  | "competition.withdraw"
  | `points-entry.${Crud}`
  | `schedule-item.${Crud}`
  | `announcement.${Crud | "pin" | "unpin"}`;

/**
 * What a War Week action is checked against: the War Week, plus where the
 * family needs it the row's current Competition (`competitionId`, null for
 * an unlinked Schedule Item), the Competition the request posts
 * (`postedCompetitionId`, null to unlink), an Announcement's author and,
 * for the Participant writes, their facts: a Heat's (`heatReport`), a
 * Game's (`gameLog`), enrollment's (`enroll`) or Check in's (`checkIn`).
 */
export type AccessTarget = {
  warWeekId: string;
  competitionId?: string | null;
  postedCompetitionId?: string | null;
  authorEmail?: string;
  heatReport?: HeatReportFacet;
  gameLog?: GameLogFacet;
  enroll?: EnrollFacet;
  checkIn?: CheckInFacet;
};

export const SIGN_IN_REFUSAL = "Sign in to continue.";
/** What `/admin` shows, and says, to a signed-in user with no role there. */
export const ADMIN_REFUSAL = "Organizers and Hosts only.";
const NOT_HOST = "You're not a Host of that Competition.";

/** What each Organizer-only action is, for "Only an Organizer can …". */
const ORGANIZER_ONLY: Partial<
  Record<OrganizerListAction | WarWeekAction, string>
> = {
  "organizers.view": "see the Organizer list",
  "organizers.add": "add an Organizer",
  "organizers.remove": "remove an Organizer",
  "award-category.create": "add Award Categories",
  "award-category.rename": "rename Award Categories",
  "award-category.archive": "archive Award Categories",
  "award-category.restore": "restore Award Categories",
  "settings.save": "change War Week settings",
  "lifecycle.start": "start a War Week",
  "lifecycle.end": "end a War Week",
  "lifecycle.reopen": "reopen a War Week",
  "lifecycle.unstart": "unstart a War Week",
  "lifecycle.create-next": "create the next War Week",
  "day.create": "add Days",
  "day.edit": "change Days",
  "day.delete": "delete Days",
  "team.create": "add Teams",
  "team.edit": "change Teams",
  "team.delete": "delete Teams",
  "participant.create": "add Participants",
  "participant.edit": "change Participants",
  "participant.delete": "delete Participants",
  "participant.import": "import Participants",
  "faq-item.create": "add FAQ Items",
  "faq-item.edit": "change FAQ Items",
  "faq-item.delete": "delete FAQ Items",
  "faq-item.move": "move FAQ Items",
  "finale-slide.move": "reorder Finale slides",
  "finale-slide.hide": "hide Finale slides",
  "finale.awards-layout": "change how the Finale shows Awards",
  "award.create": "give Awards",
  "award.edit": "change Awards",
  "award.delete": "delete Awards",
  "competition.create": "add Competitions",
  "competition.delete": "delete Competitions",
  "competition.assign-hosts": "assign Hosts",
  "announcement.pin": "pin Announcements",
  "announcement.unpin": "unpin Announcements",
};

type SignedIn = NonNullable<Actor>;

/** Whether the actor hosts `competitionId` in the War Week `warWeekId`. */
function hosts(
  actor: SignedIn,
  warWeekId: string,
  competitionId: string | null | undefined,
): boolean {
  if (!competitionId) return false;
  return actor.hosts.some(
    (h) => h.competitionId === competitionId && h.warWeekId === warWeekId,
  );
}

/** Whether the actor hosts any Competition in the War Week `warWeekId`. */
function hostsIn(actor: SignedIn, warWeekId: string): boolean {
  return actor.hosts.some((h) => h.warWeekId === warWeekId);
}

/** Whether two emails are the same address, ignoring case and spaces. */
export const sameEmail = (a: string | null | undefined, b: string) =>
  a !== undefined &&
  a !== null &&
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The one access rule (ADR 0002): why `actor` can't take `action` on
 * `target`, or null when it can. An Organizer can do everything in every
 * War Week. A Host runs their own Competitions (setup, Bracket, Points
 * Entries, linked Schedule Items) and posts Announcements in a War Week
 * where they host, editing or deleting their own. Everyone else signed in
 * is a Participant, whose writes are reporting the result of a Heat
 * they're in when self-report is on (ADR 0005), and logging Games,
 * changing the Games they logged, and enrolling or withdrawing (ADR 0006),
 * and checking in or out (ADR 0009). Those facet-bound rules bind
 * everyone, Organizers included: a Host or Organizer runs a `games`
 * Competition through the Game facet's `runs`, adds Entrants through the
 * picker and marks who took part through `participation.mark`. Pure: the
 * caller loads the actor and the target.
 */
export function can(actor: Actor, action: SelfAction): string | null;
export function can(actor: Actor, action: OrganizerListAction): string | null;
export function can(
  actor: Actor,
  action: WarWeekAction,
  target: AccessTarget,
): string | null;
export function can(
  actor: Actor,
  action: SelfAction | OrganizerListAction | WarWeekAction,
  target?: AccessTarget,
): string | null {
  if (action === "profile.save" || action === "account.delete") {
    // Before the Organizer shortcut: anyone signed in may change their own
    // Profile or delete their own account, and nobody else's (the write is
    // keyed on `actor.email`).
    return actor && isJahnelGroupEmail(actor.email) ? null : SIGN_IN_REFUSAL;
  }
  if (action === "bracket.heat-report") {
    // Before the Organizer shortcut: the Heat facts bind everyone. A non-JG
    // session already counts as anonymous upstream; checked again here.
    if (!actor || !isJahnelGroupEmail(actor.email)) return SIGN_IN_REFUSAL;
    // A caller that forgot to load the facts can never grant.
    if (!target?.heatReport) return ADMIN_REFUSAL;
    return heatReportError(target.heatReport);
  }
  if (
    action === "games.log" ||
    action === "games.edit" ||
    action === "games.delete"
  ) {
    // Before the Organizer shortcut: a closed Competition binds everyone,
    // and the facet's `runs` (loaded by the caller) is the Host's way in.
    if (!actor || !isJahnelGroupEmail(actor.email)) return SIGN_IN_REFUSAL;
    if (!target?.gameLog) return ADMIN_REFUSAL;
    return action === "games.log"
      ? gameLogError(target.gameLog)
      : gameChangeError(target.gameLog);
  }
  if (action === "competition.enroll" || action === "competition.withdraw") {
    // Before the Organizer shortcut: enrollment binds everyone.
    if (!actor || !isJahnelGroupEmail(actor.email)) return SIGN_IN_REFUSAL;
    if (!target?.enroll) return ADMIN_REFUSAL;
    return action === "competition.enroll"
      ? enrollError(target.enroll)
      : withdrawError(target.enroll);
  }
  if (
    action === "participation.check-in" ||
    action === "participation.check-out"
  ) {
    // Before the Organizer shortcut: Check in binds everyone; a Host or
    // Organizer marks anyone through `participation.mark` instead.
    if (!actor || !isJahnelGroupEmail(actor.email)) return SIGN_IN_REFUSAL;
    if (!target?.checkIn) return ADMIN_REFUSAL;
    return action === "participation.check-in"
      ? checkInError(target.checkIn)
      : checkOutError(target.checkIn);
  }
  if (!actor) return SIGN_IN_REFUSAL;
  if (actor.isOrganizer) return null;

  const organizerOnly = ORGANIZER_ONLY[action];
  if (organizerOnly) return `Only an Organizer can ${organizerOnly}.`;
  if (!target) return ADMIN_REFUSAL;

  const { warWeekId, competitionId, postedCompetitionId } = target;
  const hostsCurrent = hosts(actor, warWeekId, competitionId);
  const hostsPosted = hosts(actor, warWeekId, postedCompetitionId);

  switch (action) {
    case "admin.view":
      return hostsIn(actor, warWeekId) ? null : ADMIN_REFUSAL;
    case "points-entry.create":
      return hostsPosted ? null : NOT_HOST;
    case "points-entry.edit":
      return hostsCurrent && hostsPosted ? null : NOT_HOST;
    case "schedule-item.create":
      if (!postedCompetitionId) {
        return "Link the Schedule Item to a Competition you host.";
      }
      return hostsPosted ? null : NOT_HOST;
    case "schedule-item.edit":
      if (!hostsCurrent) return NOT_HOST;
      if (!postedCompetitionId) {
        return "Only an Organizer can unlink a Schedule Item from its Competition.";
      }
      return hostsPosted ? null : NOT_HOST;
    case "announcement.create":
      return hostsIn(actor, warWeekId)
        ? null
        : "Only an Organizer or a Host of this War Week can post Announcements.";
    case "announcement.edit":
    case "announcement.delete":
      if (!sameEmail(target.authorEmail, actor.email)) {
        return "Only an Organizer can change someone else's Announcement.";
      }
      return hostsIn(actor, warWeekId)
        ? null
        : "Only an Organizer or a Host of this War Week can change Announcements.";
    case "games.settings":
    case "games.entrants":
    case "games.close":
    case "games.reopen":
    case "competition.self-enroll":
      // A `games` Competition's setup, Entrants and close, and the enroll
      // switch: the Host of this Competition, beside their Bracket twins.
      return hostsCurrent ? null : NOT_HOST;
    case "participation.settings":
    case "participation.mark":
    case "participation.close":
    case "participation.reopen":
      // A `participation` Competition's setup, who took part and its close:
      // the Host of this Competition, like `games`.
      return hostsCurrent ? null : NOT_HOST;
    default:
      // A Competition's setup and Bracket, and deleting a Points Entry or
      // Schedule Item: the Host of the row's current Competition.
      return hostsCurrent ? null : NOT_HOST;
  }
}

type AdminWarWeek = Pick<
  WarWeek,
  "id" | "status" | "editionNumber" | "startDate"
>;

const mayView = (actor: Actor, w: { id: string }) =>
  can(actor, "admin.view", { warWeekId: w.id }) === null;

/**
 * The edition `/admin` opens on with no (valid) edition selected: the
 * current War Week for an Organizer; for a Host, the current War Week if
 * they host there, else their earliest `upcoming` edition, else their
 * newest `complete` one. Falls back to the current War Week, where anyone
 * else sees the refusal.
 */
export function defaultAdminWarWeek<T extends AdminWarWeek>(
  actor: Actor,
  warWeeks: T[],
  current: T,
): T {
  if (mayView(actor, current)) return current;
  const upcoming = warWeeks
    .filter((w) => w.status === "upcoming" && mayView(actor, w))
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        a.editionNumber - b.editionNumber,
    );
  if (upcoming[0]) return upcoming[0];
  const complete = warWeeks
    .filter((w) => w.status === "complete" && mayView(actor, w))
    .sort(
      (a, b) =>
        b.startDate.localeCompare(a.startDate) ||
        b.editionNumber - a.editionNumber,
    );
  return complete[0] ?? current;
}

/** One entry in the admin edition switcher. */
export type AdminEdition = {
  edition: string;
  status: WarWeek["status"];
  current: boolean;
};

/**
 * The editions the actor may open in `/admin`, newest first: every edition
 * for an Organizer, the editions they host in for a Host.
 */
export function adminEditions(
  actor: Actor,
  warWeeks: Pick<WarWeek, "id" | "edition" | "editionNumber" | "status">[],
  current: Pick<WarWeek, "id">,
): AdminEdition[] {
  return warWeeks
    .filter((w) => mayView(actor, w))
    .sort((a, b) => b.editionNumber - a.editionNumber)
    .map((w) => ({
      edition: w.edition,
      status: w.status,
      current: w.id === current.id,
    }));
}

const PUBLIC_PREFIXES = ["/sign-in", "/api/auth"];
/**
 * Exact public paths. `/about`, `/privacy` and `/terms` are exact, not
 * prefixes: the top-level `[edition]` route would otherwise turn
 * `/about/leaderboard` (or `/privacy/x`, `/terms/leaderboard`) into a
 * public edition page.
 */
const PUBLIC_PATHS = ["/about", "/privacy", "/terms"];

/**
 * The only paths reachable without a session: the sign-in page,
 * better-auth's own routes and the About, Privacy and Terms pages (copy and
 * media; they read only the current War Week's Appearance Theme, no other War
 * Week data). Everything else needs a Jahnel Group
 * sign-in, except that `/api/mcp` also takes `canUseMcp` (see CONTEXT.md,
 * "Access rules"). A prefix matches itself or a `/`-separated subpath,
 * never `/sign-inx`.
 */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

const CALLBACK_BASE = "http://callback.invalid";

/**
 * Keeps a post-sign-in destination only when it is a path on this site;
 * anything else (absolute URLs, `//host`, backslash tricks) becomes `/`.
 */
export function safeCallbackPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (/\\|%5c/i.test(value)) return "/";
  try {
    const url = new URL(value, CALLBACK_BASE);
    if (url.origin !== CALLBACK_BASE) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export type McpAccessInput = {
  /** A signed-in Jahnel Group session. */
  hasSession: boolean;
  /** The request's `Authorization` header, if any. */
  authorization: string | null | undefined;
  /** `MCP_TOKEN`; unset or blank turns token auth off. */
  mcpToken: string | undefined;
};

/**
 * Who may use `/api/mcp`: a Jahnel Group session, or a request carrying
 * `Authorization: Bearer <MCP_TOKEN>` (see CONTEXT.md, "Access rules").
 * Every MCP tool is read-only and returns only what a signed-in Participant
 * sees.
 */
export function canUseMcp({
  hasSession,
  authorization,
  mcpToken,
}: McpAccessInput): boolean {
  if (hasSession) return true;

  const expected = mcpToken?.trim();
  if (!expected || !authorization) return false;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match ? constantTimeEqual(match[1].trim(), expected) : false;
}

/** Compares every character whatever the input, so timing doesn't leak it. */
function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
