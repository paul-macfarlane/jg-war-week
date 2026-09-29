import { REPO_URL } from "@/lib/site";
import type { ThemeColors } from "@/lib/theme";

/**
 * The Privacy and Terms pages' theme: static copy with no War Week data
 * (ticket 28), so it's copied here from `seeds/xi.json` rather than read at
 * request time. Unlike `/about` (ticket 03), those two pages don't follow
 * the current War Week; update this together with `seeds/xi.json` if XI's
 * look changes.
 */
export const ABOUT_THEME: ThemeColors = {
  primaryColor: "#00ff41",
  primaryForegroundColor: "#000000",
  accentColor: "#008f11",
  backgroundColor: "#000000",
  foregroundColor: "#d1ffd6",
  fontPreset: "mono",
};

/**
 * `/about`'s theme (ticket 03) when no War Week exists at all (an empty
 * database, e.g. before the first `seed:load`): a neutral black-on-white
 * look so the page stays readable rather than wearing a stale edition's
 * colors. Whenever a War Week exists, `/about` wears *its* Appearance
 * Theme instead (`getCurrentWarWeek`, same resolution the root page uses:
 * live, else next upcoming, else most recent completed).
 */
export const ABOUT_FALLBACK_THEME: ThemeColors = {
  primaryColor: "#111111",
  primaryForegroundColor: "#ffffff",
  accentColor: "#e5e5e5",
  backgroundColor: "#ffffff",
  foregroundColor: "#111111",
  fontPreset: "sans",
};

/** The maintainer's guide (ticket 31), read on GitHub. */
export const MAINTAINERS_GUIDE_URL = `${REPO_URL}/blob/main/docs/maintainers-guide.md`;

/**
 * The eight feature cards, in order. Each `slug` names a still at
 * `public/about/<slug>.png`, written by `scripts/about-media.ts`; the
 * Finale is the video hero, not a card.
 */
export const ABOUT_FEATURES = [
  {
    slug: "organizer-setup",
    title: "Organizer setup, no code",
    text: "War Week, Days, Teams, roster, Competitions, schedule and FAQ are all Organizer screens under Admin. Organizers can hand a Competition to its Hosts, who see just that Competition and enter its points themselves. Next year's edition takes an afternoon, not a code editor.",
    alt: "The Admin Setup screen listing War Week, Days, Teams, Competitions, Schedule and FAQ.",
  },
  {
    slug: "points",
    title: "Points entry with Placement Points",
    text: "Pick the Competition, pick the Team or Participant, tap “1st · 5”. Placement Points are presets an Organizer sets once per Competition (with an optional Max points cap on 1st place; going over it still saves, with a warning), so scoring is one tap and the Standings move on the spot. Every Standings row expands to show the Points Entries behind its total, newest first.",
    alt: "The Points Entry form with Settlers of Catan selected and the 1st, 2nd and 3rd Placement Points buttons.",
  },
  {
    slug: "schedule",
    title: "Schedule with Now / Next",
    text: "Every Day Theme and every item on the ET clock, with day chips to jump straight to one Day. The home screen says what's on now and what's up next, so nobody has to ask.",
    alt: "War Week XI's home: today's Day Theme, what's on now and what's up next on the ET clock, then the pinned Announcement.",
  },
  {
    slug: "announcements",
    title: "Announcements with video",
    text: "Organizers post rich-text Announcements with video, pin one to the home screen, and everyone sees it on the next refresh.",
    alt: "War Week XI's Announcements feed with an embedded welcome video.",
  },
  {
    slug: "brackets",
    title: "Brackets for knockouts and Heats",
    text: "Choose a Competition's Format — Single elimination or Heats — when you add it, land straight on its Bracket setup, pick its Entrants (Teams, Participants, or Squads: named groups from one Team whose points go to that Team) and Generate a Bracket, or draw its Seed Positions By Standings. The Bracket reads as a tree on the Competition page: Rounds left to right for single elimination, or a box per Heat with advancers highlighted, one Round at a time on a phone; a List toggle keeps the old view. Recording or reporting a Heat's result opens a dialog centered on a screen and a bottom sheet on a phone. Finalize turns the Bracket's placings straight into Points Entries, and the Bracket gets its own Finale for the projector.",
    alt: "A Bracket shown as a tree on its Competition page: Rounds joined by lines, with results filled in live.",
  },
  {
    slug: "lifecycle",
    title: "One War Week live at a time",
    text: 'Start, End (the Winner computed from first place in the Standings, ties recorded as "Tie: A & B") and Reopen move a War Week through its lifecycle. Only one is ever live; Create next War Week starts the next edition without disturbing this one.',
    alt: "The Admin Setup screen's Lifecycle box: Start, End and Reopen.",
  },
  {
    slug: "archive",
    title: "The Archive",
    text: "Every War Week since 2016, each in its own theme: the Story Theme, the Teams, the winner, the Awards and the highlights, with a link to the original wiki page.",
    alt: "The War Week history page: one card per edition since 2016, each in its own colors.",
  },
  {
    slug: "ask-claude",
    title: "Ask Claude",
    text: "Add the JG War Week app to Claude as an MCP connector and ask who's winning, what's on this afternoon, or who won War Week VIII. Read-only, with the same Standings everyone sees.",
    alt: "A chat with Claude asking who's winning War Week XI, answered from the JG War Week app's MCP connector.",
  },
] as const;
