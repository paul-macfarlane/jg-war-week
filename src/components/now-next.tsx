import Link from "next/link";

import { CategoryBadge } from "@/components/schedule-item";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  type NowNext,
  type ScheduleEntry,
  formatDayHeading,
  formatTimeRange,
} from "@/lib/schedule";

/**
 * One Now/Next entry. A timed Heat shows a "Heat" badge and its Entrants,
 * and links to its Competition.
 */
function CompactItem({
  item,
  edition,
}: {
  item: ScheduleEntry;
  edition: string;
}) {
  const isHeat = item.kind === "heat";
  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {isHeat && item.competition ? (
          <Link
            href={`/${edition}/competitions/${item.competition.id}`}
            className="font-semibold underline-offset-4 hover:underline"
          >
            {item.title}
          </Link>
        ) : (
          <span className="font-semibold">{item.title}</span>
        )}
        {isHeat ? (
          <Badge variant="secondary">Heat</Badge>
        ) : (
          <CategoryBadge category={item.category} />
        )}
      </div>
      {isHeat && item.entrants ? (
        <span className="text-sm break-words">{item.entrants}</span>
      ) : null}
      <span className="text-foreground/70 text-sm">
        {formatTimeRange(item)}
        {item.location ? ` · ${item.location}` : null}
      </span>
    </li>
  );
}

/**
 * Home page summary: today's Day Theme and what's on now and next. Renders
 * nothing once the War Week's schedule is over.
 */
export function NowNextSection({
  nowNext,
  edition,
}: {
  nowNext: NowNext;
  edition: string;
}) {
  const { today, beforeStart, now, next } = nowNext;
  if (!today && !next && now.length === 0) return null;

  return (
    <Card className="gap-4 px-4">
      <div className="flex items-baseline justify-between">
        {today ? (
          <div className="flex flex-col">
            <span className="text-foreground/60 text-xs font-medium tracking-wide uppercase">
              Today
            </span>
            <span className="text-primary text-lg font-semibold">
              {today.dayTheme}
            </span>
          </div>
        ) : (
          <span className="text-foreground/70 text-sm">
            {beforeStart
              ? "War Week hasn't started yet."
              : "Nothing scheduled today."}
          </span>
        )}
        <Link
          href={`/${edition}/schedule`}
          className="text-primary text-sm font-medium"
        >
          Full schedule
        </Link>
      </div>

      {today || now.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-foreground/60 text-xs font-medium tracking-wide uppercase">
            On now
          </h2>
          {now.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {now.map((item) => (
                <CompactItem key={item.id} item={item} edition={edition} />
              ))}
            </ul>
          ) : (
            <p className="text-foreground/70 text-sm">Nothing on right now.</p>
          )}
        </div>
      ) : null}

      {next ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-foreground/60 text-xs font-medium tracking-wide uppercase">
            Up next
            {next.date !== today?.date
              ? ` · ${formatDayHeading(next.date)}`
              : null}
          </h2>
          <ul className="flex flex-col gap-3">
            {next.items.map((item) => (
              <CompactItem key={item.id} item={item} edition={edition} />
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
