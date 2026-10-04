import { Avatar } from "@/components/avatar";
import { CheckInButton, type CheckInOffer } from "@/components/check-in-button";
import { ProvisionalBadge, ResultsTable } from "@/components/results-table";
import { Badge } from "@/components/ui/badge";
import { YouTag } from "@/components/you";
import { scoreParticipation } from "@/lib/participation/score";
import { formatPoints, formatPointsLabel } from "@/lib/points";
import { formatLedgerTime } from "@/lib/points-entry";
import { entryPointsFor } from "@/lib/results-table";
import type { ParticipationView as ParticipationData } from "@/queries/participation";

/** How the Competition scores taking part, in a line. */
function scoringLine(
  competition: ParticipationData["competition"],
  teamLabel: string,
): string {
  const n = formatPoints(competition.participationPoints ?? 0);
  if (competition.scoring === "individual") {
    return `${n} ${n === "1" ? "point" : "points"} for each Participant who took part.`;
  }
  return `${teamLabel}s ranked by how many took part get Placement Points.`;
}

/**
 * A `participation` Competition on its page: how it scores, Check in or
 * out for the linked Participant (ADR 0009), the close time and "Closed",
 * in team scoring the results table ranked by headcount, and who took part
 * by Profile name (ADR 0007) with their Team (and, in individual scoring,
 * their points). Until Closed the points are Provisional, by the rule
 * Close uses (`scoreParticipation`); once Closed they are its generated
 * Points Entries. Names, ids and booleans only.
 */
export function ParticipationView({
  view,
  offer,
  teamLabel,
  primaryColor,
  now,
}: {
  view: ParticipationData;
  offer: CheckInOffer | null;
  teamLabel: string;
  primaryColor: string;
  /** The current time, so the close time reads as past or to come. */
  now: Date;
}) {
  const { competition, tookPart, teamCounts, entryPoints } = view;
  const isTeam = competition.scoring === "team";
  const closed = competition.closed;
  const provisional = scoreParticipation(tookPart, competition);
  const pointsOf = (target: {
    teamId?: string | null;
    participantId?: string | null;
  }) =>
    closed
      ? entryPointsFor(entryPoints, target)
      : entryPointsFor(provisional, target);
  return (
    <section className="flex flex-col gap-4" aria-label="Participation">
      <div className="flex flex-col gap-1">
        <p className="text-sm">{scoringLine(competition, teamLabel)}</p>
        {closed ? (
          <Badge variant="secondary" className="self-start">
            Closed
          </Badge>
        ) : competition.selfCheckIn && competition.checkInClosesAt ? (
          <p className="text-foreground/70 text-sm">
            Check-in {now >= competition.checkInClosesAt ? "closed" : "closes"}{" "}
            {formatLedgerTime(competition.checkInClosesAt)}.
          </p>
        ) : null}
      </div>
      {offer ? <CheckInButton offer={offer} /> : null}
      {isTeam ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{teamLabel} counts</h2>
          {teamCounts.length === 0 ? (
            <p className="text-foreground/70 text-sm">No one yet.</p>
          ) : (
            <ResultsTable
              label={`${teamLabel} counts`}
              entrantHeader={teamLabel}
              scoreUnit="headcount"
              provisional={!closed}
              rows={teamCounts.map((row) => ({
                key: row.teamId,
                rank: row.place,
                name: row.name,
                lead: (
                  <span
                    aria-hidden
                    className="mt-1 size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                ),
                score: row.count,
                points: pointsOf({ teamId: row.teamId }),
              }))}
            />
          )}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">
            Took part{" "}
            <span className="text-foreground/60 text-sm font-normal tabular-nums">
              ({tookPart.length})
            </span>
          </h2>
          {!isTeam && !closed && tookPart.length > 0 ? (
            <ProvisionalBadge />
          ) : null}
        </div>
        {tookPart.length === 0 ? (
          <p className="text-foreground/70 text-sm">No one yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Took part">
            {tookPart.map((row) => {
              const points = isTeam
                ? null
                : pointsOf({ participantId: row.participantId });
              return (
                <li
                  key={row.participantId}
                  className="flex min-w-0 items-center gap-2 text-sm"
                >
                  <Avatar
                    name={row.name}
                    teamColor={row.teamColor}
                    primaryColor={primaryColor}
                    image={row.image}
                  />
                  <span className="truncate font-medium">{row.name}</span>
                  <YouTag participantId={row.participantId} />
                  {isTeam && row.team ? (
                    <span className="text-foreground/60 truncate">
                      {row.team}
                    </span>
                  ) : null}
                  {isTeam ? null : (
                    <span className="ml-auto shrink-0 font-semibold tabular-nums">
                      {points === null ? "–" : formatPointsLabel(points)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
