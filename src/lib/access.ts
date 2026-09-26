import type { WarWeek } from "@/db/schema";

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
 * The one Organizer check: a signed-in Jahnel Group email on the War Week's
 * organizer allowlist, ignoring case. Every admin page and Organizer action
 * goes through this.
 */
export function isOrganizer(
  email: string | null | undefined,
  warWeek: Pick<WarWeek, "organizerEmails">,
): boolean {
  if (!email || !isJahnelGroupEmail(email)) return false;
  const normalized = email.trim().toLowerCase();
  return warWeek.organizerEmails.some(
    (allowed) => allowed.trim().toLowerCase() === normalized,
  );
}

/**
 * Who may change a War Week (`target`): an Organizer of that War Week, or,
 * when it's `complete`, an Organizer of the current War Week, so past
 * results can be corrected. Every admin page and Organizer action goes
 * through this (via `loadAdminPage` / `requireOrganizer`).
 */
export function canAdministerWarWeek(
  email: string | null | undefined,
  target: Pick<WarWeek, "organizerEmails"> & { status?: WarWeek["status"] },
  current: Pick<WarWeek, "organizerEmails"> | undefined,
): boolean {
  if (isOrganizer(email, target)) return true;
  return (
    target.status === "complete" &&
    current !== undefined &&
    isOrganizer(email, current)
  );
}

type AdminWarWeek = Pick<
  WarWeek,
  "organizerEmails" | "status" | "editionNumber" | "startDate"
>;

/**
 * The edition `/admin` opens on with no (valid) edition selected: the
 * current War Week for its Organizers; otherwise the email's earliest
 * `upcoming` edition, then their newest `complete` one. Falls back to the
 * current War Week, where a non-Organizer sees the refusal.
 */
export function defaultAdminWarWeek<T extends AdminWarWeek>(
  email: string | null | undefined,
  warWeeks: T[],
  current: T,
): T {
  if (isOrganizer(email, current)) return current;
  const upcoming = warWeeks
    .filter((w) => w.status === "upcoming" && isOrganizer(email, w))
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        a.editionNumber - b.editionNumber,
    );
  if (upcoming[0]) return upcoming[0];
  const complete = warWeeks
    .filter(
      (w) => w.status === "complete" && canAdministerWarWeek(email, w, current),
    )
    .sort((a, b) => b.editionNumber - a.editionNumber);
  return complete[0] ?? current;
}

/** One entry in the admin edition switcher. */
export type AdminEdition = {
  edition: string;
  status: WarWeek["status"];
  current: boolean;
};

/**
 * The editions `email` may administer, newest first: their own editions,
 * plus every `complete` one when they organize the current War Week.
 */
export function adminEditions(
  email: string | null | undefined,
  warWeeks: Pick<
    WarWeek,
    "id" | "edition" | "editionNumber" | "status" | "organizerEmails"
  >[],
  current: Pick<WarWeek, "id" | "organizerEmails">,
): AdminEdition[] {
  return warWeeks
    .filter((w) => canAdministerWarWeek(email, w, current))
    .sort((a, b) => b.editionNumber - a.editionNumber)
    .map((w) => ({
      edition: w.edition,
      status: w.status,
      current: w.id === current.id,
    }));
}

export type AdminAccess = "anonymous" | "not-organizer" | "organizer";

export function adminAccess(
  email: string | null | undefined,
  warWeek: Pick<WarWeek, "organizerEmails"> & { status?: WarWeek["status"] },
  current?: Pick<WarWeek, "organizerEmails">,
): AdminAccess {
  if (!email) return "anonymous";
  return canAdministerWarWeek(email, warWeek, current)
    ? "organizer"
    : "not-organizer";
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
 * better-auth's own routes and the About, Privacy and Terms pages (static
 * copy and media, no War Week data). Everything else needs a Jahnel Group
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
