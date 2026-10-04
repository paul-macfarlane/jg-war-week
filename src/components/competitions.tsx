import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { WarWeek } from "@/db/schema";
import {
  type CompetitionStatus,
  competitionStatusText,
} from "@/lib/competition-status";
import { type CompetitionListItem, describeScoring } from "@/lib/competitions";
import { isGameFormat } from "@/lib/enums";
import { gameFormatLabel } from "@/lib/games/config";
import { toPlainText } from "@/lib/rich-text/plain-text";

export function CompetitionFacts({
  competition,
  teamLabel,
  mode = "teams",
}: {
  competition: CompetitionListItem;
  teamLabel: string;
  /** A free-for-all War Week has no Individual/Team choice to show. */
  mode?: WarWeek["mode"];
}) {
  const hideScoring = mode === "free-for-all" && competition.scoring !== "team";
  return (
    <div className="flex flex-wrap gap-1.5">
      {hideScoring ? null : (
        <Badge
          variant="outline"
          className="text-foreground/70 h-auto text-left whitespace-normal"
        >
          {describeScoring(competition, teamLabel)}
        </Badge>
      )}
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
  mode,
}: {
  competitions: (CompetitionListItem & { status: CompetitionStatus })[];
  edition: string;
  teamLabel: string;
  mode?: WarWeek["mode"];
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
                  mode={mode}
                />
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
