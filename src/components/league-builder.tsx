"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  clearPairings,
  closeLeague,
  pairLeague,
  pairNextRound,
  reopenLeague,
} from "@/actions/league";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import { useEntrantsAutosave } from "@/components/entrants-autosave";
import {
  EntrantsPicker,
  type EntrantsPickerItem,
} from "@/components/entrants-picker";
import { Button } from "@/components/ui/button";
import type { EntrantKind } from "@/lib/bracket/squads";
import { hasPlacementPoints } from "@/lib/competitions";
import { placementPointsList } from "@/lib/logged-results";
import { optionsFromTargets } from "@/lib/participant-options";
import type { WriteResult } from "@/lib/result";
import type { LeagueView } from "@/queries/league";

type Target = { id: string; name: string; team: string | null };
type ParticipantTarget = Target & {
  teamColor?: string | null;
  image?: string | null;
};

/**
 * A League's run area on its Competition page (spec R23, decisions 10 and
 * 11): the Entrants (autosaved through the per-field save, locked once
 * round 1 is paired), Pair rounds (round robin) or Pair round 1 / Pair next round
 * (Swiss), Clear pairings, and Close / Reopen. A button the server says is
 * off is disabled with its reason beside it, the same words the server
 * refuses with (Close names the Matches still to play). The rounds are
 * `LeagueRounds`.
 */
export function LeagueBuilder({
  competition,
  entrants,
  offers,
  roundsPaired,
  roundsTotal,
  teams,
  participants,
  entrantsLock,
  teamLabel,
}: {
  competition: {
    id: string;
    scoring: "team" | "individual";
    closed: boolean;
    placementPoints: number[] | null;
  };
  /** The saved Entrants, by Team or Participant id. */
  entrants: { teamId: string | null; participantId: string | null }[];
  offers: LeagueView["offers"];
  roundsPaired: number;
  roundsTotal: number;
  teams: Target[];
  participants: ParticipantTarget[];
  /** Why the Entrants can't change now (paired or Closed), or null. */
  entrantsLock: string | null;
  teamLabel: string;
}) {
  const router = useRouter();
  const isTeam = competition.scoring === "team";
  const kind: EntrantKind = isTeam ? "team" : "participant";
  const closed = competition.closed;

  const entrantsAutosave = useEntrantsAutosave(competition.id, {
    kind,
    targetIds: entrants.map((e) => (e.teamId ?? e.participantId)!),
  });
  const [pending, startTransition] = useTransition();

  const items: EntrantsPickerItem[] = teams.map((t) => ({
    id: t.id,
    label: t.name,
  }));
  const participantOptions = optionsFromTargets(participants);

  function run(action: () => Promise<WriteResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
      router.refresh();
    });
  }

  const { pair, pairNext, clearPairings: clear, close, reopen } = offers;
  // One solid button at a time: the next step. Pairing while a pairing
  // offer is open; Close once none is.
  const pairingOpen = [pair, pairNext].some(
    (offer) => offer !== null && offer.disabledReason === null,
  );
  const closeVariant = pairingOpen ? "outline" : "default";
  return (
    <div className="flex flex-col gap-8">
      {closed && (
        <p className="border-border rounded-lg border px-3 py-2 text-sm">
          This League is closed. Reopen it to change a result or its settings.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <EntrantsPicker
          id="league-entrants"
          description={
            isTeam
              ? `Choose the ${teamLabel}s who play this League.`
              : "Choose the Participants who play this League."
          }
          kind={kind}
          kindLabel={teamLabel}
          options={items}
          participantOptions={participantOptions}
          selected={entrantsAutosave.value.targetIds}
          onChange={(targetIds) => entrantsAutosave.edit({ kind, targetIds })}
          disabled={closed || entrantsLock !== null}
          status={entrantsAutosave.status}
          error={entrantsAutosave.error}
        />
        {entrantsLock && (
          <p data-slot="lock-reason" className="text-foreground/70 text-sm">
            {entrantsLock}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-foreground/70 text-sm">
          {roundsPaired === 0
            ? "No rounds are paired yet."
            : `${roundsPaired} of ${roundsTotal} rounds paired.`}
        </p>
        {pair && (
          <OfferButton
            label={pair.label}
            reason={pair.disabledReason}
            pending={pending}
            onClick={() => run(() => pairLeague(competition.id), "Paired")}
          />
        )}
        {pairNext && (
          <OfferButton
            label={pairNext.label}
            reason={pairNext.disabledReason}
            pending={pending}
            onClick={() =>
              run(() => pairNextRound(competition.id), "Round paired")
            }
          />
        )}
        {clear && (
          <div className="flex flex-wrap items-center gap-3">
            {clear.disabledReason ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="min-h-11"
                  disabled
                >
                  {clear.label}
                </Button>
                <p
                  data-slot="offer-reason"
                  className="text-foreground/70 text-sm"
                >
                  {clear.disabledReason}
                </p>
              </>
            ) : (
              <ConfirmActionButton
                title="Clear the pairings?"
                description="Every round is deleted so the Entrants and settings can change. You can pair again after."
                confirmLabel="Clear pairings"
                action={() => clearPairings(competition.id)}
                successMessage="Pairings cleared"
                variant="outline"
                size="lg"
                className="min-h-11"
              >
                {clear.label}
              </ConfirmActionButton>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {reopen ? (
          <>
            <p className="text-foreground/70 text-sm">
              {hasPlacementPoints(competition.placementPoints)
                ? "Closed: its Points Entries are in the Standings."
                : "Closed: it has no Placement Points, so it made no Points Entries."}
            </p>
            <ConfirmActionButton
              title="Reopen this Competition?"
              description={
                hasPlacementPoints(competition.placementPoints)
                  ? "The generated Points Entries are withdrawn."
                  : "Results can change again."
              }
              confirmLabel="Reopen"
              action={() => reopenLeague(competition.id)}
              successMessage="Competition reopened"
              variant="outline"
              size="lg"
              className="min-h-11"
            >
              {reopen.label}
            </ConfirmActionButton>
          </>
        ) : close?.disabledReason ? (
          <>
            <Button
              type="button"
              variant={closeVariant}
              size="lg"
              className="min-h-11"
              disabled
            >
              {close.label}
            </Button>
            <p data-slot="close-reason" className="text-foreground/70 text-sm">
              {close.disabledReason}
            </p>
          </>
        ) : close ? (
          <ConfirmActionButton
            title="Close this Competition?"
            description={`The standings' top places get Placement Points (${placementPointsList(
              competition.placementPoints,
            )}) and results are locked.`}
            confirmLabel="Close"
            action={() => closeLeague(competition.id)}
            successMessage="Competition closed"
            variant={closeVariant}
            size="lg"
            className="min-h-11"
          >
            {close.label}
          </ConfirmActionButton>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A pairing button: solid while it's the next step, outline when off, with
 * the rule's reason beside it.
 */
function OfferButton({
  label,
  reason,
  pending,
  onClick,
}: {
  label: string;
  reason: string | null;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant={reason === null ? "default" : "outline"}
        size="lg"
        className="min-h-11"
        disabled={pending || reason !== null}
        onClick={onClick}
      >
        {label}
      </Button>
      {reason ? (
        <p data-slot="offer-reason" className="text-foreground/70 text-sm">
          {reason}
        </p>
      ) : null}
    </div>
  );
}
