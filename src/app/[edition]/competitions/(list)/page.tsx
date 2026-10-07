import { notFound } from "next/navigation";

import { CompetitionGroupTabs } from "@/components/competition-group-tabs";
import { CompetitionList } from "@/components/competitions";
import { groupTabSlug, resolveGroupTab } from "@/lib/competition-group-tab";
import { getCompetitions } from "@/queries/competitions";

import { getWarWeekForEdition } from "../../war-week";

export default async function CompetitionsPage({
  params,
  searchParams,
}: PageProps<"/[edition]/competitions">) {
  const { edition } = await params;
  const { group } = await searchParams;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();

  const { groups, ungrouped } = await getCompetitions(warWeek);
  const listProps = {
    edition: warWeek.edition,
    teamLabel: warWeek.teamLabel,
    mode: warWeek.mode,
  };

  // Two or more Competition Groups switch by Tabs; every panel stays
  // mounted, so each group's Competitions are in the page HTML.
  if (groups.length >= 2) {
    const sections = [
      ...groups,
      ...(ungrouped.length > 0
        ? [{ name: "Other Competitions", competitions: ungrouped }]
        : []),
    ];
    const tabs = sections.map((section) => ({
      slug: groupTabSlug(section.name),
      name: section.name,
      content: (
        <CompetitionList competitions={section.competitions} {...listProps} />
      ),
    }));
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6 md:max-w-3xl">
        <h1 className="text-2xl font-bold">Competitions</h1>
        <CompetitionGroupTabs
          initial={resolveGroupTab(
            tabs.map((tab) => tab.slug),
            group,
          )}
          tabs={tabs}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6 md:max-w-3xl">
      <h1 className="text-2xl font-bold">Competitions</h1>
      {groups.length === 0 && ungrouped.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Competitions yet.</p>
      ) : null}
      {groups.map((group) => (
        <section key={group.name} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{group.name}</h2>
          <CompetitionList competitions={group.competitions} {...listProps} />
        </section>
      ))}
      {ungrouped.length > 0 ? (
        <section className="flex flex-col gap-3">
          {groups.length > 0 ? (
            <h2 className="text-lg font-semibold">Other Competitions</h2>
          ) : null}
          <CompetitionList competitions={ungrouped} {...listProps} />
        </section>
      ) : null}
    </main>
  );
}
