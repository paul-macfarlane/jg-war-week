import { ArrowLeft, ExternalLink, Trophy } from "lucide-react";
import Link from "next/link";

import { ThemeRoot } from "@/components/theme-root";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WarWeekHero } from "@/components/war-week-hero";
import type { WarWeek } from "@/db/schema";
import { type ArchiveDetail, awardRecipients, isLinkOnly } from "@/lib/archive";
import { warWeekThemeStyle } from "@/lib/theme";
import { formatDateRange } from "@/lib/war-week-display";

function WikiLink({ wikiUrl }: { wikiUrl: string | null }) {
  if (!wikiUrl) return null;
  return (
    <Button
      size="lg"
      variant="outline"
      className="w-full md:w-auto md:self-start"
      nativeButton={false}
      render={<a href={wikiUrl} target="_blank" rel="noreferrer" />}
    >
      Original wiki page
      <ExternalLink aria-hidden className="size-4" />
    </Button>
  );
}

function Highlights({ highlights }: { highlights: string[] }) {
  if (highlights.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Highlights</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        {highlights.map((highlight, index) => (
          <li key={index}>{highlight}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A past War Week at its edition URL, in its own Appearance Theme (the
 * `[edition]` layout applies it). Sparse early years render as a link-only
 * card in the same layout.
 */
export function ArchiveDetailView({ detail }: { detail: ArchiveDetail }) {
  const { warWeek, teams, awards } = detail;
  const linkOnly = isLinkOnly(detail);

  return (
    <main className="mx-auto flex max-w-md flex-col md:max-w-3xl md:py-8">
      <WarWeekHero warWeek={warWeek} />

      <div className="flex flex-col gap-6 px-4 pt-4 pb-6">
        <Link
          href="/history"
          className="text-primary-text flex items-center gap-1 text-sm font-medium"
        >
          <ArrowLeft aria-hidden className="size-4" />
          All past War Weeks
        </Link>

        {linkOnly ? (
          <Card className="gap-4 px-4">
            <p className="text-muted-foreground text-sm">
              Most of War Week {warWeek.edition.toUpperCase()}&apos;s story
              lives on the original wiki page.
            </p>
            <Highlights highlights={warWeek.highlights} />
            <WikiLink wikiUrl={warWeek.wikiUrl} />
          </Card>
        ) : (
          <>
            {warWeek.winner ? (
              <Card className="bg-primary text-primary-foreground flex-row items-center gap-3 px-4 ring-0">
                <Trophy aria-hidden className="size-8 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium tracking-wide uppercase">
                    Winner
                  </span>
                  <span className="text-xl font-bold">{warWeek.winner}</span>
                </div>
              </Card>
            ) : null}

            {teams.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">{warWeek.teamLabel}s</h2>
                <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {teams.map((team) => (
                    <li key={team.name}>
                      <Card
                        size="sm"
                        className="flex-row items-center gap-2 px-3 py-2"
                      >
                        <span
                          aria-hidden
                          className="size-4 shrink-0 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="font-medium">{team.name}</span>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <Highlights highlights={warWeek.highlights} />

            {awards.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">Awards</h2>
                <ul className="grid gap-2 md:grid-cols-2">
                  {awards.map((award) => {
                    const recipients = awardRecipients(award);
                    return (
                      <li key={award.name}>
                        <Card size="sm" className="h-full gap-1">
                          <CardHeader>
                            <CardTitle className="font-semibold">
                              {award.name}
                            </CardTitle>
                          </CardHeader>
                          {recipients || award.description ? (
                            <CardContent className="flex flex-col gap-1">
                              {recipients ? (
                                <span className="text-primary-text text-sm font-medium">
                                  {recipients}
                                </span>
                              ) : null}
                              {award.description ? (
                                <span className="text-muted-foreground text-sm">
                                  {award.description}
                                </span>
                              ) : null}
                            </CardContent>
                          ) : null}
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            <WikiLink wikiUrl={warWeek.wikiUrl} />
          </>
        )}
      </div>
    </main>
  );
}

/** One past War Week on `/history`, dressed in its own Appearance Theme. */
export function ArchiveCard({ warWeek }: { warWeek: WarWeek }) {
  const editionLabel = warWeek.edition.toUpperCase();

  return (
    <ThemeRoot
      as="li"
      style={warWeekThemeStyle(warWeek)}
      className="text-foreground flex flex-col font-sans"
    >
      <Card className="border-t-primary flex-1 gap-0 border-t-8 py-0">
        <Link
          href={`/${warWeek.edition}`}
          className="flex flex-1 flex-col gap-1 px-4 py-3"
        >
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            War Week {editionLabel} · {warWeek.year}
          </span>
          <span className="text-primary-text text-lg font-semibold">
            {warWeek.storyTheme}
          </span>
          <span className="text-muted-foreground text-sm">
            {formatDateRange(warWeek.startDate, warWeek.endDate)}
          </span>
          <span className="text-sm">
            {warWeek.winner ? (
              <span className="flex flex-wrap items-center gap-2">
                <Badge>Winner</Badge>
                <span className="font-medium">{warWeek.winner}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">No winner recorded</span>
            )}
          </span>
        </Link>
        {warWeek.wikiUrl ? (
          <CardFooter className="p-0">
            <a
              href={warWeek.wikiUrl}
              target="_blank"
              rel="noreferrer"
              className="text-foreground flex w-full items-center gap-1 px-4 py-2 text-xs font-medium underline underline-offset-4"
            >
              Original wiki page
              <ExternalLink aria-hidden className="size-3" />
            </a>
          </CardFooter>
        ) : null}
      </Card>
    </ThemeRoot>
  );
}
