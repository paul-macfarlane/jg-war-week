import { Avatar } from "@/components/avatar";
import { TeamTag } from "@/components/participant-mark";
import type { BracketEntrant } from "@/queries/brackets";

export type BracketViewEntrant = Pick<
  BracketEntrant,
  | "id"
  | "label"
  | "color"
  | "teamId"
  | "participantId"
  | "squadId"
  | "participantNames"
> & {
  /** An individual Entrant's picture URL; null or absent for initials. */
  image?: BracketEntrant["image"];
  /** The Participant's (or Squad's) Team name, for the Team rule. */
  teamName?: BracketEntrant["teamName"];
};

type Scoring = "team" | "individual";

/** A Team's color dot, or a Participant's Avatar. */
export function EntrantMark({
  entrant,
  scoring,
  primaryColor,
}: {
  entrant: BracketViewEntrant;
  scoring: Scoring;
  primaryColor: string;
}) {
  if (scoring === "individual") {
    return (
      <Avatar
        name={entrant.label}
        teamColor={entrant.color}
        primaryColor={primaryColor}
        image={entrant.image}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="size-3 shrink-0 rounded-full"
      style={{ backgroundColor: entrant.color ?? primaryColor }}
    />
  );
}

/**
 * An individual Entrant's Team by name (the Team rule, CONTEXT.md), beside
 * its label where there is room; `responsive` leaves only the Avatar's Team
 * color below `md`. Nothing for a Team Entrant, which is the Team, and
 * nothing in a free-for-all War Week.
 */
export function EntrantTeam({
  entrant,
  scoring,
  responsive = false,
}: {
  entrant: BracketViewEntrant;
  scoring: Scoring;
  responsive?: boolean;
}) {
  if (scoring !== "individual") return null;
  return (
    <TeamTag
      name={entrant.teamName}
      color={entrant.color}
      responsive={responsive}
      className="shrink-0"
    />
  );
}
