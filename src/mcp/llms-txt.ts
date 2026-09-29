import { REPO_URL } from "@/lib/site";
import { MCP_TOOLS } from "@/mcp/tools";

const PAGES: [path: string, purpose: string][] = [
  ["/", "Redirects to the current War Week's home."],
  [
    "/<edition>",
    "A War Week's home (edition as a lowercase Roman numeral, e.g. /xi): what's on now and next, pinned Announcements.",
  ],
  ["/<edition>/leaderboard", "Team and individual Standings."],
  [
    "/<edition>/finale",
    "The closing-ceremony playback of the Standings, last place to first.",
  ],
  [
    "/<edition>/finale/<competitionId>",
    "A finalized Bracket's Finale: its final placings, last place to the champion.",
  ],
  ["/<edition>/schedule", "The schedule, grouped by Day with each Day Theme."],
  ["/<edition>/news", "Announcements, pinned first then newest first."],
  ["/<edition>/teams", "Teams and their rosters."],
  ["/<edition>/competitions", "Competitions and their results."],
  ["/<edition>/awards", "Awards and their recipients."],
  ["/<edition>/faq", "Frequently asked questions."],
  ["/<edition>/more", "Links to the rest of the War Week's pages."],
  ["/history", "The Archive of past War Weeks, 2016 onward."],
  ["/install", "How to install JG War Week as an app."],
  [
    "/admin",
    "For Organizers and Hosts: Points Entry, Bracket builder and results (with each Heat's time and place), Games settings and log, Standings, Announcements, Awards, and Setup (War Week settings, Appearance Theme, Days).",
  ],
  ["/sign-in", "Google sign-in with a @jahnelgroup.com account."],
];

/**
 * The `/llms.txt` body (llmstxt.org shape). Static copy only: it's served
 * without a session, so it must never include War Week data.
 */
export function llmsTxt(origin: string): string {
  const pages = PAGES.map(
    ([path, purpose]) => `- \`${path}\`: ${purpose}`,
  ).join("\n");
  const tools = Object.entries(MCP_TOOLS)
    .map(([name, tool]) => `- \`${name}\`: ${tool.description}`)
    .join("\n");

  return `# JG War Week

> The JG War Week app is where Jahnel Group organizers run War Week, the company's annual week of team competitions, and where participants follow it: themes, schedule, teams, competitions (points-based, or Brackets run single elimination or Heats), points, awards and announcements, the Finale, plus a history of past War Weeks.

Every page and API route except sign-in needs a signed-in Jahnel Group account.

Exactly one War Week is live at a time; \`get_current_war_week\` returns it (the
live one, else the next upcoming one, else the latest complete one). Complete
editions stay in the Archive at \`/history\`. Standings are never hidden: they
are always the current Standings, live or complete. The Finale
(\`/<edition>/finale\`) is a closing-ceremony playback of those Standings, not
a separate result — it changes nothing. Some Competitions run as a Bracket
(single elimination or Heats) instead of plain points; \`get_bracket\` reads
one by Competition name, with its Squads by name.

## Pages

${pages}

## MCP

A read-only Model Context Protocol server over Streamable HTTP at ${origin}/api/mcp. Every tool returns only what a signed-in participant sees, and no tool returns an email.

${tools}

## Access

- Browser: sign in with Google using a @jahnelgroup.com account.
- MCP: send \`Authorization: Bearer <MCP_TOKEN>\`, a token the JG War Week app operators issue. A signed-in browser session also works. Otherwise it answers 401.
- Claude Code: \`claude mcp add --transport http jg-war-week ${origin}/api/mcp --header "Authorization: Bearer <MCP_TOKEN>"\`

## Source

- [GitHub repository](${REPO_URL})
`;
}
