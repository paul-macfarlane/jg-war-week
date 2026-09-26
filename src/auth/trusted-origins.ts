/**
 * The origins better-auth accepts as request origins for sign-in and OAuth
 * callbacks.
 *
 * Production always trusts only the configured base URL
 * (`BETTER_AUTH_URL`). A Vercel preview deployment (`VERCEL_ENV ===
 * "preview"`) additionally trusts its own deployment host (`VERCEL_URL`) and
 * its stable branch alias (`VERCEL_BRANCH_URL`), when each is set and
 * non-blank. Never a wildcard, and never anything outside production and
 * preview.
 */

export type TrustedOriginsEnv = {
  BETTER_AUTH_URL?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_ENV?: string;
};

/** Strips any scheme, surrounding whitespace, and a trailing slash from a host or URL string. */
function normalizeHost(value: string): string {
  return value
    .trim()
    .replace(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//, "")
    .replace(/\/+$/, "");
}

/** The origin (scheme + host) of `BETTER_AUTH_URL`, or `null` when unset, blank, or unparseable. */
function baseOrigin(betterAuthUrl: string | undefined): string | null {
  const trimmed = betterAuthUrl?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function trustedOrigins(env: TrustedOriginsEnv): string[] {
  const origins: string[] = [];

  const base = baseOrigin(env.BETTER_AUTH_URL);
  if (base) origins.push(base);

  if (env.VERCEL_ENV === "preview") {
    for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) {
      if (!host) continue;
      const normalized = normalizeHost(host);
      if (!normalized) continue;
      origins.push(`https://${normalized}`);
    }
  }

  return Array.from(new Set(origins));
}
