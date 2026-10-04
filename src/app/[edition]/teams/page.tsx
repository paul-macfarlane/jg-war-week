import { notFound } from "next/navigation";

import { RosterList, TeamRoster } from "@/components/roster";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { rosterHeading } from "@/lib/roster";
import { getRoster } from "@/queries/roster";

import { getWarWeekForEdition } from "../war-week";

export default async function TeamsPage({
  params,
}: PageProps<"/[edition]/teams">) {
  const { edition } = await params;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();

  const roster = await getRoster(warWeek);
  const { teamLabel, leaderTitle, primaryColor } = warWeek;
  const heading = rosterHeading(warWeek.mode, teamLabel);

  if (roster.kind === "free-for-all") {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
        <h1 className="text-2xl font-bold">{heading}</h1>
        <p className="text-foreground/70 text-sm">
          Free-for-all: everyone competes on their own.
        </p>
        <Card size="sm">
          <CardContent>
            <RosterList
              participants={roster.participants}
              leaderTitle={leaderTitle}
              teamColor={null}
              primaryColor={primaryColor}
            />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6 md:max-w-3xl">
      <h1 className="text-2xl font-bold">{heading}</h1>
      {roster.teams.length === 0 ? (
        <p className="text-foreground/70 text-sm">No {heading} yet.</p>
      ) : null}
      {roster.teams.map((team) => (
        <TeamRoster
          key={team.id}
          team={team}
          teamLabel={teamLabel}
          leaderTitle={leaderTitle}
          primaryColor={primaryColor}
        />
      ))}
      {roster.unassigned.length > 0 ? (
        <Card size="sm">
          <CardHeader>
            <h2 className="text-lg font-semibold">Not on a {teamLabel} yet</h2>
          </CardHeader>
          <CardContent>
            <RosterList
              participants={roster.unassigned}
              leaderTitle={leaderTitle}
              teamColor={null}
              primaryColor={primaryColor}
            />
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
