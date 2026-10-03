import {
  BookOpen,
  CircleHelp,
  ListChecks,
  type LucideIcon,
  Medal,
  Megaphone,
  PlusCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

import type { AdminSectionIconKey } from "@/lib/admin-sections";

/** The icon each admin section shows, in the side column and the bar. */
const ICONS: Record<AdminSectionIconKey, LucideIcon> = {
  points: PlusCircle,
  competitions: Trophy,
  schedule: ListChecks,
  roster: Users,
  announcements: Megaphone,
  awards: Medal,
  faq: CircleHelp,
  finale: Sparkles,
  settings: Settings,
  organizers: ShieldCheck,
  guide: BookOpen,
};

export function AdminSectionIcon({
  icon,
  className,
}: {
  icon: AdminSectionIconKey;
  className?: string;
}) {
  const Icon = ICONS[icon];
  return <Icon aria-hidden="true" className={className} />;
}
