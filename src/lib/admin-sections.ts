/**
 * Every `/admin` section, in nav order: the side column and, on a phone,
 * the bottom bar and its More Sheet. `organizerOnly` sections are hidden
 * from Hosts; `tab` sections get a tab on the phone's bottom bar (the rest
 * go in More). `icon` is a key; components map it to the icon
 * (`AdminSectionIcon`), as src/lib never imports icons (ADR 0001).
 */
const ADMIN_SECTIONS = [
  { label: "Points", icon: "points", href: "/admin/points", tab: true },
  {
    label: "Competitions",
    icon: "competitions",
    href: "/admin/competitions",
    tab: true,
  },
  { label: "Schedule", icon: "schedule", href: "/admin/schedule", tab: true },
  {
    label: "Roster",
    icon: "roster",
    href: "/admin/roster",
    organizerOnly: true,
  },
  {
    label: "Announcements",
    icon: "announcements",
    href: "/admin/announcements",
    tab: true,
  },
  {
    label: "Awards",
    icon: "awards",
    href: "/admin/awards",
    organizerOnly: true,
  },
  { label: "FAQ", icon: "faq", href: "/admin/faq", organizerOnly: true },
  { label: "Finale", icon: "finale", href: "/admin/finale" },
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
  label: string;
  href: string;
  icon: AdminSectionIconKey;
  current: boolean;
};

/**
 * The phone's admin nav: the bottom bar's tabs (Points, Competitions,
 * Schedule, Announcements) and the rest of the viewer's sections for the
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
    const isCurrent = label === current;
    if ("tab" in section) {
      tabs.push({ label, href, icon, current: isCurrent });
    } else {
      more.push({ label, href, icon, current: isCurrent });
    }
  }
  return { tabs, more, moreCurrent: more.some((item) => item.current) };
}
