import Link from "next/link";

import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPoints } from "@/lib/points";
import { formatLedgerTime } from "@/lib/points-entry";
import type { RecentResult, ResultTarget } from "@/lib/recent-results";

/** A Team's color dot, or a Participant's Avatar, beside the name. */
function TargetName({
  target,
  primaryColor,
}: {
  target: ResultTarget;
  primaryColor: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {target.kind === "team" ? (
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: target.color ?? primaryColor }}
        />
      ) : (
        <Avatar
          name={target.name}
          teamColor={target.color}
          primaryColor={primaryColor}
          image={target.image}
        />
      )}
      <span className="font-medium">{target.name}</span>
    </span>
  );
}

function ResultSummary({
  result,
  primaryColor,
}: {
  result: RecentResult;
  primaryColor: string;
}) {
  if (result.kind === "discretionary") {
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <TargetName target={result.target} primaryColor={primaryColor} />
        <span className="font-semibold tabular-nums">
          {formatPoints(result.points)}
        </span>
        <span className="text-foreground/70 break-words">{result.reason}</span>
      </span>
    );
  }
  if (result.kind === "participation-closed" && result.tookPart !== null) {
    return (
      <span className="text-sm">
        <span className="font-semibold tabular-nums">{result.tookPart}</span>{" "}
        took part
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-foreground/70">
        {result.kind === "games-closed" || result.kind === "placement-finalized"
          ? "Winner"
          : result.kind === "participation-closed"
            ? "Top"
            : "Champion"}
      </span>
      {result.winners.map((target) => (
        <TargetName
          key={`${target.kind}-${target.id}`}
          target={target}
          primaryColor={primaryColor}
        />
      ))}
    </span>
  );
}

/**
 * Home page summary of the latest results. Renders nothing until something
 * has been scored.
 */
export function RecentResultsSection({
  results,
  edition,
  primaryColor,
}: {
  results: RecentResult[];
  edition: string;
  primaryColor: string;
}) {
  if (results.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="recent-results">
      <div className="flex items-baseline justify-between">
        <h2 id="recent-results" className="text-lg font-semibold">
          Recent results
        </h2>
        <Link
          href={`/${edition}/competitions`}
          className="text-primary text-sm font-medium"
        >
          All Competitions
        </Link>
      </div>
      <Card size="sm" className="py-1">
        <ol className="flex flex-col divide-y px-(--card-spacing)">
          {results.map((result) => (
            <li key={result.key} className="flex flex-col gap-1 py-2">
              <div className="flex flex-wrap items-center gap-2">
                {result.kind === "discretionary" ? (
                  <span className="font-semibold">Discretionary points</span>
                ) : (
                  <Link
                    href={`/${edition}/competitions/${result.competitionId}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {result.competition}
                  </Link>
                )}
                {result.kind === "bracket-finalized" ? (
                  <Badge variant="secondary">Bracket finalized</Badge>
                ) : null}
                {result.kind === "placement-finalized" ? (
                  <Badge variant="secondary">Finalized</Badge>
                ) : null}
                {result.kind === "games-closed" ||
                result.kind === "participation-closed" ? (
                  <Badge variant="secondary">Closed</Badge>
                ) : null}
                <span className="text-foreground/60 ml-auto text-xs">
                  {formatLedgerTime(result.when)}
                </span>
              </div>
              <ResultSummary result={result} primaryColor={primaryColor} />
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}
