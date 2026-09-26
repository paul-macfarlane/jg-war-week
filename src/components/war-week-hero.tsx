import { Badge } from "@/components/ui/badge";
import type { WarWeek } from "@/db/schema";
import { WAR_WEEK_STATUS_LABEL, formatDateRange } from "@/lib/war-week-display";

/**
 * A War Week's banner, logo, edition, year, Story Theme, status and dates:
 * the top of the War Week home, live or archived.
 */
export function WarWeekHero({ warWeek }: { warWeek: WarWeek }) {
  const editionLabel = warWeek.edition.toUpperCase();

  return (
    <>
      {warWeek.bannerUrl ? (
        <img
          src={warWeek.bannerUrl}
          alt={`War Week ${editionLabel} banner`}
          className="h-48 w-full object-cover md:h-72 md:rounded-lg"
        />
      ) : (
        <div className="bg-accent text-accent-foreground flex h-48 w-full items-center justify-center text-2xl font-bold md:rounded-lg">
          War Week {editionLabel}
        </div>
      )}

      <div className="flex flex-col gap-4 px-4 pt-6">
        <div className="flex items-start gap-3">
          {warWeek.logoUrl ? (
            <img
              src={warWeek.logoUrl}
              alt={`War Week ${editionLabel} logo`}
              className="size-14 shrink-0 rounded-md"
            />
          ) : null}
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              War Week
            </span>
            <h1 className="text-3xl font-bold">
              War Week {editionLabel}{" "}
              <span className="text-muted-foreground">{warWeek.year}</span>
            </h1>
            <p className="text-primary-text text-xl font-semibold">
              {warWeek.storyTheme}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className="h-auto px-3 py-1 text-sm">
            {WAR_WEEK_STATUS_LABEL[warWeek.status]}
          </Badge>
          <span className="text-muted-foreground">
            {formatDateRange(warWeek.startDate, warWeek.endDate)}
          </span>
        </div>
      </div>
    </>
  );
}
