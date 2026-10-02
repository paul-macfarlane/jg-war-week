import { ArrowLeft, Medal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { awardNameUnderCategory } from "@/lib/award-categories";
import { isUuid } from "@/lib/uuid";
import { getCategoryHistory } from "@/queries/award-category-history";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Awards through the years · JG War Week",
};

/**
 * One Award Category through the years: every War Week with an Award in it,
 * newest first, with each Award's recipients (ticket 71). Keyed by the
 * Category's id, so a rename never breaks the link.
 */
export default async function CategoryHistoryPage({
  params,
}: PageProps<"/history/awards/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const history = await getCategoryHistory(id);
  if (!history) notFound();
  const { category, warWeeks } = history;

  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl md:py-10">
        <Link
          href="/history"
          className="text-foreground/70 flex items-center gap-1 text-sm font-medium"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to history
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold">
            {category.name}
            {category.archived ? (
              <Badge variant="secondary">Archived</Badge>
            ) : null}
          </h1>
          <p className="text-foreground/70">
            Every War Week&apos;s recipients, newest first.
          </p>
        </div>
        {warWeeks.length === 0 ? (
          <p className="text-foreground/70 text-sm">
            No Awards in this Category yet.
          </p>
        ) : (
          warWeeks.map((warWeek) => (
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
                  const own = awardNameUnderCategory(award.name, category.name);
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
                                <li key={p.id} className="font-medium">
                                  {p.displayName}
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
          ))
        )}
      </main>
      <SiteFooter className="mt-auto" />
    </>
  );
}
