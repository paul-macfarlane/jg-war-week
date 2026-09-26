import {
  CircleHelp,
  Download,
  History,
  Info,
  type LucideIcon,
  Medal,
  Shield,
  Trophy,
  Users,
} from "lucide-react";

import type { WarWeek } from "@/db/schema";
import { rosterHeading } from "@/lib/roster";

export type MoreLink = {
  label: string;
  href: string;
  icon: LucideIcon;
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
    { label: "Competitions", href: `/${edition}/competitions`, icon: Trophy },
    {
      label: rosterHeading(mode, teamLabel),
      href: `/${edition}/teams`,
      icon: Users,
    },
    { label: "Awards", href: `/${edition}/awards`, icon: Medal },
    { label: "FAQ", href: `/${edition}/faq`, icon: CircleHelp },
    { label: "War Week history", href: "/history", icon: History },
    { label: "Install app", href: "/install", icon: Download },
    { label: "About JG War Week", href: "/about", icon: Info },
    ...(canOpenAdmin ? [{ label: "Admin", href: "/admin", icon: Shield }] : []),
  ];
}
