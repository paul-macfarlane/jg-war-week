import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { testSignIn } from "@/actions/test-sign-in";
import TestSignInPage from "@/app/sign-in/test/page";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { TEST_SIGN_IN_OFF } from "@/lib/test-sign-in";

// vi.mock factories are hoisted above the imports, so their values are too.
const { setCookie, redirect } = vi.hoisted(() => ({
  setCookie: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: setCookie }),
  headers: async () => new Headers(),
}));
// Only `redirect` is stubbed: the page test needs the real `notFound`.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect,
}));

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

// 40 characters; a fixture, not a secret.
const SECRET = "unit-test-sign-in-secret-not-a-real-one!";

afterEach(() => {
  vi.unstubAllEnvs();
  setCookie.mockClear();
  redirect.mockClear();
});

// Checked on every request, not at build: the same server refuses as soon
// as it runs as a Vercel Production deployment.
describe("Test sign-in with the secret set on Vercel Production", () => {
  it("the action refuses and sets no cookie", async () => {
    vi.stubEnv("TEST_SIGN_IN_SECRET", SECRET);
    vi.stubEnv("VERCEL_ENV", "production");

    await expect(
      testSignIn({
        email: "paul+participant@jahnelgroup.com",
        secret: SECRET,
        callbackURL: "/",
      }),
    ).resolves.toEqual({ ok: false, error: TEST_SIGN_IN_OFF });
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("the page is not found", async () => {
    vi.stubEnv("TEST_SIGN_IN_SECRET", SECRET);
    vi.stubEnv("VERCEL_ENV", "production");

    await expect(
      TestSignInPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });
});

describe.skipIf(!isLocalDatabase)("Test sign-in when it is on", () => {
  it("creates a verified user and a test session, and sets better-auth's session cookie", async () => {
    vi.stubEnv("TEST_SIGN_IN_SECRET", SECRET);
    vi.stubEnv("VERCEL_ENV", "preview");
    const email = `e2e+unit-${randomUUID()}@jahnelgroup.com`;
    const { db } = await import("@/db");
    const { session, user } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    try {
      await testSignIn({ email, secret: SECRET, callbackURL: "/xi" });

      const [created] = await db
        .select({ id: user.id, emailVerified: user.emailVerified })
        .from(user)
        .where(eq(user.email, email));
      expect(created).toMatchObject({ emailVerified: true });
      const sessions = await db
        .select({ testSignIn: session.testSignIn })
        .from(session)
        .where(eq(session.userId, created.id));
      expect(sessions).toEqual([{ testSignIn: true }]);
      // better-auth's own name: `__Secure-` prefixed only over https.
      expect(setCookie).toHaveBeenCalledOnce();
      expect(setCookie.mock.calls[0][0]).toMatch(
        /^(__Secure-)?better-auth\.session_token$/,
      );
      expect(redirect).toHaveBeenCalledWith("/xi");
    } finally {
      // Sessions and sign-in accounts cascade.
      await db.delete(user).where(eq(user.email, email));
    }
  });
});
