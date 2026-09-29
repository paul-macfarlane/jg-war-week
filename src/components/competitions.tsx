import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  type CompetitionListItem,
  type LedgerEntry,
  describeScoring,
  formatMaxPoints,
} from "@/lib/competitions";
import { gameTypeLabel } from "@/lib/games/config";
import { formatPoints } from "@/lib/points";

export function CompetitionFacts({
  competition,
  teamLabel,
}: {
  competition: CompetitionListItem;
  teamLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="secondary" className="tabular-nums">
        {formatMaxPoints(competition.maxPoints)}
      </Badge>
      <Badge
        variant="outline"
        className="text-foreground/70 h-auto text-left whitespace-normal"
      >
        {describeScoring(competition, teamLabel)}
      </Badge>
      {competition.format === "games" && competition.gameType ? (
        <Badge variant="outline" className="text-foreground/70">
          Games · {gameTypeLabel(competition.gameType)}
        </Badge>
      ) : null}
    </div>
  );
}

export function CompetitionList({
  competitions,
  edition,
  teamLabel,
}: {
  competitions: CompetitionListItem[];
  edition: string;
  teamLabel: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {competitions.map((competition) => (
        <li key={competition.id}>
          <Link
            href={`/${edition}/competitions/${competition.id}`}
            className="block rounded-xl"
          >
            <Card
              size="sm"
              className="hover:ring-primary gap-2 px-4 transition-shadow"
            >
              <span className="font-semibold">{competition.name}</span>
              <CompetitionFacts
                competition={competition}
                teamLabel={teamLabel}
              />
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PointsEntryList({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-foreground/70 text-sm">No points yet.</p>;
  }

  return (
    <Card size="sm" className="py-1">
      <ul className="flex flex-col divide-y px-(--card-spacing)">
        {entries.map(({ id, target, points, note }) => (
          <li key={id} className="flex items-start gap-3 px-2 py-2">
            <span
              aria-hidden
              className="mt-1.5 size-3 shrink-0 rounded-full"
              style={{ backgroundColor: target.color ?? "transparent" }}
            />
            <span className="flex flex-1 flex-col">
              <span>
                <span className="font-medium">{target.name}</span>
                {target.team ? (
                  <span
                    className="ml-2 text-xs font-medium"
                    style={{ color: target.color ?? undefined }}
                  >
                    {target.team}
                  </span>
                ) : null}
              </span>
              {note ? (
                <span className="text-foreground/70 text-sm">{note}</span>
              ) : null}
            </span>
            <span className="font-semibold tabular-nums">
              {formatPoints(points)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
