/**
 * Every `/admin` section, in nav order: the side column and, on a phone,
 * the bottom bar and its More Sheet. `organizerOnly` sections are hidden
 * from Hosts; `tab` sections get a tab on the phone's bottom bar (the rest
 * go in More). `tabLabel` is the shorter text a tab shows on the bar, where
 * the full label would not fit; the tab's accessible name stays the full
 * label. `icon` is a key; components map it to the icon
 * (`AdminSectionIcon`), as src/lib never imports icons (ADR 0001).
 */
const ADMIN_SECTIONS = [
  {
    label: "Competitions",
    icon: "competitions",
    href: "/admin/competitions",
    tab: true,
  },
  {
    label: "Discretionary points",
    tabLabel: "Points",
    icon: "points",
    href: "/admin/discretionary-points",
    tab: true,
    organizerOnly: true,
  },
  {
    label: "Schedule",
    icon: "schedule",
    href: "/admin/schedule",
    tab: true,
    organizerOnly: true,
  },
  {
    label: "Roster",
    icon: "roster",
    href: "/admin/roster",
    organizerOnly: true,
  },
  {
    label: "Announcements",
    tabLabel: "News",
    icon: "announcements",
    href: "/admin/announcements",
    tab: true,
    organizerOnly: true,
  },
  {
    label: "Awards",
    icon: "awards",
    href: "/admin/awards",
    organizerOnly: true,
  },
  { label: "FAQ", icon: "faq", href: "/admin/faq", organizerOnly: true },
  {
    label: "Finale",
    icon: "finale",
    href: "/admin/finale",
    organizerOnly: true,
  },
  {
    label: "Settings",
    icon: "settings",
    href: "/admin/settings",
    organizerOnly: true,
  },
  {
    label: "Organizers",
    icon: "organizers",
    href: "/admin/organizers",
    organizerOnly: true,
  },
  { label: "Guide", icon: "guide", href: "/admin/guide" },
] as const;

/** A section an admin page can be. */
export type AdminSection = (typeof ADMIN_SECTIONS)[number]["label"];

/** The sections an Organizer (or, with false, a Host) may open. */
export function adminSectionsFor(isOrganizer: boolean) {
  return ADMIN_SECTIONS.filter(
    (section) => isOrganizer || !("organizerOnly" in section),
  );
}

/** Which icon a section shows; components map it to the icon itself. */
export type AdminSectionIconKey = (typeof ADMIN_SECTIONS)[number]["icon"];

type AdminNavItem = {
  /** The full section name: page title, side column, More Sheet. */
  label: string;
  /** What a bottom-bar tab shows: the short `tabLabel`, else `label`. */
  tabLabel: string;
  href: string;
  icon: AdminSectionIconKey;
  current: boolean;
};

/**
 * The phone's admin nav: the bottom bar's tabs (Competitions, Points,
 * Schedule, News; their full labels are Discretionary points and
 * Announcements) and the rest of the viewer's sections for the
 * More Sheet. `moreCurrent` is true when `current` is one of the More sections.
 */
export function adminNavFor(
  isOrganizer: boolean,
  current: AdminSection,
): { tabs: AdminNavItem[]; more: AdminNavItem[]; moreCurrent: boolean } {
  const tabs: AdminNavItem[] = [];
  const more: AdminNavItem[] = [];
  for (const section of adminSectionsFor(isOrganizer)) {
    const { label, href, icon } = section;
    const tabLabel = "tabLabel" in section ? section.tabLabel : label;
    const item = { label, tabLabel, href, icon, current: label === current };
    if ("tab" in section) {
      tabs.push(item);
    } else {
      more.push(item);
    }
  }
  return { tabs, more, moreCurrent: more.some((item) => item.current) };
}
