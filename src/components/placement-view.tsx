import { Avatar } from "@/components/avatar";
import { ResultsTable, type ResultsTableRow } from "@/components/results-table";
import { TopFinishers } from "@/components/top-finishers";
import { Badge } from "@/components/ui/badge";
import { YouTag } from "@/components/you";
import { entryPointsFor } from "@/lib/results-table";
import type { PlacementRowView, PlacementsView } from "@/queries/placements";

/** How many places the Top finishers summary shows. */
const TOP_PLACES = 3;

/**
 * A Placement Competition on its page: Top finishers, then the results
 * table by Place with Score and War Week points. Until it's Closed the
 * points are Provisional, by the rule Close uses (`placementPointsByRow`);
 * once Closed they are its generated Points Entries. Names and numbers
 * only (ADR 0007): no email reaches it.
 */
export function PlacementView({
  view,
  primaryColor,
  teamLabel,
}: {
  view: PlacementsView;
  primaryColor: string;
  teamLabel: string;
}) {
  const { competition, rows, entryPoints } = view;
  const closed = competition.finalizedAt !== null;
  const pointsOf = (row: PlacementRowView) =>
    closed ? entryPointsFor(entryPoints, row) : row.points;
  const lead = (row: PlacementRowView) =>
    row.participantId ? (
      <Avatar
        name={row.name}
        teamColor={row.color}
        primaryColor={primaryColor}
        image={row.image}
        className="size-6"
      />
    ) : (
      <span
        aria-hidden
        className="mt-1 size-3 shrink-0 rounded-full"
        style={{ backgroundColor: row.color ?? undefined }}
      />
    );
  const tableRows: ResultsTableRow[] = rows.map((row) => ({
    key: row.id,
    rank: row.place,
    name: row.name,
    lead: lead(row),
    after: row.participantId ? (
      <YouTag participantId={row.participantId} />
    ) : null,
    detail: row.team,
    score: row.score,
    points: pointsOf(row),
  }));
  const finishers = rows.flatMap((row) =>
    row.place !== null && row.place <= TOP_PLACES
      ? [
          {
            key: row.id,
            place: row.place,
            name: row.name,
            points: pointsOf(row),
            lead: lead(row),
          },
        ]
      : [],
  );
  return (
    <section className="flex flex-col gap-3" aria-label="Placements">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Placements</h2>
        {closed ? <Badge variant="secondary">Closed</Badge> : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-foreground/70 text-sm">No placements yet.</p>
      ) : (
        <>
          <TopFinishers finishers={finishers} />
          <ResultsTable
            rows={tableRows}
            label="Placement results"
            entrantHeader={
              competition.scoring === "team" ? teamLabel : "Participant"
            }
            provisional={!closed}
          />
        </>
      )}
    </section>
  );
}
