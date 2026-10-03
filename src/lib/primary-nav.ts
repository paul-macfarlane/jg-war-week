/** Which nav surface renders the destinations. */
export type NavSurface = "phone" | "desktop";

export type NavKey =
  | "home"
  | "schedule"
  | "competitions"
  | "leaderboard"
  | "announcements"
  | "more";

export type NavDestination = {
  key: NavKey;
  label: string;
  href: string;
  // Pages reached from this destination that keep it highlighted.
  subpaths?: string[];
};

/**
 * The participant nav, in order. The phone tab bar has five tabs with
 * Announcements inside More; the desktop top nav lists Announcements itself.
 */
export function destinationsFor(
  edition: string,
  surface: NavSurface,
): NavDestination[] {
  const moreSubpaths = [
    `/${edition}/teams`,
    `/${edition}/awards`,
    `/${edition}/faq`,
  ];
  return [
    { key: "home", label: "Home", href: `/${edition}` },
    { key: "schedule", label: "Schedule", href: `/${edition}/schedule` },
    {
      key: "competitions",
      label: "Competitions",
      href: `/${edition}/competitions`,
    },
    {
      key: "leaderboard",
      label: "Leaderboard",
      href: `/${edition}/leaderboard`,
    },
    ...(surface === "desktop"
      ? [
          {
            key: "announcements" as const,
            label: "Announcements",
            href: `/${edition}/announcements`,
          },
        ]
      : []),
    {
      key: "more",
      label: "More",
      href: `/${edition}/more`,
      subpaths:
        surface === "phone"
          ? [`/${edition}/announcements`, ...moreSubpaths]
          : moreSubpaths,
    },
  ];
}

/** Whether `pathname` is on `destination` (Home matches only exactly). */
export function isActive(
  pathname: string,
  destination: NavDestination,
  edition: string,
) {
  const { href } = destination;
  if (href === `/${edition}`) return pathname === href;
  return [href, ...(destination.subpaths ?? [])].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
