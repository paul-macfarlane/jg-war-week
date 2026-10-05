"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { clearLeagueResult, swapPairing } from "@/actions/league";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import {
  LeagueResultForm,
  type LeagueResultTarget,
} from "@/components/league-result-form";
import { When } from "@/components/logged-results-view";
import { OptionSelect } from "@/components/option-select";
import {
  ResponsiveSheetDialog,
  ResponsiveSheetDialogDescription,
  ResponsiveSheetDialogFooter,
  ResponsiveSheetDialogHeader,
  ResponsiveSheetDialogTitle,
} from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { YouTag } from "@/components/you";
import type { ScoreDirection } from "@/lib/enums";
import type { LeaguePairing } from "@/lib/league/config";
import { swapWarnings } from "@/lib/league/pairing";
import {
  byeLine,
  matchLine,
  scoresText,
  swapWarningLines,
} from "@/lib/league/view-text";
import type {
  LeagueEntrantView,
  LeagueMatchView,
  LeagueRoundView,
} from "@/queries/league";

type Linked = { participantId: string; teamId: string | null } | null;

/** "You" on your own Entrant, "Your Team" on your Team's. */
export function LeagueYouMark({
  entrant,
  scoring,
  linked,
}: {
  entrant: Pick<LeagueEntrantView, "teamId" | "participantId">;
  scoring: "team" | "individual";
  linked: Linked;
}) {
  if (scoring === "individual") {
    return entrant.participantId ? (
      <YouTag participantId={entrant.participantId} />
    ) : null;
  }
  return linked?.teamId && linked.teamId === entrant.teamId ? (
    <span
      data-you
      className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-semibold"
    >
      Your Team
    </span>
  ) : null;
}

/**
 * A League's rounds, round 1 first, one labelled region each (spec R23,
 * decisions 10 and 11): every Match as "Ada 1–0 Bo", "Ada ½–½ Bo" or "Ada
 * v Bo", its Scores with the unit, when it was recorded, and Record result
 * / Edit / Clear where the server said the viewer may (`canRecord`,
 * `canClear`). The viewer's own Match is highlighted. An Organizer or Host
 * (`runs`) also gets each round's Edit pairings, which swaps two Entrants
 * and warns about the repeats and never-meets before saving. Names only,
 * never an email.
 */
