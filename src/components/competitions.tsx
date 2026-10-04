import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  type CompetitionStatus,
  competitionStatusText,
} from "@/lib/competition-status";
import {
  type CompetitionListItem,
  type LedgerEntry,
  describeScoring,
} from "@/lib/competitions";
import { isGameFormat } from "@/lib/enums";
import { gameFormatLabel } from "@/lib/games/config";
import { formatPoints } from "@/lib/points";
import { toPlainText } from "@/lib/rich-text/plain-text";

export function CompetitionFacts({
  competition,
  teamLabel,
}: {
  competition: CompetitionListItem;
  teamLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge
        variant="outline"
        className="text-foreground/70 h-auto text-left whitespace-normal"
      >
        {describeScoring(competition, teamLabel)}
      </Badge>
      {isGameFormat(competition.format) ? (
        <Badge variant="outline" className="text-foreground/70">
          {gameFormatLabel(competition.format)}
        </Badge>
      ) : null}
      {competition.format === "participation" ? (
        <Badge variant="outline" className="text-foreground/70">
          Participation
        </Badge>
      ) : null}
    </div>
  );
}

const STATUS_VARIANTS = {
  "not-started": "outline",
  underway: "secondary",
  closed: "outline",
  done: "default",
} as const satisfies Record<CompetitionStatus["kind"], string>;

/** "Not started", "Underway · Round 2 of 4", "Closed", "Done · Winner: X". */
export function CompetitionStatusBadge({
  status,
}: {
  status: CompetitionStatus;
}) {
  return (
    <Badge
      variant={STATUS_VARIANTS[status.kind]}
      data-status={status.kind}
      className="text-left"
    >
      {competitionStatusText(status)}
    </Badge>
  );
}

/**
 * Each row: the name, its status, a two-line preview of the description's
 * plain text (none when empty), and the Format and scoring badges.
 */
export function CompetitionList({
  competitions,
  edition,
  teamLabel,
}: {
  competitions: (CompetitionListItem & { status: CompetitionStatus })[];
  edition: string;
  teamLabel: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {competitions.map((competition) => {
        const preview = toPlainText(competition.description);
        return (
          <li key={competition.id}>
            <Link
              href={`/${edition}/competitions/${competition.id}`}
              className="block rounded-xl"
            >
              <Card
                size="sm"
                className="hover:ring-primary gap-2 px-4 transition-shadow"
              >
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="font-semibold">{competition.name}</span>
                  <CompetitionStatusBadge status={competition.status} />
                </span>
                {preview ? (
                  <p className="text-foreground/70 line-clamp-2 text-sm">
                    {preview}
                  </p>
                ) : null}
                <CompetitionFacts
                  competition={competition}
                  teamLabel={teamLabel}
                />
              </Card>
            </Link>
          </li>
        );
      })}
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
