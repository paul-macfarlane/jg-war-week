"use client";

import {
  closeLoggedResults,
  reopenLoggedResults,
} from "@/actions/logged-results";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import { useEntrantsAutosave } from "@/components/entrants-autosave";
import {
  EntrantsPair,
  type EntrantsPickerItem,
} from "@/components/entrants-picker";
import { Button } from "@/components/ui/button";
import { hasPlacementPoints } from "@/lib/competitions";
import { pairTargets } from "@/lib/entrants";
import type { LoggedFormat } from "@/lib/enums";
import { placementPointsList, resultNoun } from "@/lib/logged-results";
import { optionsFromTargets } from "@/lib/participant-options";

type Target = { id: string; name: string; team: string | null };
type ParticipantTarget = Target & {
  teamColor?: string | null;
  image?: string | null;
};

/**
 * A Head-to-head or Best score Competition's run area on its Competition
 * page: a Head-to-head's two Entrants, "A vs B" (autosaved through the
 * per-field save once both are set) and its decided-series prompt; then Close / Reopen (R3 decision 1). Best
 * score has no Entrant list. Their settings (draws, Best of, direction,
 * unit, Team score) are in the page's Settings.
 */
export function LoggedResultsBuilder({
  competition,
  entrants,
  teams,
  participants,
  entrantsLock,
  teamLabel = "Team",
}: {
  competition: {
    id: string;
    scoring: "team" | "individual";
    format: LoggedFormat;
    closed: boolean;
    placementPoints: number[] | null;
    decided: boolean;
    seriesWinner: string | null;
    /**
     * Why Close is disabled (a Head-to-head series neither decided nor
     * drawn), the server's own refusal; null when it can close.
     */
    closeError: string | null;
  };
  /** A Head-to-head's saved Entrants, by Team or Participant id. */
  entrants: { teamId: string | null; participantId: string | null }[];
  teams: Target[];
  participants: ParticipantTarget[];
  /** Why the Entrants can't change now (Closed), or null. */
  entrantsLock: string | null;
  /** The War Week's Team Label, for a team Head-to-head's pickers. */
  teamLabel?: string;
}) {
  const isTeam = competition.scoring === "team";
  const kind = isTeam ? "team" : "participant";
  const locked = competition.closed;
  const noun = resultNoun(competition.format);

  const entrantsAutosave = useEntrantsAutosave(
    competition.id,
    { kind, targetIds: entrants.map((e) => (e.teamId ?? e.participantId)!) },
    { ordered: true },
  );
  const [first = "", second = ""] = entrantsAutosave.value.targetIds;

  const items: EntrantsPickerItem[] = teams.map((t) => ({
    id: t.id,
    label: t.name,
  }));
  const participantOptions = optionsFromTargets(participants);

  return (
    <div className="flex flex-col gap-8">
      {competition.decided && !locked && (
        <p className="border-primary bg-primary/5 rounded-lg border px-3 py-2 text-sm font-medium">
          Best of decided: {competition.seriesWinner} — Close it.
        </p>
      )}

      {locked && (
        <p className="border-border rounded-lg border px-3 py-2 text-sm">
          This Competition is closed. Reopen it to change its{" "}
          {competition.format === "head-to-head" ? "Entrants, " : ""}
          {noun.many} or settings.
        </p>
      )}

      {competition.format === "best-score" ? (
        <p className="text-foreground/70 text-sm">
          Best score has no Entrant list: any Participant may log {noun.a}.
        </p>
      ) : (
        <EntrantsPair
          id="series-entrants"
          description={
            !isTeam
              ? "Choose the 2 Participants who play this Head-to-head."
              : `Choose the 2 ${teamLabel}s who play this Head-to-head.`
          }
          kind={kind}
          kindLabel={teamLabel}
          options={items}
          participantOptions={participantOptions}
          value={[first, second]}
          onChange={([a, b]) => {
            const pair = pairTargets(a, b);
            // Saved once both sides are set; until then the saved pair stays.
            entrantsAutosave.edit({ kind, targetIds: pair ?? [a, b] }, !!pair);
          }}
          disabled={locked || entrantsLock !== null}
          status={entrantsAutosave.status}
          error={entrantsAutosave.error}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        {competition.closed ? (
          <>
            <p className="text-foreground/70 text-sm">
              {hasPlacementPoints(competition.placementPoints)
                ? "Closed: its Points Entries are in the Standings."
                : "Closed: it has no Placement Points, so it made no Points Entries."}{" "}
              Reopen to log more {noun.many}.
            </p>
            <ConfirmActionButton
              title="Reopen this Competition?"
              description={
                hasPlacementPoints(competition.placementPoints)
                  ? "The generated Points Entries are withdrawn."
                  : `Players can log ${noun.many} again.`
              }
              confirmLabel="Reopen"
              action={() => reopenLoggedResults(competition.id)}
              successMessage="Competition reopened"
              variant="outline"
              size="lg"
              className="min-h-11"
            >
              Reopen
            </ConfirmActionButton>
          </>
        ) : competition.closeError ? (
          <>
            <Button type="button" size="lg" className="min-h-11" disabled>
              Close
            </Button>
            <p className="text-foreground/70 text-sm">
              {competition.closeError}
            </p>
          </>
        ) : (
          <ConfirmActionButton
            title="Close this Competition?"
            description={`The results' top places get Placement Points (${placementPointsList(
              competition.placementPoints,
            )}) and logging stops.`}
            confirmLabel="Close"
            action={() => closeLoggedResults(competition.id)}
            successMessage="Competition closed"
            variant="default"
            size="lg"
            className="min-h-11"
          >
            Close
          </ConfirmActionButton>
        )}
      </div>
    </div>
  );
}
