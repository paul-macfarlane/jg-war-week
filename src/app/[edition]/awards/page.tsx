import { Medal } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar } from "@/components/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { YouTag } from "@/components/you";
import { type AwardView, groupAwardsByCategory } from "@/lib/awards";
import { YOU_ROW_CLASS } from "@/lib/you";
import { getAwards } from "@/queries/awards";

import { getWarWeekForEdition } from "../war-week";

export default async function AwardsPage({
  params,
}: PageProps<"/[edition]/awards">) {
  const { edition } = await params;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();

  const awards = await getAwards(warWeek);
  const groups = groupAwardsByCategory(awards);
  // Headings only once some Award has a Category, so a War Week without
  // Categories reads as it always did.
  const headed = groups.some((group) => group.category !== null);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Awards</h1>
        <p className="text-foreground/70 text-sm">
          Honors for this War Week. Awards don&apos;t add points to the
          Standings.
        </p>
      </div>
      {awards.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Awards yet.</p>
      ) : (
        groups.map((group) => (
          <section
            key={group.category?.id ?? "other"}
            aria-labelledby={
              headed ? `category-${group.category?.id ?? "other"}` : undefined
            }
            className="flex flex-col gap-3"
          >
            {headed ? (
              <h2
                id={`category-${group.category?.id ?? "other"}`}
                className="text-xl font-bold"
              >
                {group.category ? (
                  <Link
                    href={`/history/awards/${group.category.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {group.category.name}
                  </Link>
                ) : (
                  "Other Awards"
                )}
              </h2>
            ) : null}
            <ul className="grid gap-3 md:grid-cols-2">
              {group.awards.map((award) => (
                <li key={award.id}>
                  <AwardCard
                    award={award}
                    primaryColor={warWeek.primaryColor}
                    headed={headed}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}

function AwardCard({
  award,
  primaryColor,
  headed,
}: {
  award: AwardView;
  primaryColor: string;
  /** Under a Category heading, so the Award's own name is a level lower. */
  headed: boolean;
}) {
  const Heading = headed ? "h3" : "h2";
  return (
    <Card className="h-full gap-2">
      <CardHeader className="flex items-center gap-2">
        <Medal aria-hidden className="text-primary size-5 shrink-0" />
        <Heading className="text-lg font-semibold">{award.name}</Heading>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {award.team ? (
          <p className="flex items-center gap-2 text-sm font-medium">
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
                className={`text-primary flex items-center gap-2 text-sm font-medium ${YOU_ROW_CLASS}`}
              >
                <Avatar
                  name={p.displayName}
                  teamColor={p.teamColor}
                  primaryColor={primaryColor}
                  image={p.image}
                />
                {p.displayName}
                <YouTag participantId={p.id} />
              </li>
            ))}
          </ul>
        ) : null}
        {award.description ? (
          <p className="text-foreground/70 text-sm">{award.description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
