import { describe, expect, it } from "vitest";

import { JG_EMAIL_MESSAGE } from "@/lib/jg-email";
import {
  TEST_SIGN_IN_OFF,
  TEST_SIGN_IN_WRONG_SECRET,
  checkTestSignIn,
  sessionIdentity,
  testSignInEnabled,
} from "@/lib/test-sign-in";

// 40 characters; a fixture, not a secret.
const SECRET = "unit-test-sign-in-secret-not-a-real-one!";
const ON = { TEST_SIGN_IN_SECRET: SECRET, VERCEL_ENV: "preview" };

describe("testSignInEnabled", () => {
  it("is on with a secret of at least 32 characters outside production", () => {
    expect(testSignInEnabled(ON)).toBe(true);
    expect(testSignInEnabled({ TEST_SIGN_IN_SECRET: SECRET })).toBe(true);
    expect(
      testSignInEnabled({
        TEST_SIGN_IN_SECRET: "x".repeat(32),
        VERCEL_ENV: "",
      }),
    ).toBe(true);
  });

  it.each([
    ["the secret is unset", { VERCEL_ENV: "preview" }],
    ["the secret is blank", { TEST_SIGN_IN_SECRET: "", VERCEL_ENV: "" }],
    ["the secret is 31 characters", { TEST_SIGN_IN_SECRET: "x".repeat(31) }],
    [
      "VERCEL_ENV is production",
      { TEST_SIGN_IN_SECRET: SECRET, VERCEL_ENV: "production" },
    ],
  ])("is off when %s", (_case, env) => {
    expect(testSignInEnabled(env)).toBe(false);
  });

  it("ignores NODE_ENV", () => {
    expect(testSignInEnabled({ ...ON, NODE_ENV: "production" })).toBe(true);
  });
});

describe("checkTestSignIn", () => {
  const email = "paul+participant@jahnelgroup.com";

  it.each([
    ["the secret is unset", { VERCEL_ENV: "preview" }],
    ["the secret is short", { TEST_SIGN_IN_SECRET: "short-secret" }],
    [
      "VERCEL_ENV is production",
      { TEST_SIGN_IN_SECRET: SECRET, VERCEL_ENV: "production" },
    ],
  ])("refuses when %s, even with the right secret typed", (_case, env) => {
    expect(checkTestSignIn({ env, typedSecret: SECRET, email })).toEqual({
      ok: false,
      error: TEST_SIGN_IN_OFF,
    });
  });

  it("refuses a wrong secret on the secret field", () => {
    for (const typedSecret of ["", "wrong", `${SECRET}x`, SECRET.slice(1)]) {
      expect(checkTestSignIn({ env: ON, typedSecret, email })).toEqual({
        ok: false,
        error: TEST_SIGN_IN_WRONG_SECRET,
        fieldErrors: { secret: TEST_SIGN_IN_WRONG_SECRET },
      });
    }
  });

  it.each([
    ["a non-JG email", "paul@example.com"],
    ["a JG lookalike domain", "paul@jahnelgroup.com.evil.test"],
    ["a malformed email", "not an email"],
    ["an empty email", ""],
    ["an email over 254 characters", `${"a".repeat(240)}@jahnelgroup.com`],
  ])("refuses %s on the email field", (_case, typed) => {
    expect(
      checkTestSignIn({ env: ON, typedSecret: SECRET, email: typed }),
    ).toEqual({
      ok: false,
      error: JG_EMAIL_MESSAGE,
      fieldErrors: { email: JG_EMAIL_MESSAGE },
    });
  });

  it("checks the secret before the email", () => {
    expect(
      checkTestSignIn({ env: ON, typedSecret: "wrong", email: "x@y.z" }),
    ).toMatchObject({ error: TEST_SIGN_IN_WRONG_SECRET });
  });

  it("allows a JG + alias, trimmed and lowercased", () => {
    expect(
      checkTestSignIn({
        env: ON,
        typedSecret: SECRET,
        email: "  Paul+Host@JahnelGroup.com ",
      }),
    ).toEqual({ ok: true, email: "paul+host@jahnelgroup.com" });
  });
});

describe("sessionIdentity", () => {
  const google = {
    email: "Paul@JahnelGroup.com",
    sessionId: "s1",
    testSignIn: false,
  };
  const test = {
    email: "paul+host@jahnelgroup.com",
    sessionId: "s2",
    testSignIn: true,
  };
  const OFF = { TEST_SIGN_IN_SECRET: "", VERCEL_ENV: "" };

  it("is anonymous with no session", () => {
    expect(sessionIdentity(null, ON)).toBeNull();
  });

  it("is anonymous for a non-JG email", () => {
    expect(
      sessionIdentity({ ...google, email: "paul@example.com" }, ON),
    ).toBeNull();
  });

  it("keeps a Google session, lowercased, whether Test sign-in is on or off", () => {
    const identity = {
      email: "paul@jahnelgroup.com",
      sessionId: "s1",
      testSignIn: false,
    };
    expect(sessionIdentity(google, ON)).toEqual(identity);
    expect(sessionIdentity(google, OFF)).toEqual(identity);
  });

  it("keeps a Test sign-in session while Test sign-in is on", () => {
    expect(sessionIdentity(test, ON)).toEqual(test);
  });

  it("treats a Test sign-in session as anonymous once Test sign-in is off", () => {
    expect(sessionIdentity(test, OFF)).toBeNull();
    expect(
      sessionIdentity(test, { ...ON, VERCEL_ENV: "production" }),
    ).toBeNull();
  });
});
