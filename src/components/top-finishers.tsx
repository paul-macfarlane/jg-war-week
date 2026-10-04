import { Trophy } from "lucide-react";
import type { ReactNode } from "react";

import { ProvisionalBadge } from "@/components/results-table";
import { Badge } from "@/components/ui/badge";
import { placementLabel } from "@/lib/competitions";
import { formatPointsLabel } from "@/lib/points";

/** A decided place: who holds it and what it earns. */
export type TopFinisher = {
  key: string;
  place: number;
  name: string;
  /** War Week points; null when the place earns none. */
  points: number | null;
  /** Before the name: an Avatar or a Team's color dot. */
  lead?: ReactNode;
  /** Right after the name: the "You" tag. */
  after?: ReactNode;
};

/**
 * "Top finishers" (spec R20, decision 5): a compact summary of the places
 * a Competition has decided, each with its points, 1st marked Winner. It
 * is given only the decided places and is a summary above the results,
 * never a second list of every row. Renders nothing with none. Where no
 * results table carries the Provisional badge (a Bracket), `provisional`
 * puts it beside the heading.
 */
export function TopFinishers({
  finishers,
  provisional = false,
}: {
  finishers: TopFinisher[];
  provisional?: boolean;
}) {
  if (finishers.length === 0) return null;
  const ordered = [...finishers].sort(
    (a, b) => a.place - b.place || a.name.localeCompare(b.name),
  );
  return (
    <section aria-label="Top finishers" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-foreground/70 text-sm font-semibold">
          Top finishers
        </h3>
        {provisional ? <ProvisionalBadge /> : null}
      </div>
      <ol
        className={`grid gap-2 ${ordered.length === 4 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
      >
        {ordered.map((finisher) => {
          const winner = finisher.place === 1;
          return (
            <li
              key={finisher.key}
              data-winner={winner || undefined}
              className={`flex min-w-0 items-center gap-2 rounded-lg border p-3 text-sm ${winner ? "border-primary bg-primary/10" : ""}`}
            >
              <span className="flex w-10 shrink-0 items-center gap-1 font-semibold tabular-nums">
                {placementLabel(finisher.place)}
                {winner ? (
                  <Trophy aria-hidden className="text-primary size-4" />
                ) : null}
              </span>
              {finisher.lead}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 flex-wrap items-center gap-1">
                  <span className="font-medium break-words">
                    {finisher.name}
                  </span>
                  {winner ? <Badge>Winner</Badge> : null}
                  {finisher.after}
                </span>
                <span className="text-foreground/70 text-xs tabular-nums">
                  {finisher.points === null
                    ? "No points"
                    : formatPointsLabel(finisher.points)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
