import type { WarWeek } from "@/db/schema";
import type { NavSurface } from "@/lib/primary-nav";
import { rosterHeading } from "@/lib/roster";

/** Which icon a More link shows; components map it to the icon itself. */
export type MoreLinkIcon =
  | "announcements"
  | "roster"
  | "awards"
  | "faq"
  | "history"
  | "install"
  | "about"
  | "admin";

export type MoreLink = {
  label: string;
  href: string;
  icon: MoreLinkIcon;
};

/** `phone`: the More Sheet; `desktop`: the `/[edition]/more` page. */
export type MoreLinksInput = {
  surface: NavSurface;
  edition: string;
  mode: WarWeek["mode"];
  teamLabel: string;
  canOpenAdmin: boolean;
};

/**
 * The links shown on the desktop `/[edition]/more` page and, on a phone, in
 * the bottom tab bar's More Sheet. Both surfaces render this one list; the
 * `surface` only decides whether Announcements (a top-nav item on desktop,
 * the first More item on a phone) is included.
 */
export function moreLinks({
  surface,
  edition,
  mode,
  teamLabel,
  canOpenAdmin,
}: MoreLinksInput): MoreLink[] {
  return [
    // The desktop top nav lists Announcements itself; only a phone needs it here.
    ...(surface === "phone"
      ? [
          {
            label: "Announcements",
            href: `/${edition}/announcements`,
            icon: "announcements" as const,
          },
        ]
      : []),
    {
      label: rosterHeading(mode, teamLabel),
      href: `/${edition}/teams`,
      icon: "roster",
    },
    { label: "Awards", href: `/${edition}/awards`, icon: "awards" },
    { label: "FAQ", href: `/${edition}/faq`, icon: "faq" },
    { label: "War Week history", href: "/history", icon: "history" },
    { label: "Install app", href: "/install", icon: "install" },
    { label: "About JG War Week", href: "/about", icon: "about" },
    ...(canOpenAdmin
      ? [{ label: "Admin", href: "/admin", icon: "admin" as const }]
      : []),
  ];
}
