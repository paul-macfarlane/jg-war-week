import { notFound } from "next/navigation";

import { CompetitionList } from "@/components/competitions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCompetitions } from "@/queries/competitions";

import { getWarWeekForEdition } from "../../war-week";

export default async function CompetitionsPage({
  params,
}: PageProps<"/[edition]/competitions">) {
  const { edition } = await params;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();

  const { groups, ungrouped } = await getCompetitions(warWeek);
  const listProps = { edition: warWeek.edition, teamLabel: warWeek.teamLabel };

  // Two or more Competition Groups switch by Tabs; every panel stays
  // mounted, so each group's Competitions are in the page HTML.
  if (groups.length >= 2) {
    const sections = [
      ...groups,
      ...(ungrouped.length > 0
        ? [{ name: "Other Competitions", competitions: ungrouped }]
        : []),
    ];
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6 md:max-w-3xl">
        <h1 className="text-2xl font-bold">Competitions</h1>
        <Tabs defaultValue="0">
          <TabsList className="w-full flex-wrap justify-start gap-1 group-data-horizontal/tabs:h-auto">
            {sections.map((section, index) => (
              <TabsTrigger
                key={section.name}
                value={String(index)}
                className="h-auto min-h-11 max-w-full flex-none px-3 text-left whitespace-normal"
              >
                {section.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {sections.map((section, index) => (
            <TabsContent
              key={section.name}
              value={String(index)}
              keepMounted
              className="pt-2"
            >
              <CompetitionList
                competitions={section.competitions}
                {...listProps}
              />
            </TabsContent>
          ))}
        </Tabs>
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
