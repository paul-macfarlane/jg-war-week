"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { closeGames, reopenGames } from "@/actions/games";
import { saveCompetitionSetting } from "@/actions/setup";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import {
  EntrantsPicker,
  type EntrantsPickerItem,
} from "@/components/entrants-picker";
import type { EntrantKind } from "@/lib/bracket/squads";
import { hasPlacementPoints } from "@/lib/competitions";
import type { GameFormat } from "@/lib/enums";
import { resultNoun } from "@/lib/games/config";
import { placementPointsList } from "@/lib/games/view";

type Target = { id: string; name: string; team: string | null };

/**
 * A Head-to-head or Best score Competition's run area on its Competition
 * page: the fixed Entrant list (when Entrants aren't open; saved through
 * the per-field save), the Best of prompt, and Close / Reopen (R3 decision
 * 1). Its settings (draws, Best of, count, Entrants open, logging close,
 * enrollment) are in the page's Settings.
 */
export function GamesBuilder({
  competition,
  entrants,
  teams,
  participants,
  entrantsLock,
}: {
  competition: {
    id: string;
    scoring: "team" | "individual";
    gameFormat: GameFormat;
    entrantsOpen: boolean;
    closed: boolean;
    placementPoints: number[] | null;
    bestOfDecided: boolean;
    bestOfWinner: string | null;
  };
  /** The saved fixed-list Entrants, by Team or Participant id. */
  entrants: { teamId: string | null; participantId: string | null }[];
  teams: Target[];
  participants: Target[];
  /** Why the Entrants can't change now (Closed), or null. */
  entrantsLock: string | null;
}) {
  const router = useRouter();
  const isTeam = competition.scoring === "team";
  const kind: EntrantKind = isTeam ? "team" : "participant";
  const locked = competition.closed;
  const noun = resultNoun(competition.gameFormat);

  const savedEntrantIds = entrants.map((e) => (e.teamId ?? e.participantId)!);
  const [selected, setSelected] = useState<string[]>(savedEntrantIds);
  const dirty =
    selected.length !== savedEntrantIds.length ||
    !selected.every((id) => savedEntrantIds.includes(id));
  const [savingEntrants, setSavingEntrants] = useState(false);

  const items: EntrantsPickerItem[] = (isTeam ? teams : participants).map(
    (t) => ({ id: t.id, label: t.name, detail: t.team ?? undefined }),
  );

  async function saveEntrants() {
    setSavingEntrants(true);
    const saved = await saveCompetitionSetting(competition.id, {
      field: "entrants",
      value: { kind, targetIds: selected },
    });
    setSavingEntrants(false);
    if (saved.ok) {
      toast.success("Entrants saved");
      router.refresh();
    } else {
      toast.error(saved.error);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {competition.bestOfDecided && !locked && (
        <p className="border-primary bg-primary/5 rounded-lg border px-3 py-2 text-sm font-medium">
          Best of decided: {competition.bestOfWinner} — Close it.
        </p>
      )}

      {locked && (
        <p className="border-border rounded-lg border px-3 py-2 text-sm">
          This Competition is closed. Reopen it to change its Entrants,{" "}
          {noun.many} or settings.
        </p>
      )}

      {competition.entrantsOpen ? (
        <p className="text-foreground/70 text-sm">
          Entrants are open to everyone: anyone eligible may log {noun.a}.
        </p>
      ) : (
        <EntrantsPicker
          id="games-entrants"
          description={
            !isTeam
              ? "An individual Competition, so its Entrants are Participants."
              : "A team Competition, so its Entrants are Teams."
          }
          kind={kind}
          options={items}
          selected={selected}
          onChange={setSelected}
          onSave={saveEntrants}
          disabled={savingEntrants || locked || entrantsLock !== null}
          saveDisabled={!dirty}
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
              action={() => reopenGames(competition.id)}
              successMessage="Competition reopened"
              variant="outline"
              size="lg"
              className="min-h-11"
            >
              Reopen
            </ConfirmActionButton>
          </>
        ) : (
          <ConfirmActionButton
            title="Close this Competition?"
            description={`The results' top places get Placement Points (${placementPointsList(
              competition.placementPoints,
            )}) and logging stops.`}
            confirmLabel="Close"
            action={() => closeGames(competition.id)}
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
