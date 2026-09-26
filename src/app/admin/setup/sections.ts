/**
 * The `/admin/setup` sections. A section with no `href` isn't built yet and
 * shows as "Soon". A Host sees only the sections that aren't
 * `organizerOnly`: their Competitions and Schedule Items.
 */
export const SETUP_SECTIONS: {
  label: string;
  description: string;
  href: string | null;
  organizerOnly: boolean;
}[] = [
  {
    label: "War Week",
    description:
      "Story Theme, dates, mode, labels, links, the Appearance Theme, Winner and highlights.",
    href: "/admin/setup/war-week",
    organizerOnly: true,
  },
  {
    label: "Days",
    description: "The War Week's Days and their Day Themes.",
    href: "/admin/setup/days",
    organizerOnly: true,
  },
  {
    label: "Teams & roster",
    description: "Teams, Participants and Leaders.",
    href: "/admin/setup/teams",
    organizerOnly: true,
  },
  {
    label: "Competitions",
    description: "Competitions, scoring, Placement Points and Hosts.",
    href: "/admin/setup/competitions",
    organizerOnly: false,
  },
  {
    label: "Schedule",
    description: "Schedule Items for each Day.",
    href: "/admin/setup/schedule",
    organizerOnly: false,
  },
  {
    label: "FAQ",
    description: "FAQ Items and their order.",
    href: "/admin/setup/faq",
    organizerOnly: true,
  },
];