export function LeagueRounds({
  competitionId,
  scoring,
  pairing,
  scoreDirection,
  scoreUnit,
  entrants,
  rounds,
  runs,
  linked,
  now,
}: {
  competitionId: string;
  scoring: "team" | "individual";
  pairing: LeaguePairing;
  scoreDirection: ScoreDirection;
  scoreUnit: string | null;
  entrants: LeagueEntrantView[];
  rounds: LeagueRoundView[];
  runs: boolean;
  linked: Linked;
  /** The server's clock, so "5 minutes ago" reads the same once hydrated. */
  now: Date;
}) {
  const [recording, setRecording] = useState<LeagueResultTarget | null>(null);
  const [editing, setEditing] = useState<LeagueRoundView | null>(null);
  const byId = new Map(entrants.map((e) => [e.id, e]));
  const nameOf = (id: string) => byId.get(id)?.name ?? "Unknown";

  if (rounds.length === 0) return null;
  return (
    <div className="flex flex-col gap-6">
      {rounds.map((round) => (
        <section
          key={round.round}
          aria-label={`Round ${round.round}`}
          className="flex min-w-0 flex-col gap-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 className="text-lg font-semibold">Round {round.round}</h3>
            {runs ? (
              <span className="flex flex-wrap items-center gap-2">
                {round.editDisabledReason ? (
                  <span
                    data-slot="edit-disabled-reason"
                    className="text-foreground/70 text-xs"
                  >
                    {round.editDisabledReason}
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 sm:min-h-0"
                  disabled={round.editDisabledReason !== null}
                  onClick={() => setEditing(round)}
                >
                  Edit pairings
                </Button>
              </span>
            ) : null}
          </div>
          <Card size="sm" className="py-1">
            <ol className="flex flex-col divide-y px-(--card-spacing)">
              {round.matches.map((match) => (
                <MatchRow
                  key={match.id}
                  competitionId={competitionId}
                  scoring={scoring}
                  pairing={pairing}
                  scoreUnit={scoreUnit}
                  match={match}
                  a={byId.get(match.a)}
                  b={match.b ? byId.get(match.b) : undefined}
                  linked={linked}
                  now={now}
                  onRecord={setRecording}
                />
              ))}
            </ol>
          </Card>
        </section>
      ))}
      <LeagueResultForm
        open={recording !== null}
        onOpenChange={(open) => {
          if (!open) setRecording(null);
        }}
        competitionId={competitionId}
        match={recording}
        scoreDirection={scoreDirection}
        scoreUnit={scoreUnit}
      />
      <EditPairingsDialog
        competitionId={competitionId}
        pairing={pairing}
        entrants={entrants}
        rounds={rounds}
        editing={editing}
        nameOf={nameOf}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function MatchRow({
  competitionId,
  scoring,
  pairing,
  scoreUnit,
  match,
  a,
  b,
  linked,
  now,
  onRecord,
}: {
  competitionId: string;
  scoring: "team" | "individual";
  pairing: LeaguePairing;
  scoreUnit: string | null;
  match: LeagueMatchView;
  a: LeagueEntrantView | undefined;
  b: LeagueEntrantView | undefined;
  linked: Linked;
  now: Date;
  onRecord: (target: LeagueResultTarget) => void;
}) {
  const aName = a?.name ?? "Unknown";
  const bName = b?.name ?? "Unknown";
  const bye = match.b === null;
  const line = bye
    ? byeLine(aName, pairing)
    : matchLine({ aName, bName, result: match.result });
  const scores = scoresText({
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    unit: scoreUnit,
  });
  const summary = bye ? line : matchLine({ aName, bName, result: null });
  return (
    <li
      data-slot="league-match"
      data-you={match.yours || undefined}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2 ${match.yours ? "bg-primary/10" : ""}`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium break-words">{line}</span>
          {a ? (
            <LeagueYouMark entrant={a} scoring={scoring} linked={linked} />
          ) : null}
          {b ? (
            <LeagueYouMark entrant={b} scoring={scoring} linked={linked} />
          ) : null}
        </span>
        {scores ? (
          <span className="text-foreground/70 text-xs tabular-nums">
            {scores}
          </span>
        ) : null}
        {match.recordedAt ? (
          <span className="text-foreground/60 text-xs">
            Recorded <When at={match.recordedAt} now={now} />
          </span>
        ) : null}
      </span>
      {!bye && match.canRecord ? (
        <span className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
            aria-label={match.result ? `Edit result: ${summary}` : undefined}
            onClick={() =>
              onRecord({
                id: match.id,
                round: match.round,
                aName,
                bName,
                result: match.result,
                scoreA: match.scoreA,
                scoreB: match.scoreB,
              })
            }
          >
            {match.result ? "Edit" : "Record result"}
          </Button>
          {match.canClear ? (
            <ConfirmActionButton
              title="Clear this result?"
              description={`${line}. The standings update at once.`}
              confirmLabel="Clear"
              ariaLabel={`Clear result: ${summary}`}
              action={() => clearLeagueResult(competitionId, match.id)}
              successMessage="Result cleared"
              variant="outline"
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
            >
              Clear
            </ConfirmActionButton>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

/**
 * Edit pairings: two selects of the round's Entrants to swap. Before
 * saving, the repeats and (in a round robin) the pairs that would never
 * meet show as a warning, and saving then reads "Swap anyway".
 */
function EditPairingsDialog({
  competitionId,
  pairing,
  entrants,
  rounds,
  editing,
  nameOf,
  onClose,
}: {
  competitionId: string;
  pairing: LeaguePairing;
  entrants: LeagueEntrantView[];
  rounds: LeagueRoundView[];
  editing: LeagueRoundView | null;
  nameOf: (id: string) => string;
  onClose: () => void;
}) {
  return (
    <ResponsiveSheetDialog
      open={editing !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {editing ? (
        <EditPairingsBody
          key={editing.round}
          competitionId={competitionId}
          pairing={pairing}
          entrants={entrants}
          rounds={rounds}
          round={editing}
          nameOf={nameOf}
          onClose={onClose}
        />
      ) : null}
    </ResponsiveSheetDialog>
  );
}

function EditPairingsBody({
  competitionId,
  pairing,
  entrants,
  rounds,
  round,
  nameOf,
  onClose,
}: {
  competitionId: string;
  pairing: LeaguePairing;
  entrants: LeagueEntrantView[];
  rounds: LeagueRoundView[];
  round: LeagueRoundView;
  nameOf: (id: string) => string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const inRound = round.matches.flatMap((m) =>
    m.b === null ? [m.a] : [m.a, m.b],
  );
  const options = inRound.map((id) => ({ value: id, label: nameOf(id) }));
  // Nothing chosen reads as words, not the select's empty value.
  const choose = { value: "", label: "Choose an Entrant" };
  const lines =
    x && y && x !== y
      ? swapWarningLines(
          swapWarnings({
            entrantIds: entrants.map((e) => e.id),
            rounds: rounds.map((r) => ({
              round: r.round,
              matches: r.matches.map((m) => ({ a: m.a, b: m.b })),
            })),
            round: round.round,
            x,
            y,
            roundRobin: pairing === "round-robin",
          }),
          nameOf,
        )
      : [];

  function save() {
    startTransition(async () => {
      const saved = await swapPairing(competitionId, {
        round: round.round,
        x,
        y,
      });
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      toast.success("Pairings updated");
      onClose();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="flex flex-col gap-4"
    >
      <ResponsiveSheetDialogHeader>
        <ResponsiveSheetDialogTitle>Edit pairings</ResponsiveSheetDialogTitle>
        <ResponsiveSheetDialogDescription>
          Round {round.round}: choose two Entrants to swap places.
        </ResponsiveSheetDialogDescription>
      </ResponsiveSheetDialogHeader>
      <div className="flex flex-col gap-4 px-4">
        <Field>
          <FieldLabel htmlFor="swap-first">Swap</FieldLabel>
          <OptionSelect
            id="swap-first"
            aria-label="Swap"
            options={[choose, ...options.filter((o) => o.value !== y)]}
            value={x}
            onValueChange={setX}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="swap-second">With</FieldLabel>
          <OptionSelect
            id="swap-second"
            aria-label="With"
            options={[choose, ...options.filter((o) => o.value !== x)]}
            value={y}
            onValueChange={setY}
          />
        </Field>
        {lines.length > 0 ? (
          <div
            role="alert"
            data-slot="swap-warning"
            className="border-destructive/50 bg-destructive/5 flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm"
          >
            <span className="font-medium">Warning</span>
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        ) : null}
      </div>
      <ResponsiveSheetDialogFooter>
        <Button
          type="submit"
          size="lg"
          className="min-h-11"
          disabled={pending || !x || !y || x === y}
        >
          {pending
            ? "Saving…"
            : lines.length > 0
              ? "Swap anyway"
              : "Save pairings"}
        </Button>
      </ResponsiveSheetDialogFooter>
    </form>
  );
}
