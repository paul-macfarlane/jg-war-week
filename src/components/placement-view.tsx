import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { YouTag } from "@/components/you";
import { placementLabel } from "@/lib/competitions";
import { formatPoints } from "@/lib/points";
import type { PlacementsView } from "@/queries/placements";

/**
 * A Placement Competition on its page: whether it's Finalized, then each
 * row by Place with name, Team, Score and points; unplaced rows last.
 * Names and numbers only (ADR 0007): no email reaches it.
 */
export function PlacementView({
  view,
  primaryColor,
}: {
  view: PlacementsView;
  primaryColor: string;
}) {
  const { competition, rows } = view;
  const hasScores = rows.some((row) => row.score !== null);
  return (
    <section className="flex flex-col gap-3" aria-label="Placements">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Placements</h2>
        {competition.finalizedAt ? (
          <Badge variant="secondary">Finalized</Badge>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-foreground/70 text-sm">No placements yet.</p>
      ) : (
        <ol className="flex flex-col divide-y text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex min-w-0 items-center gap-2 py-2">
              <span className="text-foreground/60 w-9 shrink-0 tabular-nums">
                {row.place === null ? "–" : placementLabel(row.place)}
              </span>
              {row.participantId ? (
                <Avatar
                  name={row.name}
                  teamColor={row.color}
                  primaryColor={primaryColor}
                  image={row.image}
                />
              ) : (
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color ?? undefined }}
                />
              )}
              <span className="flex min-w-0 flex-col">
                <span className="flex min-w-0 items-center gap-1">
                  <span className="truncate font-medium">{row.name}</span>
                  {row.participantId ? (
                    <YouTag participantId={row.participantId} />
                  ) : null}
                </span>
                {row.team ? (
                  <span className="text-foreground/60 truncate text-xs">
                    {row.team}
                  </span>
                ) : null}
              </span>
              {hasScores ? (
                <span className="text-foreground/70 ml-auto tabular-nums">
                  {row.score === null
                    ? ""
                    : `Score ${row.score.toLocaleString("en-US", { maximumFractionDigits: 3 })}`}
                </span>
              ) : null}
              <span
                className={`w-12 shrink-0 text-right font-semibold tabular-nums ${hasScores ? "" : "ml-auto"}`}
              >
                {row.points === null ? "–" : formatPoints(row.points)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
