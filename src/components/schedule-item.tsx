import {
  Briefcase,
  GraduationCap,
  type LucideIcon,
  MapPin,
  PartyPopper,
  Shapes,
  Trophy,
  Utensils,
  Video,
} from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/avatar";
import { RichText } from "@/components/rich-text";
import type { ScheduleItem } from "@/db/schema";
import { type ScheduleEntry, formatTimeRange } from "@/lib/schedule";

type Category = ScheduleItem["category"];

// Fixed hues, independent of the War Week's Appearance Theme, so a meal
// always reads as a meal whatever the year's palette. Text stays the theme
// foreground so it is legible on light and dark backgrounds alike.
const CATEGORY_STYLE: Record<
  Category,
  { label: string; icon: LucideIcon; badge: string; cardEdge: string }
> = {
  competition: {
    label: "Competition",
    icon: Trophy,
    badge: "border-amber-500 bg-amber-500/15",
    cardEdge: "border-l-amber-500",
  },
  education: {
    label: "Education",
    icon: GraduationCap,
    badge: "border-sky-500 bg-sky-500/15",
    cardEdge: "border-l-sky-500",
  },
  social: {
    label: "Social",
    icon: PartyPopper,
    badge: "border-pink-500 bg-pink-500/15",
    cardEdge: "border-l-pink-500",
  },
  meal: {
    label: "Meal",
    icon: Utensils,
    badge: "border-emerald-500 bg-emerald-500/15",
    cardEdge: "border-l-emerald-500",
  },
  work: {
    label: "Work",
    icon: Briefcase,
    badge: "border-slate-500 bg-slate-500/15",
    cardEdge: "border-l-slate-500",
  },
  other: {
    label: "Other",
    icon: Shapes,
    badge: "border-zinc-400 bg-zinc-400/15",
    cardEdge: "border-l-zinc-400",
  },
};

export function CategoryBadge({ category }: { category: Category }) {
  const { label, icon: Icon, badge } = CATEGORY_STYLE[category];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${badge}`}
    >
      <Icon aria-hidden className="size-3" />
      {label}
    </span>
  );
}

export function ScheduleItemCard({
  item,
  edition,
}: {
  item: ScheduleEntry;
  edition: string;
}) {
  return (
    <li
      className={`border-border flex flex-col gap-2 rounded-lg border border-l-4 px-4 py-3 ${CATEGORY_STYLE[item.category].cardEdge}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">
          {formatTimeRange(item)}
        </span>
        <CategoryBadge category={item.category} />
      </div>
      <h3 className="text-base font-semibold">{item.title}</h3>
      {item.location ? (
        <div className="text-foreground/70 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden className="size-3.5" />
            {item.location}
          </span>
        </div>
      ) : null}
      {item.hosts.length > 0 ? (
        <p
          data-testid="schedule-item-hosts"
          className="text-foreground/70 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
        >
          <span>Hosted by</span>
          {item.hosts.map((host, index) => (
            <span
              key={host.id}
              data-testid="schedule-item-host"
              className="inline-flex items-center gap-1.5"
            >
              <Avatar
                name={host.displayName}
                teamColor={host.teamColor}
                image={host.image}
                className="size-5"
              />
              <span className="text-foreground">
                {host.displayName}
                {index < item.hosts.length - 1 ? "," : ""}
              </span>
            </span>
          ))}
        </p>
      ) : null}
      {item.description ? (
        <div className="text-sm">
          {/* One below the Schedule Item title's `h3`. */}
          <RichText content={item.description} headingFloor={4} />
        </div>
      ) : null}
      {item.virtualLink || item.competition ? (
        <div className="flex flex-wrap gap-4 text-sm font-medium">
          {item.virtualLink ? (
            <a
              href={item.virtualLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1"
            >
              <Video aria-hidden className="size-4" />
              Join virtually
            </a>
          ) : null}
          {item.competition ? (
            <Link
              href={`/${edition}/competitions/${item.competition.id}`}
              className="text-primary inline-flex items-center gap-1"
            >
              <Trophy aria-hidden className="size-4" />
              {item.competition.name}
            </Link>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
