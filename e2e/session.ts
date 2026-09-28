import type { Browser, BrowserContext } from "@playwright/test";
import { makeSignature } from "better-auth/crypto";
import { randomUUID } from "node:crypto";

import { runQuery, xiParticipantId } from "./db";
import { E2E_AUTH_SECRET, E2E_BASE_URL } from "./env";

const SESSION_COOKIE = "better-auth.session_token";

export const E2E_ORGANIZER_EMAIL = "e2e-organizer@jahnelgroup.com";
export const E2E_PARTICIPANT_EMAIL = "e2e-participant@jahnelgroup.com";
/** A Host once a flow gives it a `competition_host` row; not an Organizer. */
export const E2E_HOST_EMAIL = "e2e-host@jahnelgroup.com";
/** Can't happen through Google sign-in; the session check refuses it. */
export const E2E_OUTSIDER_EMAIL = "e2e-outsider@example.com";

/**
 * Signs `context` in as `email` the way `scripts/smoke/harness.ts`
 * (`createSmokeSession`) does: a `user`
 * and `session` row straight in the database, and the session cookie
 * better-auth would have set after a Google sign-in. No Google.
 */
export async function signIn(context: BrowserContext, email: string) {
  const userId = `e2e-${randomUUID()}`;
  const token = `e2e-${randomUUID()}`;
  await runQuery(
    `insert into "user" (id, name, email, email_verified) values ($1, 'E2E', $2, true)
     on conflict (email) do nothing`,
    [userId, email],
  );
  const [user] = await runQuery<{ id: string }>(
    `select id from "user" where email = $1`,
    [email],
  );
  await runQuery(
    `insert into session (id, token, user_id, expires_at) values ($1, $2, $3, now() + interval '1 day')`,
    [`e2e-${randomUUID()}`, token, user.id],
  );
  const signed = `${token}.${await makeSignature(token, E2E_AUTH_SECRET)}`;
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: encodeURIComponent(signed),
      url: E2E_BASE_URL,
    },
  ]);
}

/** Signs `context` in as the e2e Organizer, on the global Organizer list. */
export async function asOrganizer(context: BrowserContext) {
  await runQuery(
    `insert into organizer (email) values ($1) on conflict do nothing`,
    [E2E_ORGANIZER_EMAIL],
  );
  await signIn(context, E2E_ORGANIZER_EMAIL);
}

/**
 * Signs `context` in as the e2e Host. It hosts nothing until the flow
 * inserts its `competition_host` row.
 */
export async function asHost(context: BrowserContext) {
  await signIn(context, E2E_HOST_EMAIL);
}

/**
 * A signed-in Participant's page, with "Which one is you?" already picked
 * as `displayName` (XI's Participants have no emails to link by).
 */
export async function participantPageAs(browser: Browser, displayName: string) {
  const participantId = await xiParticipantId(displayName);
  const context = await browser.newContext({ baseURL: E2E_BASE_URL });
  await signIn(context, E2E_PARTICIPANT_EMAIL);
  await context.addInitScript(
    ([key, id]) => window.localStorage.setItem(key, id),
    ["ww:you:xi", participantId] as const,
  );
  return { context, page: await context.newPage() };
}
