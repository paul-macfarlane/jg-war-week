import {
  ADMIN_REFUSAL_TEXT,
  BASE_URL,
  type SmokeSession,
  fail,
  ok,
} from "./harness";
import { assertMcpBearerToken, mcpRequest } from "./mcp";

export async function assertAdminGate(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
  outsider: SmokeSession;
}) {
  const anonymousCheck = "anonymous GET /admin redirects to sign-in";
  try {
    const res = await fetch(`${BASE_URL}/admin`, { redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    if (
      res.status === 307 &&
      location.includes("/sign-in?callbackURL=%2Fadmin")
    ) {
      ok(anonymousCheck);
    } else {
      fail(anonymousCheck, `status=${res.status} location=${location}`);
    }
  } catch (error) {
    fail(anonymousCheck, String(error));
  }

  type AdminResult = { status: number; body: string; location: string };
  const shows = {
    "the admin shell": ({ status, body }: AdminResult) =>
      status === 200 &&
      body.includes("Organizer overview") &&
      body.includes("Admin sections"),
    "the refusal": ({ status, body }: AdminResult) =>
      status === 200 &&
      body.includes(ADMIN_REFUSAL_TEXT) &&
      !body.includes("Admin sections"),
    "sign-in": ({ status, location }: AdminResult) =>
      status === 307 && location.includes("/sign-in"),
  };

  for (const [label, session, expected] of [
    ["an allowlisted Organizer", sessions.organizer, "the admin shell"],
    [
      "a signed-in JG user off the allowlist",
      sessions.notOrganizer,
      "the refusal",
    ],
    ["a session with a non-JG email", sessions.outsider, "sign-in"],
  ] as const) {
    const check = `GET /admin as ${label} shows ${expected}`;
    try {
      const res = await fetch(`${BASE_URL}/admin`, {
        headers: { cookie: session.cookie },
        redirect: "manual",
      });
      const result = {
        status: res.status,
        body: await res.text(),
        location: res.headers.get("location") ?? "",
      };
      if (shows[expected](result)) {
        ok(check);
      } else {
        fail(check, `status=${result.status} location=${result.location}`);
      }
    } catch (error) {
      fail(check, String(error));
    }
  }
}

export async function assertAdminWording(sessions: {
  organizer: SmokeSession;
}) {
  for (const route of ["/admin", "/admin/standings", "/admin/points"]) {
    const check = `GET ${route} as an Organizer says 'Back to War Week XI' and never 'public site'`;
    try {
      const res = await fetch(`${BASE_URL}${route}`, {
        headers: { cookie: sessions.organizer.cookie },
      });
      const body = await res.text();
      const checks = {
        // React SSR can split "Back to War Week " and "XI" with a hydration
        // comment marker, so tolerate one between them.
        backLink: /Back to War Week\s*(?:<!--\s*-->)?\s*XI/.test(body),
        noPublicSite: !body.includes("public site"),
      };
      if (res.status === 200 && Object.values(checks).every(Boolean)) {
        ok(check);
      } else {
        fail(check, `status=${res.status} ${JSON.stringify(checks)}`);
      }
    } catch (error) {
      fail(check, String(error));
    }
  }
}

export async function assertSignInRequired() {
  for (const target of ["/", "/xi", "/xi/leaderboard"]) {
    const check = `anonymous GET ${target} redirects to sign-in`;
    try {
      const res = await fetch(`${BASE_URL}${target}`, { redirect: "manual" });
      const location = res.headers.get("location") ?? "";
      const callback = `callbackURL=${encodeURIComponent(target)}`;
      if (
        res.status === 307 &&
        location.includes("/sign-in?") &&
        location.includes(callback)
      ) {
        ok(check);
      } else {
        fail(check, `status=${res.status} location=${location}`);
      }
    } catch (error) {
      fail(check, String(error));
    }
  }

  const mcpCheck = "anonymous POST /api/mcp answers 401";
  try {
    const { status } = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "smoke-test", version: "0.1.0" },
        },
      },
      undefined,
      "",
    ).catch(() => ({ status: -1 }));
    if (status === 401) {
      ok(mcpCheck);
    } else {
      fail(mcpCheck, `status=${status}`);
    }
  } catch (error) {
    fail(mcpCheck, String(error));
  }

  await assertMcpBearerToken();
}

export async function assertAdminGuidePage(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const organizerCheck =
    "GET /admin/guide as an Organizer shows the guide, linked in the admin nav";
  try {
    const res = await fetch(`${BASE_URL}/admin/guide`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const body = await res.text();
    if (
      res.status === 200 &&
      body.includes("Organizer guide") &&
      body.includes("Placement Points") &&
      body.includes('href="/admin/guide"')
    ) {
      ok(organizerCheck);
    } else {
      fail(organizerCheck, `status=${res.status}`);
    }
  } catch (error) {
    fail(organizerCheck, String(error));
  }

  const refusalCheck =
    "GET /admin/guide as a signed-in non-Organizer shows the refusal";
  try {
    const res = await fetch(`${BASE_URL}/admin/guide`, {
      headers: { cookie: sessions.notOrganizer.cookie },
    });
    const body = await res.text();
    if (res.status === 200 && body.includes(ADMIN_REFUSAL_TEXT)) {
      ok(refusalCheck);
    } else {
      fail(refusalCheck, `status=${res.status}`);
    }
  } catch (error) {
    fail(refusalCheck, String(error));
  }
}

export async function assertAdminLink(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  for (const [label, session, expected] of [
    ["an Organizer", sessions.organizer, true],
    ["a non-Organizer", sessions.notOrganizer, false],
  ] as const) {
    const check = `GET /xi/more as ${label} ${expected ? "shows" : "hides"} the Admin link and shows the account`;
    try {
      const res = await fetch(`${BASE_URL}/xi/more`, {
        headers: { cookie: session.cookie },
      });
      const body = await res.text();
      const checks = {
        admin: body.includes('href="/admin"') === expected,
        account: body.includes("Signed in as") && body.includes("Sign out"),
      };
      if (res.status === 200 && Object.values(checks).every(Boolean)) {
        ok(check);
      } else {
        fail(check, `status=${res.status} ${JSON.stringify(checks)}`);
      }
    } catch (error) {
      fail(check, String(error));
    }
  }
}
