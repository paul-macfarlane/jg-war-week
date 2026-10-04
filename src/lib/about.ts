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
 * The feature cards, in the app's navigation order with the Admin card first. Each
 * `slug` names a still at `public/about/<slug>.png`, written by
 * `scripts/about-media.ts`. The hero is the Standings stills; the Finale is
 * a still poster (its Title slide) below the grid, not a card. Copy is
 * mode-neutral: it reads the same for Teams and free-for-all editions.
 */
export const ABOUT_FEATURES = [
  {
    slug: "organizer-admin",
    title: "Organizer and Host admin",
    text: "Organizers run the whole War Week from one Admin nav: the Days and schedule, the roster (paste it in from a sheet), Competitions, Announcements, Awards, FAQ and settings. Hosts get just their Competition and record its results themselves.",
    alt: "The Admin Schedule page with the flat Admin nav (Competitions, Discretionary points, Schedule, Roster and more) beside the War Week's Days and their Schedule Items.",
  },
  {
    slug: "schedule",
    title: "Schedule, Now and Next",
    text: "Every Day Theme, with a line about each Day, and every item on the ET clock. The home screen says what's on now and what's up next, so nobody has to ask.",
    alt: "The current War Week's home: today's Day Theme, what's on now and what's up next on the ET clock, then the pinned Announcement.",
  },
  {
    slug: "points",
    title: "Points and Standings",
    text: "A Competition's results turn into points through its Placement Points, and Discretionary points reward what no Competition covers; the Standings move on the spot. Sign in and you're highlighted on the leaderboards, the roster and your Brackets, under the name and picture you set in your Profile.",
    alt: "The Give Discretionary points form open over the Admin Discretionary points page, asking for a Participant, a number of points and a reason.",
  },
  {
    slug: "announcements",
    title: "Announcements",
    text: "Organizers post rich-text Announcements, videos included, and pin one to the home screen for everyone.",
    alt: "The current War Week's Announcements feed with its pinned welcome Announcement.",
  },
  {
    slug: "competitions",
    title:
      "Competitions: Placements, Brackets, Head-to-head, Best score and Participation",
    text: "Run a Competition as a Placement sheet (who came 1st, 2nd, 3rd), a Bracket (a head-to-head knockout, or Group Matches of several Entrants), a Head-to-head series between two Entrants, Best score Attempts, or Participation: the Host ticks who took part, or people check themselves in. Set which Score wins, higher or lower, and its unit, and the places and Winners follow the Scores. Hosts log results, or turn on 'Participants can log their own results' so players do it from a phone. Close turns the results into points; Reopen to correct them.",
    alt: "A finished Bracket on its Competition page: two Round 1 Matches of Participants feeding the Final, with its Winner on top.",
  },
  {
    slug: "archive",
    title: "The Archive",
    text: "Past War Weeks, each in its own theme: the Story Theme, the winner, the Awards and the highlights. Award Categories show every year's recipients through the years.",
    alt: "The War Week history page: one card per edition, each in its own colors.",
  },
] as const;
