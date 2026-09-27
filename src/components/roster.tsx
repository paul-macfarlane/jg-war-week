import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { YouTag } from "@/components/you";
import {
  type RosterParticipant,
  type RosterTeam,
  participantCountLabel,
} from "@/lib/roster";
import { YOU_ROW_CLASS } from "@/lib/you";

export function RosterList({
  participants,
  leaderTitle,
  teamColor,
  primaryColor,
}: {
  participants: RosterParticipant[];
  leaderTitle: string;
  /** The Team's color for their Avatars, or null with no Team. */
  teamColor: string | null;
  /** The Appearance Theme primary color, for Avatars with no Team. */
  primaryColor: string;
}) {
  if (participants.length === 0) {
    return <p className="text-foreground/70 text-sm">No Participants yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y">
      {participants.map((p) => (
        <li
          key={p.id}
          className={`flex flex-wrap items-center gap-2 px-2 py-2 ${YOU_ROW_CLASS}`}
        >
          <Avatar
            name={p.displayName}
            teamColor={teamColor}
            primaryColor={primaryColor}
          />
          <span className={p.isLeader ? "font-semibold" : undefined}>
            {p.displayName}
          </span>
          <YouTag participantId={p.id} />
          {p.isLeader ? <Badge>{leaderTitle}</Badge> : null}
          {p.companyTag ? (
            <Badge variant="outline" className="text-foreground/70 font-normal">
              {p.companyTag}
            </Badge>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function TeamRoster({
  team,
  teamLabel,
  leaderTitle,
  primaryColor,
}: {
  team: RosterTeam;
  teamLabel: string;
  leaderTitle: string;
  primaryColor: string;
}) {
  return (
    <Card
      size="sm"
      className="border-t-4"
      style={{ borderTopColor: team.color }}
    >
      <CardHeader className="flex items-center gap-3">
        {team.logoUrl ? (
          <img
            src={team.logoUrl}
            alt={`${team.name} logo`}
            className="size-10 rounded object-contain"
          />
        ) : (
          <span
            aria-hidden
            className="size-4 shrink-0 rounded-full"
            style={{ backgroundColor: team.color }}
          />
        )}
        <h2 className="flex-1 text-lg font-semibold">
          <span className="text-foreground/60 mr-1 text-sm font-medium">
            {teamLabel}
          </span>
          {team.name}
        </h2>
        <span className="text-foreground/60 text-sm tabular-nums">
          {participantCountLabel(team.participants.length)}
        </span>
      </CardHeader>
      <CardContent>
        <RosterList
          participants={team.participants}
          leaderTitle={leaderTitle}
          teamColor={team.color}
          primaryColor={primaryColor}
        />
      </CardContent>
    </Card>
  );
}
