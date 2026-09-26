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

import type { MoreLinkIcon as IconKey } from "@/lib/more-links";

/** The icon each More link shows, on `/[edition]/more` and in the More Sheet. */
const ICONS: Record<IconKey, LucideIcon> = {
  competitions: Trophy,
  roster: Users,
  awards: Medal,
  faq: CircleHelp,
  history: History,
  install: Download,
  about: Info,
  admin: Shield,
};

export function MoreLinkIcon({ icon }: { icon: IconKey }) {
  const Icon = ICONS[icon];
  return <Icon aria-hidden className="text-primary size-5" />;
}
