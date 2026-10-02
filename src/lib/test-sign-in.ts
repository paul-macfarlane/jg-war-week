import { createHash, timingSafeEqual } from "node:crypto";

import { isJahnelGroupEmail } from "@/lib/access";
import { JG_EMAIL_MESSAGE, jgEmailSchema } from "@/lib/jg-email";

/**
 * The env Test sign-in reads, passed in so every check is pure. It never
 * reads `NODE_ENV`: smoke and e2e run `next start`, which is "production".
 */
export type TestSignInEnv = {
  TEST_SIGN_IN_SECRET?: string;
  VERCEL_ENV?: string;
  [name: string]: string | undefined;
};

/** A shorter secret leaves Test sign-in off. */
export const TEST_SIGN_IN_MIN_SECRET_LENGTH = 32;

export const TEST_SIGN_IN_OFF = "Test sign-in is off on this server.";
export const TEST_SIGN_IN_WRONG_SECRET = "That secret doesn't match.";

/**
 * Whether Test sign-in is on for this request: a secret of at least 32
 * characters is set and this isn't a Vercel Production deployment.
 */
export function testSignInEnabled(env: TestSignInEnv): boolean {
  const secret = env.TEST_SIGN_IN_SECRET ?? "";
  return (
    secret.length >= TEST_SIGN_IN_MIN_SECRET_LENGTH &&
    env.VERCEL_ENV !== "production"
  );
}

/** Compares SHA-256 digests, so neither the length nor the content leaks. */
function secretMatches(typed: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(typed), digest(expected));
}

/**
 * Checks a Test sign-in, in order: Test sign-in is on, the typed secret
 * matches, and the email is a Jahnel Group email (`+` aliases included).
 * Returns the email as it's stored, or the refusal the form shows.
 */
export function checkTestSignIn({
  env,
  typedSecret,
  email,
}: {
  env: TestSignInEnv;
  typedSecret: string;
  email: string;
}):
  | { ok: true; email: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (!testSignInEnabled(env)) return { ok: false, error: TEST_SIGN_IN_OFF };
  if (!secretMatches(typedSecret, env.TEST_SIGN_IN_SECRET!)) {
    return {
      ok: false,
      error: TEST_SIGN_IN_WRONG_SECRET,
      fieldErrors: { secret: TEST_SIGN_IN_WRONG_SECRET },
    };
  }
  const parsed = jgEmailSchema.safeParse(email);
  if (!parsed.success) {
    return {
      ok: false,
      error: JG_EMAIL_MESSAGE,
      fieldErrors: { email: JG_EMAIL_MESSAGE },
    };
  }
  return { ok: true, email: parsed.data };
}

/** Who a session belongs to, as the app sees it. */
export type SessionIdentity = {
  email: string;
  sessionId: string;
  /** Signed in through Test sign-in rather than Google. */
  testSignIn: boolean;
};

/**
 * The one session rule (pages, the proxy and MCP): a session counts as
 * anonymous when its email isn't a Jahnel Group email, or when it is a Test
 * sign-in session and Test sign-in is off for this request.
 */
export function sessionIdentity(
  session: SessionIdentity | null,
  env: TestSignInEnv,
): SessionIdentity | null {
  if (!session || !isJahnelGroupEmail(session.email)) return null;
  if (session.testSignIn && !testSignInEnabled(env)) return null;
  return {
    email: session.email.trim().toLowerCase(),
    sessionId: session.sessionId,
    testSignIn: session.testSignIn,
  };
}

/** What the `/sign-in/test` form posts. */
export type TestSignInInput = {
  email: string;
  secret: string;
  /** Where to land afterwards; anything off-site becomes `/`. */
  callbackURL: string;
};
