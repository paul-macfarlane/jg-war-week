import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/auto-refresh";
import { LeaderboardStandings } from "@/components/standings";
import { getPointsBreakdown, getStandings } from "@/queries/standings";

import { getWarWeekForEdition } from "../war-week";

export default async function LeaderboardPage({
  params,
}: PageProps<"/[edition]/leaderboard">) {
  const { edition } = await params;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();

  const [standings, breakdown] = await Promise.all([
    getStandings(warWeek),
    getPointsBreakdown(warWeek),
  ]);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6 md:max-w-3xl">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      <LeaderboardStandings
        standings={standings}
        teamLabel={warWeek.teamLabel}
        primaryColor={warWeek.primaryColor}
        breakdown={breakdown}
      />
      <AutoRefresh />
    </main>
  );
}
