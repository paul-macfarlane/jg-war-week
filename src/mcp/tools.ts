/**
 * Title and description of every tool `/api/mcp` registers, keyed by tool
 * name. The route spreads these into `registerTool`, and `/llms.txt` lists
 * them, so both read the same copy.
 */
export const MCP_TOOLS = {
  get_current_war_week: {
    title: "Get current War Week",
    description:
      "Returns the current War Week: the live one, else the next upcoming one, else the most recent complete one.",
  },
  get_leaderboard: {
    title: "Get leaderboard",
    description:
      "Returns the current War Week's team or individual Standings, ranked by total points.",
  },
  get_schedule: {
    title: "Get schedule",
    description:
      "Returns the current War Week's schedule, grouped by Day with each Day Theme. Pass a date (YYYY-MM-DD) for one Day; omit it for the whole week. All times are ET (America/New_York) wall-clock HH:MM.",
  },
  get_announcements: {
    title: "Get Announcements",
    description:
      "Returns the current War Week's recent Announcements as readable text, pinned first then newest first, with title, author, published time, plain-text body (a video is its URL).",
  },
  get_awards: {
    title: "Get Awards",
    description:
      "Returns the current War Week's Awards by name, each with its description and recipients: a Team, Participants, or both. Awards don't affect Standings.",
  },
  get_faq: {
    title: "Get FAQ",
    description:
      "Returns the current War Week's FAQ in order: each question with its answer as plain text.",
  },
  list_history: {
    title: "List War Week history",
    description:
      "Lists every past (complete) War Week in the Archive, newest first: edition, year, dates, Story Theme, stored winner and original wiki link.",
  },
  get_history: {
    title: "Get a past War Week",
    description:
      "Returns one past War Week by year: Story Theme, dates, Teams and colors, the stored winner, Awards with recipients, highlights and the original wiki link. A year not in the Archive returns found: false.",
  },
  get_bracket: {
    title: "Get Bracket",
    description:
      "Returns a Competition's Bracket by name: Entrants by Seed Position, each Round's Heats with status, time and place, and the champion once finalized. A Competition run by points instead returns bracket: null; an unknown Competition returns found: false.",
  },
  get_games: {
    title: "Get Head-to-head and Best score",
    description:
      "Returns a Head-to-head or Best score Competition by name: its Format, settings, leaderboard ranked by that Format, and its logged Games newest first. A Competition run another way instead returns games: null; an unknown Competition returns found: false.",
  },
  get_participation: {
    title: "Get Participation",
    description:
      "Returns a Competition run as Participation (points for taking part) by name: its scoring settings, whether Participants can check in and until when, whether it's closed, who took part by name, and in team scoring each Team's headcount and place. A Competition run another way instead returns participation: null; an unknown Competition returns found: false.",
  },
} satisfies Record<string, { title: string; description: string }>;
