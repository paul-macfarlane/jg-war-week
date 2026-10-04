import { ArrowLeft, Medal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TeamTag } from "@/components/participant-mark";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getAwardNameHistory } from "@/queries/award-history";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Awards through the years · JG War Week",
};

/**
 * One Award name through the years: every War Week with an Award of that
 * name (case-insensitive), newest first, with each Award's recipients. Keyed
 * by the name's slug; an unknown slug, or an old Category id, is a 404.
 */
export default async function AwardNameHistoryPage({
  params,
}: PageProps<"/history/awards/[slug]">) {
  const { slug } = await params;
  const history = await getAwardNameHistory(slug);
  if (!history) notFound();
  const { name, warWeeks } = history;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl md:py-10">
      <Link
        href="/history"
        className="text-foreground/70 flex items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to history
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{name}</h1>
        <p className="text-foreground/70">
          Every War Week&apos;s recipients, newest first.
        </p>
      </div>
      {warWeeks.map((warWeek) => (
        <section
          key={warWeek.edition}
          aria-labelledby={`ww-${warWeek.edition}`}
          className="flex flex-col gap-2"
        >
          <h2 id={`ww-${warWeek.edition}`} className="text-xl font-bold">
            <Link
              href={`/${warWeek.edition}`}
              className="underline-offset-4 hover:underline"
            >
              War Week {warWeek.edition.toUpperCase()}
            </Link>{" "}
            <span className="text-foreground/60 text-base font-normal">
              {warWeek.year}
            </span>
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {warWeek.awards.map((award) => {
              // The heading is the newest spelling; show an Award's own when
              // it differs.
              const own = award.name === name ? null : award.name;
              return (
                <li key={award.id}>
                  <Card className="h-full gap-2">
                    {own ? (
                      <CardHeader className="flex items-center gap-2">
                        <Medal
                          aria-hidden
                          className="text-primary size-5 shrink-0"
                        />
                        <h3 className="text-lg font-semibold">{own}</h3>
                      </CardHeader>
                    ) : null}
                    <CardContent className="flex flex-col gap-1 text-sm">
                      {award.team ? (
                        <p className="flex items-center gap-2 font-medium">
                          <span
                            aria-hidden
                            className="size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: award.team.color }}
                          />
                          {award.team.name}
                        </p>
                      ) : null}
                      {award.participants.length > 0 ? (
                        <ul className="flex flex-col gap-1">
                          {award.participants.map((p) => (
                            <li
                              key={p.id}
                              className="flex flex-wrap items-center gap-x-2 font-medium"
                            >
                              {p.displayName}
                              <TeamTag name={p.teamName} color={p.teamColor} />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
