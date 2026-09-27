// Shared local-host rule for anything that mutates a database: smoke,
// seed:load --reset, and the mutation test suites. A hosted Neon database
// (or any non-local host) is never treated as local, so smoke and reset
// commands stay confined to a local Postgres.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Fallback for URLs `new URL` can't parse (e.g. malformed connection
// strings): match the host directly against the same rule.
const LOCAL_HOST_FALLBACK =
  /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:[/?#]|$)/i;

/**
 * Whether `url` names a local Postgres: host `localhost`, `127.0.0.1` or
 * `[::1]`, a driver other than `neon`, and no `host` / `hostaddr` query
 * parameter (pg lets those override the URL's host).
 */
export function isLocalDatabaseUrl(
  url: string | undefined,
  driver: string | undefined,
): boolean {
  if (driver === "neon") return false;
  if (!url) return false;

  try {
    const parsed = new URL(url);
    if (
      parsed.searchParams.has("host") ||
      parsed.searchParams.has("hostaddr")
    ) {
      return false;
    }
    return LOCAL_HOSTS.has(parsed.hostname);
  } catch {
    return LOCAL_HOST_FALLBACK.test(url);
  }
}
