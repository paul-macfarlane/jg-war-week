import { afterEach, describe, expect, it, vi } from "vitest";

import { testSignIn } from "@/actions/test-sign-in";
import TestSignInPage from "@/app/sign-in/test/page";
import { TEST_SIGN_IN_OFF } from "@/lib/test-sign-in";

const setCookie = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: setCookie }),
  headers: async () => new Headers(),
}));

// 40 characters; a fixture, not a secret.
const SECRET = "unit-test-sign-in-secret-not-a-real-one!";

afterEach(() => {
  vi.unstubAllEnvs();
  setCookie.mockClear();
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
