import { describe, expect, it } from "vitest";

import {
  adminAccess,
  adminEditions,
  canAdministerWarWeek,
  canUseMcp,
  defaultAdminWarWeek,
  isJahnelGroupEmail,
  isOrganizer,
  isPublicPath,
  safeCallbackPath,
} from "@/lib/access";

describe("isJahnelGroupEmail", () => {
  it.each([
    "pmacfarlane@jahnelgroup.com",
    "PMacfarlane@JahnelGroup.com",
    "  someone@jahnelgroup.com  ",
    "first.last+tag@jahnelgroup.com",
  ])("accepts %j", (email) => {
    expect(isJahnelGroupEmail(email)).toBe(true);
  });

  it.each([
    "someone@gmail.com",
    "someone@jahnelgroup.co",
    "someone@evil-jahnelgroup.com",
    "someone@jahnelgroup.com.evil.com",
    "someone@mail.jahnelgroup.com",
    "a@evil.com@jahnelgroup.com",
    "jahnelgroup.com",
    "@jahnelgroup.com",
    "someone@",
    "",
    null,
    undefined,
  ])("rejects %j", (email) => {
    expect(isJahnelGroupEmail(email)).toBe(false);
  });
});

describe("isOrganizer", () => {
  const warWeek = {
    organizerEmails: ["pmacfarlane@jahnelgroup.com", "Lead@JahnelGroup.com"],
  };

  it("accepts a JG email on the War Week's allowlist, ignoring case", () => {
    expect(isOrganizer("pmacfarlane@jahnelgroup.com", warWeek)).toBe(true);
    expect(isOrganizer("PMACFARLANE@jahnelgroup.com", warWeek)).toBe(true);
    expect(isOrganizer("lead@jahnelgroup.com", warWeek)).toBe(true);
  });

  it("rejects a JG email that isn't on the allowlist", () => {
    expect(isOrganizer("someone@jahnelgroup.com", warWeek)).toBe(false);
  });

  it("rejects a non-JG email even if it is on the allowlist", () => {
    expect(
      isOrganizer("outsider@gmail.com", {
        organizerEmails: ["outsider@gmail.com"],
      }),
    ).toBe(false);
  });

  it("rejects anonymous users and empty allowlists", () => {
    expect(isOrganizer(null, warWeek)).toBe(false);
    expect(isOrganizer(undefined, warWeek)).toBe(false);
    expect(
      isOrganizer("pmacfarlane@jahnelgroup.com", { organizerEmails: [] }),
    ).toBe(false);
  });
});

describe("canAdministerWarWeek", () => {
  const organizer = "pmacfarlane@jahnelgroup.com";
  const pastOnly = "past@jahnelgroup.com";
  const nextOnly = "next@jahnelgroup.com";
  const current = { organizerEmails: [organizer], status: "live" as const };
  const complete = { organizerEmails: [pastOnly], status: "complete" as const };
  const upcoming = { organizerEmails: [nextOnly], status: "upcoming" as const };

  it("lets an Organizer of the target change it, whoever runs the current one", () => {
    expect(
      canAdministerWarWeek(
        organizer,
        { organizerEmails: [organizer], status: "live" },
        { organizerEmails: ["lead@jahnelgroup.com"] },
      ),
    ).toBe(true);
    expect(canAdministerWarWeek(pastOnly, complete, current)).toBe(true);
    expect(canAdministerWarWeek(nextOnly, upcoming, current)).toBe(true);
  });

  it("refuses a non-Organizer on every edition, whatever id they send", () => {
    for (const target of [current, complete, upcoming]) {
      expect(
        canAdministerWarWeek("someone@jahnelgroup.com", target, current),
      ).toBe(false);
      expect(canAdministerWarWeek(null, target, current)).toBe(false);
    }
  });

  it("refuses an Organizer of only a past or upcoming edition on the current one", () => {
    const live = { organizerEmails: [organizer], status: "live" as const };
    expect(canAdministerWarWeek(pastOnly, live, current)).toBe(false);
    expect(canAdministerWarWeek(nextOnly, live, current)).toBe(false);
  });

  it("refuses an Organizer of one past edition on another past edition", () => {
    const older = { organizerEmails: [organizer], status: "complete" as const };
    expect(canAdministerWarWeek(pastOnly, older, current)).toBe(false);
  });

  it("lets a current Organizer change a complete edition, not an upcoming one", () => {
    expect(canAdministerWarWeek(organizer, complete, current)).toBe(true);
    expect(canAdministerWarWeek(organizer, upcoming, current)).toBe(false);
  });

  it("refuses a non-JG email even on an allowlist", () => {
    const outsider = "outsider@gmail.com";
    expect(
      canAdministerWarWeek(
        outsider,
        { organizerEmails: [outsider], status: "complete" },
        { organizerEmails: [outsider] },
      ),
    ).toBe(false);
  });

  it("uses only the target's allowlist when there's no current War Week", () => {
    expect(canAdministerWarWeek(pastOnly, complete, undefined)).toBe(true);
    expect(canAdministerWarWeek(organizer, complete, undefined)).toBe(false);
  });
});

