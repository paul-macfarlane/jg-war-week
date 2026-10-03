import { XI_AWARDS, XI_FAQ_QUESTIONS } from "./awards";
import { BASE_URL, MCP_TOKEN, fail, ok, state } from "./harness";

export async function mcpRequest(
  body: Record<string, unknown>,
  sessionId?: string,
  cookie = state.viewerCookie,
  extraHeaders: Record<string, string> = {},
): Promise<{
  status: number;
  json: Record<string, unknown> | undefined;
  sessionId: string | undefined;
}> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (cookie) headers.cookie = cookie;
  if (sessionId) headers["mcp-session-id"] = sessionId;
  Object.assign(headers, extraHeaders);

  const res = await fetch(`${BASE_URL}/api/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  let json: Record<string, unknown> | undefined;
  if (contentType.includes("text/event-stream")) {
    const dataLines = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .filter(Boolean);
    const lastData = dataLines[dataLines.length - 1];
    if (lastData) json = JSON.parse(lastData);
  } else if (text) {
    json = JSON.parse(text);
  }

  return {
    status: res.status,
    json,
    sessionId: res.headers.get("mcp-session-id") ?? undefined,
  };
}

/**
 * Calls an MCP tool through a fresh `initialize` and `tools/call`, and
 * returns its raw text and parsed payload.
 */
export async function mcpTool(
  name: string,
  args: Record<string, unknown> = {},
  sessionId?: string,
  cookie = state.viewerCookie,
  extraHeaders: Record<string, string> = {},
) {
  const init = await mcpRequest(
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
    sessionId,
    cookie,
    extraHeaders,
  );
  const call = await mcpRequest(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name, arguments: args },
    },
    init.sessionId,
    cookie,
    extraHeaders,
  );
  const text =
    (
      call.json?.result as
        { content?: { type: string; text: string }[] } | undefined
    )?.content?.[0]?.text ?? "";
  return { text, parsed: text ? JSON.parse(text) : undefined };
}

/** Calls MCP `get_leaderboard` and returns its raw text and parsed payload. */
export async function mcpLeaderboard(kind: "team" | "individual") {
  return mcpTool("get_leaderboard", { kind });
}

/** Without a session, `/api/mcp` takes `Authorization: Bearer <MCP_TOKEN>`. */
export async function assertMcpBearerToken() {
  const initialize = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "0.1.0" },
    },
  };

  const wrongCheck = "POST /api/mcp with a wrong bearer token answers 401";
  try {
    const { status } = await mcpRequest(initialize, undefined, "", {
      Authorization: "Bearer not-the-token",
    });
    if (status === 401) ok(wrongCheck);
    else fail(wrongCheck, `status=${status}`);
  } catch (error) {
    fail(wrongCheck, String(error));
  }

  const check =
    "POST /api/mcp with the bearer token and no session completes initialize and get_current_war_week";
  try {
    const bearer = { Authorization: `Bearer ${MCP_TOKEN}` };
    const init = await mcpRequest(initialize, undefined, "", bearer);
    const call = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_current_war_week", arguments: {} },
      },
      init.sessionId,
      "",
      bearer,
    );
    const text = (
      call.json?.result as { content?: { text: string }[] } | undefined
    )?.content?.[0]?.text;
    const parsed = text ? JSON.parse(text) : undefined;
    if (
      init.status === 200 &&
      init.json?.result !== undefined &&
      parsed?.edition === "xi"
    ) {
      ok(check);
    } else {
      fail(
        check,
        `init=${init.status} ${JSON.stringify(init.json)} call=${call.status} ${JSON.stringify(call.json)}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function assertMcp() {
  try {
    const init = await mcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "smoke-test", version: "0.1.0" },
      },
    });
    const sessionId = init.sessionId;

    const toolsList = await mcpRequest(
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      sessionId,
    );
    const tools =
      (toolsList.json?.result as { tools?: { name: string }[] } | undefined)
        ?.tools ?? [];
    for (const name of [
      "get_current_war_week",
      "get_leaderboard",
      "get_schedule",
      "get_announcements",
      "get_awards",
      "get_discretionary_points",
      "get_faq",
      "list_history",
      "get_history",
      "get_bracket",
      "get_games",
      "get_participation",
      "get_placements",
    ]) {
      if (tools.some((tool) => tool.name === name)) {
        ok(`MCP tools/list includes ${name}`);
      } else {
        fail(
          `MCP tools/list includes ${name}`,
          `tools=${JSON.stringify(tools)}`,
        );
      }
    }

    const call = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_current_war_week", arguments: {} },
      },
      sessionId,
    );
    const result = call.json?.result as
      { content?: { type: string; text: string }[] } | undefined;
    const text = result?.content?.[0]?.text;
    const parsed = text ? JSON.parse(text) : undefined;

    if (parsed?.edition === "xi") {
      ok("MCP tools/call get_current_war_week returns edition xi");
    } else {
      fail(
        "MCP tools/call get_current_war_week returns edition xi",
        `result=${JSON.stringify(call.json)}`,
      );
    }

    for (const [id, kind] of [
      [4, "team"],
      [5, "individual"],
    ] as const) {
      const check = `MCP get_leaderboard(${kind}) returns Standings with numeric totals`;
      const leaderboard = await mcpRequest(
        {
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name: "get_leaderboard", arguments: { kind } },
        },
        sessionId,
      );
      const text = (
        leaderboard.json?.result as
          { content?: { type: string; text: string }[] } | undefined
      )?.content?.[0]?.text;
      const parsed = text ? JSON.parse(text) : undefined;
      if (
        parsed?.kind === kind &&
        !("hidden" in parsed) &&
        Array.isArray(parsed.standings) &&
        parsed.standings.length > 0 &&
        parsed.standings.every(
          (row: { total: unknown }) => typeof row.total === "number",
        )
      ) {
        ok(check);
      } else {
        fail(check, `result=${JSON.stringify(leaderboard.json)}`);
      }
    }

    for (const [id, args, check, expectDays] of [
      [
        6,
        { date: "2026-02-24" },
        "MCP get_schedule(2026-02-24) returns only that Day",
        ["2026-02-24"],
      ],
      [7, {}, "MCP get_schedule() returns all six XI Days", 6],
    ] as const) {
      const schedule = await mcpRequest(
        {
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name: "get_schedule", arguments: args },
        },
        sessionId,
      );
      const text = (
        schedule.json?.result as
          { content?: { type: string; text: string }[] } | undefined
      )?.content?.[0]?.text;
      const parsed = text ? JSON.parse(text) : undefined;
      const days = parsed?.days as
        { date: string; dayTheme: string; items: unknown[] }[] | undefined;
      const passed =
        parsed?.timeZone === "America/New_York" &&
        Array.isArray(days) &&
        (typeof expectDays === "number"
          ? days.length === expectDays
          : days.length === 1 &&
            days[0].date === expectDays[0] &&
            days[0].dayTheme === "Red vs. Blue" &&
            days[0].items.length > 0);
      if (passed) {
        ok(check);
      } else {
        fail(check, `result=${JSON.stringify(schedule.json)}`);
      }
    }

    const callTool = async (
      id: number,
      name: string,
      args: Record<string, unknown>,
    ) => {
      const res = await mcpRequest(
        {
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name, arguments: args },
        },
        sessionId,
      );
      const text = (
        res.json?.result as
          { content?: { type: string; text: string }[] } | undefined
      )?.content?.[0]?.text;
      return { raw: res.json, parsed: text ? JSON.parse(text) : undefined };
    };

    const announcementsLimited = await callTool(12, "get_announcements", {
      limit: 2,
    });
    const limited = announcementsLimited.parsed as
      | {
          edition: string;
          announcements: {
            title: string;
            pinned: boolean;
            body: string | null;
          }[];
        }
      | undefined;
    const firstAnnouncement = limited?.announcements?.[0];
    const limitedCheck =
      "MCP get_announcements(limit: 2) returns edition xi, 2 Announcements, welcome pinned first with its video URL and body";
    if (
      limited?.edition === "xi" &&
      limited.announcements.length === 2 &&
      firstAnnouncement?.pinned === true &&
      firstAnnouncement.title === "Welcome to War Week XI" &&
      typeof firstAnnouncement.body === "string" &&
      firstAnnouncement.body.includes(
        "https://www.youtube.com/watch?v=vKQi3bBA1y8",
      ) &&
      firstAnnouncement.body.includes("Choose your pill")
    ) {
      ok(limitedCheck);
    } else {
      fail(limitedCheck, `result=${JSON.stringify(announcementsLimited.raw)}`);
    }

    const announcementsAll = await callTool(13, "get_announcements", {});
    const allCount = (
      announcementsAll.parsed as { announcements?: unknown[] } | undefined
    )?.announcements?.length;
    const allCheck = "MCP get_announcements() returns all 3 Announcements";
    if (allCount === 3) {
      ok(allCheck);
    } else {
      fail(allCheck, `result=${JSON.stringify(announcementsAll.raw)}`);
    }

    // Profile names only: no MCP tool returns an email.
    for (const [id, name, args] of [
      [18, "get_announcements", {}],
      [19, "get_leaderboard", { kind: "team" }],
      [20, "get_leaderboard", { kind: "individual" }],
    ] as const) {
      const check = `MCP ${name}(${JSON.stringify(args)}) returns no @ anywhere`;
      const res = await callTool(id, name, args);
      if (res.parsed !== undefined && !JSON.stringify(res.raw).includes("@")) {
        ok(check);
      } else {
        fail(check, `result=${JSON.stringify(res.raw)}`);
      }
    }

    const awards = await callTool(14, "get_awards", {});
    const awardsCheck =
      "MCP get_awards returns XI's three seeded Awards with the same recipients as /xi/awards";
    const mcpAwards = awards.parsed?.awards as
      { name: string; participants: string[] }[] | undefined;
    const sameAwards =
      awards.parsed?.edition === "xi" &&
      mcpAwards?.length === XI_AWARDS.length &&
      XI_AWARDS.every((expected) => {
        const found = mcpAwards.find((a) => a.name === expected.name);
        return (
          found &&
          JSON.stringify([...found.participants].sort()) ===
            JSON.stringify([...expected.recipients].sort())
        );
      });
    if (sameAwards) ok(awardsCheck);
    else fail(awardsCheck, `result=${JSON.stringify(awards.raw)}`);

    // 17-M: a Head-to-head Competition by name, never an email; get_bracket
    // points to get_games.
    const games = await callTool(16, "get_games", {
      competition: "Bouncy Pong",
    });
    const gamesCheck =
      "MCP get_games(Bouncy Pong) returns its head-to-head settings, leaderboard and Games with no @";
    if (
      games.parsed?.found === true &&
      games.parsed.competition?.name === "Bouncy Pong" &&
      games.parsed.competition?.format === "head-to-head" &&
      Array.isArray(games.parsed.leaderboard) &&
      Array.isArray(games.parsed.games) &&
      !JSON.stringify(games.parsed).includes("@")
    ) {
      ok(gamesCheck);
    } else {
      fail(gamesCheck, `result=${JSON.stringify(games.raw)}`);
    }
    const gamesBracket = await callTool(17, "get_bracket", {
      competition: "Bouncy Pong",
    });
    const gamesBracketCheck =
      "MCP get_bracket(Bouncy Pong) answers bracket: null, run as Head-to-head, pointing to get_games";
    if (
      gamesBracket.parsed?.found === true &&
      gamesBracket.parsed.bracket === null &&
      String(gamesBracket.parsed.message).includes(
        "run as Head-to-head or Best score",
      ) &&
      String(gamesBracket.parsed.message).includes("get_games")
    ) {
      ok(gamesBracketCheck);
    } else {
      fail(gamesBracketCheck, `result=${JSON.stringify(gamesBracket.raw)}`);
    }

    const participation = await callTool(18, "get_participation", {
      competition: "Daily Workout Check-in",
    });
    const participationCheck =
      "MCP get_participation(Daily Workout Check-in) returns its settings and who took part with no @";
    if (
      participation.parsed?.found === true &&
      participation.parsed.competition?.name === "Daily Workout Check-in" &&
      Array.isArray(participation.parsed.tookPart) &&
      !JSON.stringify(participation.parsed).includes("@")
    ) {
      ok(participationCheck);
    } else {
      fail(participationCheck, `result=${JSON.stringify(participation.raw)}`);
    }

    // Speed Chess is seeded as an individual, Finalized Placement Competition
    // with one row (James Novak, 1st); the sheet comes by name only.
    const placements = await callTool(19, "get_placements", {
      competition: "Speed Chess",
    });
    const placementsCheck =
      "MCP get_placements(Speed Chess) returns its sheet by name with no @";
    if (
      placements.parsed?.found === true &&
      placements.parsed.competition?.name === "Speed Chess" &&
      Array.isArray(placements.parsed.placements) &&
      placements.parsed.placements.length === 1 &&
      !JSON.stringify(placements.parsed).includes("@")
    ) {
      ok(placementsCheck);
    } else {
      fail(placementsCheck, `result=${JSON.stringify(placements.raw)}`);
    }

    // Every Format reads back by name: Best score and Participation through
    // get_games and get_bracket, Placement through get_bracket, and the
    // Discretionary points list.
    const bestScore = await callTool(20, "get_games", {
      competition: "Tuesday Stairs",
    });
    const bestScoreCheck =
      "MCP get_games(Tuesday Stairs) returns the Best score Format with no @";
    if (
      bestScore.parsed?.found === true &&
      bestScore.parsed.competition?.format === "best-score" &&
      Array.isArray(bestScore.parsed.games) &&
      !JSON.stringify(bestScore.parsed).includes("@")
    ) {
      ok(bestScoreCheck);
    } else {
      fail(bestScoreCheck, `result=${JSON.stringify(bestScore.raw)}`);
    }
    const participationBracket = await callTool(21, "get_bracket", {
      competition: "Daily Workout Check-in",
    });
    const participationBracketCheck =
      "MCP get_bracket(Daily Workout Check-in) answers bracket: null with no @";
    if (
      participationBracket.parsed?.found === true &&
      participationBracket.parsed.bracket === null &&
      !JSON.stringify(participationBracket.parsed).includes("@")
    ) {
      ok(participationBracketCheck);
    } else {
      fail(
        participationBracketCheck,
        `result=${JSON.stringify(participationBracket.raw)}`,
      );
    }
    const placementBracket = await callTool(22, "get_bracket", {
      competition: "Speed Chess",
    });
    const placementBracketCheck =
      "MCP get_bracket(Speed Chess) answers bracket: null, run as Placement, pointing to get_placements";
    if (
      placementBracket.parsed?.found === true &&
      placementBracket.parsed.bracket === null &&
      placementBracket.parsed.competition?.format === "placement" &&
      String(placementBracket.parsed.message).includes("get_placements")
    ) {
      ok(placementBracketCheck);
    } else {
      fail(
        placementBracketCheck,
        `result=${JSON.stringify(placementBracket.raw)}`,
      );
    }
    const discretionary = await callTool(23, "get_discretionary_points", {});
    const discretionaryCheck =
      "MCP get_discretionary_points returns edition xi and its list with no @";
    if (
      discretionary.parsed?.edition === "xi" &&
      Array.isArray(discretionary.parsed.discretionaryPoints) &&
      !JSON.stringify(discretionary.parsed).includes("@")
    ) {
      ok(discretionaryCheck);
    } else {
      fail(discretionaryCheck, `result=${JSON.stringify(discretionary.raw)}`);
    }

    const faq = await callTool(15, "get_faq", {});
    const faqCheck =
      "MCP get_faq returns XI's six FAQ Items in seed order with plain-text answers";
    const mcpFaq = faq.parsed?.faq as
      { question: string; answer: string | null }[] | undefined;
    if (
      faq.parsed?.edition === "xi" &&
      JSON.stringify(mcpFaq?.map((f) => f.question)) ===
        JSON.stringify(XI_FAQ_QUESTIONS) &&
      mcpFaq?.[5].answer ===
        "They're very welcome. Let Jason know so the proper arrangements can be made."
    ) {
      ok(faqCheck);
    } else {
      fail(faqCheck, `result=${JSON.stringify(faq.raw)}`);
    }

    const list = await callTool(8, "list_history", {});
    const years = (
      list.parsed?.warWeeks as { year: number }[] | undefined
    )?.map((w) => w.year);
    const expectedYears = Array.from({ length: 10 }, (_, i) => 2025 - i);
    if (JSON.stringify(years) === JSON.stringify(expectedYears)) {
      ok("MCP list_history returns 2025 down to 2016");
    } else {
      fail(
        "MCP list_history returns 2025 down to 2016",
        `result=${JSON.stringify(list.raw)}`,
      );
    }

    const y2023 = await callTool(9, "get_history", { year: 2023 });
    const p = y2023.parsed;
    if (
      p?.found === true &&
      p.edition === "viii" &&
      p.winner === "Slytherin" &&
      p.teams?.length === 4 &&
      p.awards?.some((a: { name: string }) => a.name === "House Cup") &&
      p.highlights?.length > 0 &&
      String(p.wikiUrl).endsWith("war-week-2023")
    ) {
      ok(
        "MCP get_history(2023) returns the stored winner, Houses, Awards and wiki link",
      );
    } else {
      fail(
        "MCP get_history(2023) returns the stored winner, Houses, Awards and wiki link",
        `result=${JSON.stringify(y2023.raw)}`,
      );
    }

    for (const [id, year] of [
      [10, 2030],
      [11, 2026],
    ] as const) {
      const check = `MCP get_history(${year}) returns a clear not-found result`;
      const missing = await callTool(id, "get_history", { year });
      if (
        missing.parsed?.found === false &&
        String(missing.parsed.message).includes(
          `No past War Week found for ${year}`,
        )
      ) {
        ok(check);
      } else {
        fail(check, `result=${JSON.stringify(missing.raw)}`);
      }
    }
  } catch (error) {
    fail("MCP requests succeed", String(error));
  }
}
