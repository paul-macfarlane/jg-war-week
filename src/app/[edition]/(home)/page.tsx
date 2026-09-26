import Link from "next/link";
import { notFound } from "next/navigation";

import { AnnouncementCard } from "@/components/announcement-card";
import { ArchiveDetailView } from "@/components/archive";
import { AutoRefresh } from "@/components/auto-refresh";
import { NowNextSection } from "@/components/now-next";
import { HomeStandings } from "@/components/standings";
import { Button } from "@/components/ui/button";
import { WarWeekHero } from "@/components/war-week-hero";
import { isArchived } from "@/lib/archive";
import { computeNowNext, resolveClock } from "@/lib/schedule";
import { getPinnedAnnouncement } from "@/queries/announcements";
import { getArchiveDetail } from "@/queries/archive";
import { getSchedule } from "@/queries/schedule";
import { getStandings } from "@/queries/standings";

import { getWarWeekForEdition } from "../war-week";

const HOME_INDIVIDUAL_ROWS = 5;

export default async function EditionHomePage({
  params,
  searchParams,
}: PageProps<"/[edition]">) {
  const { edition } = await params;
  const { at } = await searchParams;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();

  if (isArchived(warWeek)) {
    return <ArchiveDetailView detail={await getArchiveDetail(warWeek)} />;
  }

  const [standings, schedule, pinnedAnnouncement] = await Promise.all([
    getStandings(warWeek),
    getSchedule(warWeek.id),
    getPinnedAnnouncement(warWeek),
  ]);
  const nowNext = computeNowNext(schedule, resolveClock(at, new Date()));

  return (
    <main className="mx-auto flex max-w-md flex-col md:max-w-3xl md:py-8">
      <WarWeekHero warWeek={warWeek} />

      <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
        <Button
          size="lg"
          className="w-full md:w-auto md:self-start"
          nativeButton={false}
          render={
            <a
              href={warWeek.slackChannelUrl}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          Join the Slack channel
        </Button>

        <NowNextSection nowNext={nowNext} edition={warWeek.edition} />

        {pinnedAnnouncement ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Pinned</h2>
              <Link
                href={`/${warWeek.edition}/news`}
                className="text-primary text-sm font-medium"
              >
                All news
              </Link>
            </div>
            <AnnouncementCard
              announcement={pinnedAnnouncement}
              headingLevel="h3"
            />
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">
              {warWeek.mode === "teams"
                ? `${warWeek.teamLabel} standings`
                : "Individual leaderboard"}
            </h2>
            <Link
              href={`/${warWeek.edition}/leaderboard`}
              className="text-primary text-sm font-medium"
            >
              Full leaderboard
            </Link>
          </div>
          <HomeStandings
            standings={standings}
            individualLimit={HOME_INDIVIDUAL_ROWS}
            primaryColor={warWeek.primaryColor}
          />
        </section>
      </div>
      <AutoRefresh />
    </main>
  );
}
