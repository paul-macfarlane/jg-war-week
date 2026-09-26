import type { BrowserContext } from "@playwright/test";
import { makeSignature } from "better-auth/crypto";
import { randomUUID } from "node:crypto";

import { runQuery } from "./db";
import { E2E_AUTH_SECRET, E2E_BASE_URL } from "./env";

const SESSION_COOKIE = "better-auth.session_token";

export const E2E_ORGANIZER_EMAIL = "e2e-organizer@jahnelgroup.com";
export const E2E_PARTICIPANT_EMAIL = "e2e-participant@jahnelgroup.com";
/** Can't happen through Google sign-in; the session check refuses it. */
export const E2E_OUTSIDER_EMAIL = "e2e-outsider@example.com";

/**
 * Signs `context` in as `email` the way `scripts/smoke.ts` does: a `user`
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
