import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

import { toAnnouncementsResult } from "@/mcp/announcements";
import { toAwardsResult } from "@/mcp/awards";
import { toBracketResult } from "@/mcp/bracket";
import { toFaqResult } from "@/mcp/faq";
import { toHistoryListResult, toHistoryResult } from "@/mcp/history";
import { toLeaderboardResult } from "@/mcp/leaderboard";
import { toScheduleResult } from "@/mcp/schedule";
import { MCP_TOOLS } from "@/mcp/tools";
import { toCurrentWarWeekResult } from "@/mcp/war-week";
import { getAnnouncements } from "@/queries/announcements";
import { getArchiveDetailByYear, listArchive } from "@/queries/archive";
import { getAwards } from "@/queries/awards";
import { getBracket } from "@/queries/brackets";
import { getCompetitionByName } from "@/queries/competitions";
import { getFaqItems } from "@/queries/faq";
import { getSchedule } from "@/queries/schedule";
import { getSetupDays } from "@/queries/setup";
import { getStandings } from "@/queries/standings";
import { getCurrentWarWeek } from "@/queries/war-weeks";

export const dynamic = "force-dynamic";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_current_war_week",
      {
        ...MCP_TOOLS.get_current_war_week,
        inputSchema: z.object({}),
      },
      async () => {
        // No outputSchema: the SDK rejects a declared schema without
        // structuredContent, and the no-current-War-Week result is a
        // different shape ({ warWeek: null }) from the populated one.
        const warWeek = await getCurrentWarWeek();
        const result = toCurrentWarWeekResult(warWeek);

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      },
    );

    server.registerTool(
      "get_leaderboard",
      {
        ...MCP_TOOLS.get_leaderboard,
        inputSchema: z.object({
          kind: z
            .enum(["team", "individual"])
            .describe("Which leaderboard: team standings or individual."),
        }),
      },
      async ({ kind }) => {
        const warWeek = await getCurrentWarWeek();
        const result = warWeek
          ? toLeaderboardResult(
              await getStandings(warWeek),
              kind,
              warWeek.teamLabel,
            )
          : { warWeek: null };

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      },
    );

    server.registerTool(
      "get_schedule",
      {
        ...MCP_TOOLS.get_schedule,
        inputSchema: z.object({
          date: z.iso
            .date()
            .optional()
            .describe("A Day's date, YYYY-MM-DD. Omit for the full schedule."),
        }),
      },
      async ({ date }) => {
        const warWeek = await getCurrentWarWeek();
        const result = warWeek
          ? toScheduleResult(
              warWeek.edition,
              await getSchedule(warWeek.id, { date }),
              date,
            )
          : { warWeek: null };

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      },
    );

    server.registerTool(
      "get_announcements",
      {
        ...MCP_TOOLS.get_announcements,
        inputSchema: z.object({
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .optional()
            .describe(
              "How many Announcements to return, 1-50. Defaults to 10.",
            ),
        }),
      },
      async ({ limit }) => {
        const warWeek = await getCurrentWarWeek();
        const result = warWeek
          ? toAnnouncementsResult(
              warWeek.edition,
              await getAnnouncements(warWeek, { limit: limit ?? 10 }),
            )
          : { warWeek: null };

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      },
    );

    server.registerTool(
      "get_awards",
      {
        ...MCP_TOOLS.get_awards,
        inputSchema: z.object({}),
      },
      async () => {
        const warWeek = await getCurrentWarWeek();
        const result = warWeek
          ? toAwardsResult(warWeek.edition, await getAwards(warWeek))
          : { warWeek: null };

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      },
    );

    server.registerTool(
      "get_faq",
      {
        ...MCP_TOOLS.get_faq,
        inputSchema: z.object({}),
      },
      async () => {
        const warWeek = await getCurrentWarWeek();
        const result = warWeek
          ? toFaqResult(warWeek.edition, await getFaqItems(warWeek))
          : { warWeek: null };

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      },
    );

    server.registerTool(
      "list_history",
      {
        ...MCP_TOOLS.list_history,
        inputSchema: z.object({}),
      },
      async () => {
        const result = toHistoryListResult(await listArchive());

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      },
    );

    server.registerTool(
      "get_history",
      {
        ...MCP_TOOLS.get_history,
        inputSchema: z.object({
          year: z.number().int().describe("The War Week's year, e.g. 2023."),
        }),
      },
      async ({ year }) => {
        const result = toHistoryResult(
          year,
          await getArchiveDetailByYear(year),
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      },
    );

    server.registerTool(
      "get_bracket",
      {
        ...MCP_TOOLS.get_bracket,
        inputSchema: z.object({
          competition: z
            .string()
            .trim()
            .min(1)
            .describe("The Competition's name, in the current War Week."),
        }),
      },
      async ({ competition }) => {
        const warWeek = await getCurrentWarWeek();
        if (!warWeek) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ warWeek: null }) },
            ],
          };
        }
        const found = await getCompetitionByName(warWeek, competition);
        const [view, days] = await Promise.all([
          found ? getBracket(found.id) : Promise.resolve(undefined),
          getSetupDays(warWeek),
        ]);
        const result = toBracketResult(view, days, competition);

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      },
    );
  },
  { serverInfo: { name: "jg-war-week", version: "0.1.0" } },
);

export { handler as GET, handler as POST };
