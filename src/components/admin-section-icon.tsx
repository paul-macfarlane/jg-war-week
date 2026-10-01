import {
  BookOpen,
  LayoutDashboard,
  type LucideIcon,
  Medal,
  Megaphone,
  PlusCircle,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import type { AdminSectionIconKey } from "@/lib/admin-sections";

/** The icon each admin section shows, in the side column and the bar. */
const ICONS: Record<AdminSectionIconKey, LucideIcon> = {
  overview: LayoutDashboard,
  guide: BookOpen,
  points: PlusCircle,
  finale: Sparkles,
  announcements: Megaphone,
  awards: Medal,
  setup: Settings,
  organizers: ShieldCheck,
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
