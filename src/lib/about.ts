import { REPO_URL } from "@/lib/site";
import type { ThemeColors } from "@/lib/theme";

/**
 * Everything the public About page (ticket 28) needs that would otherwise
 * come from the database. The page is static copy and media only, so War
 * Week XI's Appearance Theme is copied here from `seeds/xi.json` rather
 * than read at request time. Update both together when XI's look changes.
 */
export const ABOUT_THEME: ThemeColors = {
  primaryColor: "#00ff41",
  primaryForegroundColor: "#000000",
  accentColor: "#008f11",
  backgroundColor: "#000000",
  foregroundColor: "#d1ffd6",
  fontPreset: "mono",
};

/** The War Week the page opens at the end. */
export const CURRENT_EDITION = { label: "XI", href: "/xi" } as const;

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
    text: "Pick the Competition, pick the Team or Participant, tap “1st · 5”. Placement Points are presets an Organizer sets once per Competition, so scoring is one tap and the Standings move on the spot.",
    alt: "The Points Entry form with Settlers of Catan selected and the 1st, 2nd and 3rd Placement Points buttons.",
  },
  {
    slug: "schedule",
    title: "Schedule with Now / Next",
    text: "Every Day Theme and every item on the ET clock. The home screen says what's on now and what's up next, so nobody has to ask.",
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
    title: "Brackets for knockout Competitions",
    text: "Set a Competition's Format to single elimination, pick its Entrants (Teams or Participants) and Generate a Bracket. Tap in each Heat's winner as it's played; Finalize turns the Bracket's placings straight into Points Entries.",
    alt: "A Participant's Bracket view: Heats grouped by Round, with the champion card at the end.",
  },
  {
    slug: "lifecycle",
    title: "One War Week live at a time",
    text: "Start, End (with the Winner and highlights) and Reopen move a War Week through its lifecycle. Only one is ever live; Create next War Week starts the next edition without disturbing this one.",
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
