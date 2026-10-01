/**
 * Every `/admin` section, in side-column order. `organizerOnly` sections
 * are hidden from Hosts; `tab` is the section's label on the phone's
 * bottom bar, where only tab sections get a tab (the rest go in More).
 * `icon` is a key; components map it to the icon (`AdminSectionIcon`), as
 * src/lib never imports icons (ADR 0001).
 */
const ADMIN_SECTIONS = [
  { label: "Overview", icon: "overview", href: "/admin", tab: "Overview" },
  { label: "Guide", icon: "guide", href: "/admin/guide" },
  {
    label: "Points Entries",
    icon: "points",
    href: "/admin/points",
    tab: "Points",
  },
  { label: "Finale", icon: "finale", href: "/admin/standings" },
  {
    label: "Announcements",
    icon: "announcements",
    href: "/admin/announcements",
    tab: "Announcements",
  },
  {
    label: "Awards",
    icon: "awards",
    href: "/admin/awards",
    organizerOnly: true,
  },
  { label: "Setup", icon: "setup", href: "/admin/setup", tab: "Setup" },
  {
    label: "Organizers",
    icon: "organizers",
    href: "/admin/organizers",
    organizerOnly: true,
  },
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

export type AdminNavItem = {
  label: string;
  href: string;
  icon: AdminSectionIconKey;
  current: boolean;
};

/**
 * The phone's admin nav: the bottom bar's tabs (Overview, Points,
 * Announcements, Setup) and the rest of the viewer's sections for the More
 * Sheet. `moreCurrent` is true when `current` is one of the More sections.
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
      tabs.push({ label: section.tab, href, icon, current: isCurrent });
    } else {
      more.push({ label, href, icon, current: isCurrent });
    }
  }
  return { tabs, more, moreCurrent: more.some((item) => item.current) };
}
