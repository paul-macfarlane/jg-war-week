import type { ThemeColors } from "@/lib/theme";

/**
 * The theme of `/about`, `/privacy` and `/terms` (tickets 03, 44) when no
 * War Week exists at all (an empty database, e.g. before the first
 * `seed:load`): a neutral black-on-white look so the page stays readable rather than wearing a stale edition's
 * colors. Whenever a War Week exists, those pages wear *its* Appearance
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

/**
 * The feature cards, in the app's navigation order with setup first. Each
 * `slug` names a still at `public/about/<slug>.png`, written by
 * `scripts/about-media.ts`. The hero is the Standings stills; the Finale is a
 * still poster below the grid, not a card. Copy is mode-neutral: it reads
 * the same for Teams and free-for-all editions.
 */
export const ABOUT_FEATURES = [
  {
    slug: "organizer-setup",
    title: "Organizer and Host setup",
    text: "Organizers set up the War Week, Days, schedule, roster and Competitions under Admin. Hosts get just their Competition and enter its points themselves.",
    alt: "The Admin Setup screen listing War Week, Days, Teams & roster, Competitions, Schedule and FAQ.",
  },
  {
    slug: "schedule",
    title: "Schedule, Now and Next",
    text: "Every Day Theme and every item on the ET clock. The home screen says what's on now and what's up next, so nobody has to ask.",
    alt: "The current War Week's home: today's Day Theme, what's on now and what's up next on the ET clock, then the pinned Announcement.",
  },
  {
    slug: "points",
    title: "Points and Standings",
    text: "Scoring is one tap with Placement Points, and the Standings move on the spot. Sign in and you're highlighted wherever you appear.",
    alt: "The Points Entry form with Mile Run selected, a Participant to choose, and the 1st, 2nd and 3rd Placement Points buttons beside the current Standings.",
  },
  {
    slug: "announcements",
    title: "Announcements",
    text: "Organizers post rich-text Announcements with video and pin one to the home screen for everyone.",
    alt: "The current War Week's Announcements feed with its pinned welcome Announcement.",
  },
  {
    slug: "competitions",
    title: "Competitions: Brackets and Games",
    text: "Run a Competition as a Bracket or as Games players log themselves from a phone. Finalizing or closing it turns the results into Placement Points.",
    alt: "A finished Bracket on its Competition page: two Round 1 Heats of Participants feeding the Final, with its champion on top.",
  },
  {
    slug: "archive",
    title: "The Archive",
    text: "Past War Weeks, each in its own theme: the Story Theme, the winner, the Awards and the highlights.",
    alt: "The War Week history page: one card per edition, each in its own colors.",
  },
] as const;
