import type { WarWeek } from "@/db/schema";
import { rosterHeading } from "@/lib/roster";

/** Which icon a More link shows; components map it to the icon itself. */
export type MoreLinkIcon =
  | "competitions"
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

export type MoreLinksInput = {
  edition: string;
  mode: WarWeek["mode"];
  teamLabel: string;
  canOpenAdmin: boolean;
};

/**
 * The links shown on the desktop `/[edition]/more` page and, on a phone, in
 * the bottom tab bar's More Sheet. Both surfaces render this same list so
 * they never drift.
 */
export function moreLinks({
  edition,
  mode,
  teamLabel,
  canOpenAdmin,
}: MoreLinksInput): MoreLink[] {
  return [
    {
      label: "Competitions",
      href: `/${edition}/competitions`,
      icon: "competitions",
    },
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
