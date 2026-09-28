import { Avatar } from "@/components/avatar";
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
>;

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
