import { Avatar } from "@/components/avatar";
import { CheckInButton, type CheckInOffer } from "@/components/check-in-button";
import { Badge } from "@/components/ui/badge";
import { YouTag } from "@/components/you";
import { formatPoints } from "@/lib/points";
import { formatLedgerTime } from "@/lib/points-entry";
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
  if (competition.participationTeamScoring === "per-person") {
    return `${n} ${n === "1" ? "point" : "points"} to the ${teamLabel} for each Participant who took part.`;
  }
  return `${teamLabel}s ranked by how many took part get Placement Points.`;
}

/**
 * A `participation` Competition on its page: how it scores, Check in or
 * out for the linked Participant (ADR 0009), the close time and "Closed",
 * each Team's headcount in team scoring, and who took part by Profile
 * name (ADR 0007) with their Team. Names, ids and booleans only.
 */
export function ParticipationView({
  view,
  offer,
  teamLabel,
  primaryColor,
}: {
  view: ParticipationData;
  offer: CheckInOffer | null;
  teamLabel: string;
  primaryColor: string;
}) {
  const { competition, tookPart, teamCounts } = view;
  const isTeam = competition.scoring === "team";
  return (
    <section className="flex flex-col gap-4" aria-label="Participation">
      <div className="flex flex-col gap-1">
        <p className="text-sm">{scoringLine(competition, teamLabel)}</p>
        {competition.closed ? (
          <Badge variant="secondary" className="self-start">
            Closed
          </Badge>
        ) : competition.selfCheckIn && competition.checkInClosesAt ? (
          <p className="text-foreground/70 text-sm">
            Check-in closes {formatLedgerTime(competition.checkInClosesAt)}.
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
            <ol
              className="flex flex-col gap-1 text-sm"
              aria-label={`${teamLabel} counts`}
            >
              {teamCounts.map((row) => (
                <li key={row.teamId} className="flex items-center gap-2">
                  <span className="text-foreground/60 w-6 tabular-nums">
                    {row.place}
                  </span>
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="font-medium">{row.name}</span>
                  <span className="ml-auto font-semibold tabular-nums">
                    {row.count}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">
          Took part{" "}
          <span className="text-foreground/60 text-sm font-normal tabular-nums">
            ({tookPart.length})
          </span>
        </h2>
        {tookPart.length === 0 ? (
          <p className="text-foreground/70 text-sm">No one yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Took part">
            {tookPart.map((row) => (
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