describe("defaultAdminWarWeek and adminEditions", () => {
  const lead = "lead@jahnelgroup.com";
  const pastOnly = "past@jahnelgroup.com";
  const nextOnly = "next@jahnelgroup.com";
  const edition = (
    n: number,
    roman: string,
    status: "upcoming" | "live" | "complete",
    organizerEmails: string[],
  ) => ({
    id: roman,
    edition: roman,
    editionNumber: n,
    status,
    startDate: `20${n + 15}-02-21`,
    organizerEmails,
  });
  const ix = edition(9, "ix", "complete", [pastOnly]);
  const x = edition(10, "x", "complete", [pastOnly]);
  const xi = edition(11, "xi", "live", [lead]);
  const xii = edition(12, "xii", "upcoming", [nextOnly, pastOnly]);
  const xiii = edition(13, "xiii", "upcoming", [nextOnly]);

  it("is the current War Week for its Organizer", () => {
    expect(defaultAdminWarWeek(lead, [ix, x, xi, xii], xi).edition).toBe("xi");
  });

  it("is the Organizer's earliest upcoming edition when they don't run the current one", () => {
    expect(
      defaultAdminWarWeek(nextOnly, [xiii, ix, xi, xii, x], xi).edition,
    ).toBe("xii");
    expect(defaultAdminWarWeek(pastOnly, [ix, x, xi, xii], xi).edition).toBe(
      "xii",
    );
  });

  it("is the newest past edition for an Organizer of only past ones", () => {
    expect(defaultAdminWarWeek(pastOnly, [ix, x, xi], xi).edition).toBe("x");
  });

  it("stays on the current War Week for a non-Organizer, who sees the refusal", () => {
    expect(
      defaultAdminWarWeek("someone@jahnelgroup.com", [ix, x, xi, xii], xi)
        .edition,
    ).toBe("xi");
  });

  it("lists the editions an email may administer, newest first", () => {
    expect(adminEditions(pastOnly, [ix, xii, x, xi], xi)).toEqual([
      { edition: "xii", status: "upcoming", current: false },
      { edition: "x", status: "complete", current: false },
      { edition: "ix", status: "complete", current: false },
    ]);
    expect(adminEditions(lead, [ix, xii, x, xi], xi)).toEqual([
      { edition: "xi", status: "live", current: true },
      { edition: "x", status: "complete", current: false },
      { edition: "ix", status: "complete", current: false },
    ]);
    expect(adminEditions("someone@jahnelgroup.com", [ix, xi], xi)).toEqual([]);
  });
});

describe("adminAccess", () => {
  const warWeek = { organizerEmails: ["pmacfarlane@jahnelgroup.com"] };

  it("is anonymous with no signed-in email", () => {
    expect(adminAccess(null, warWeek)).toBe("anonymous");
  });

  it("is not-organizer for a signed-in JG user off the allowlist", () => {
    expect(adminAccess("someone@jahnelgroup.com", warWeek)).toBe(
      "not-organizer",
    );
  });

  it("is organizer for a signed-in user on the allowlist", () => {
    expect(adminAccess("pmacfarlane@jahnelgroup.com", warWeek)).toBe(
      "organizer",
    );
  });
});

describe("isPublicPath", () => {
  it.each([
    "/sign-in",
    "/api/auth",
    "/api/auth/callback/google",
    "/about",
    "/privacy",
    "/terms",
  ])("keeps %j public", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/xi",
    "/xi/leaderboard",
    "/admin",
    "/api/mcp",
    "/sign-in-other",
    "/api/authx",
    "/aboutx",
    "/about-anything",
    "/aboutx/y",
    "/About",
    "/about/",
    "/about/leaderboard",
    "/about/x",
    "/about%2Fxi",
    "/privacy/x",
    "/termsx",
    "/privacy/",
    "/Privacy",
    "/terms/leaderboard",
  ])("requires sign-in for %j", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});

describe("safeCallbackPath", () => {
  it.each([
    ["/admin", "/admin"],
    ["/xi/leaderboard?tab=team", "/xi/leaderboard?tab=team"],
  ])("keeps the same-origin path %j", (value, expected) => {
    expect(safeCallbackPath(value)).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "admin",
    "//evil.com",
    "/\\evil.com",
    "https://evil.com/admin",
    "/%5Cevil.com",
    "javascript:alert(1)",
  ])("falls back to / for %j", (value) => {
    expect(safeCallbackPath(value)).toBe("/");
  });
});

describe("canUseMcp", () => {
  const token = "s3cret-token-value";
  const base = {
    hasSession: false,
    authorization: null,
    mcpToken: token,
  };

  it("lets a Jahnel Group session in without a token", () => {
    expect(canUseMcp({ ...base, hasSession: true })).toBe(true);
    expect(canUseMcp({ ...base, hasSession: true, mcpToken: "" })).toBe(true);
  });

  it("lets a correct bearer token in", () => {
    expect(canUseMcp({ ...base, authorization: `Bearer ${token}` })).toBe(true);
    expect(canUseMcp({ ...base, authorization: `bearer  ${token} ` })).toBe(
      true,
    );
  });

  it.each([
    ["a wrong token", "Bearer nope"],
    ["a token prefix", `Bearer ${token.slice(0, -1)}`],
    ["a longer token", `Bearer ${token}x`],
    ["a non-bearer scheme", `Basic ${token}`],
    ["the bare token", token],
    ["an empty bearer", "Bearer "],
    ["no header", null],
  ])("refuses %s", (_, authorization) => {
    expect(canUseMcp({ ...base, authorization })).toBe(false);
  });

  it.each([undefined, "", "   "])(
    "turns token auth off when MCP_TOKEN is %j",
    (mcpToken) => {
      expect(canUseMcp({ ...base, mcpToken, authorization: "Bearer " })).toBe(
        false,
      );
      expect(
        canUseMcp({ ...base, mcpToken, authorization: `Bearer ${token}` }),
      ).toBe(false);
    },
  );
});
