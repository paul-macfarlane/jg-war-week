"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  closeParticipation,
  markParticipant,
  reopenParticipation,
  unmarkParticipant,
} from "@/actions/participation";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { placementPointsList } from "@/lib/logged-results";
import { formatPoints } from "@/lib/points";

/** A Participant of the roster: id, shown name and Team (null for none). */
type RosterRow = { id: string; name: string; team: string | null };

/**
 * A `participation` Competition's run area on its Competition page (ADR
 * 0009): the roster as a checklist to tick who took part (each tick saves
 * at once), the team counts in team scoring, and Close / Reopen. Its
 * settings (points and Self check-in) are in the page's
 * Settings. Names, ids and booleans only: no email reaches it.
 */
export function ParticipationBuilder({
  competition,
  roster,
  tookPart,
  teamCounts,
  teamLabel,
}: {
  competition: {
    id: string;
    scoring: "team" | "individual";
    /** N, for an individual Competition; null for a team one. */
    participationPoints: number | null;
    /** The Placement Points, for a team Competition; null for an individual one. */
    placementPoints: number[] | null;
    closed: boolean;
  };
  roster: RosterRow[];
  /** Who took part, and whether they checked themselves in. */
  tookPart: { participantId: string; checkedIn: boolean }[];
  /** Team scoring only: each Team's headcount and place. */
  teamCounts: { teamId: string; name: string; count: number; place: number }[];
  teamLabel: string;
}) {
  const id = useId();
  const router = useRouter();
  const isTeam = competition.scoring === "team";
  const locked = competition.closed;

  // Each tick saves at once; until the page refreshes, the box shows it.
  const saved = new Map(tookPart.map((t) => [t.participantId, t.checkedIn]));
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const isMarked = (participantId: string) =>
    optimistic[participantId] ?? saved.has(participantId);
  function toggle(row: RosterRow, on: boolean) {
    setOptimistic((current) => ({ ...current, [row.id]: on }));
    startTransition(async () => {
      const action = on ? markParticipant : unmarkParticipant;
      const done = await action(competition.id, { participantId: row.id });
      if (done.ok) {
        toast.success(on ? `${row.name} took part` : `${row.name} removed`);
      } else {
        toast.error(done.error);
      }
      router.refresh();
      setOptimistic((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    });
  }

  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const shown = roster.filter(
    (row) =>
      !query ||
      row.name.toLowerCase().includes(query) ||
      row.team?.toLowerCase().includes(query),
  );
  const markedCount = roster.filter((row) => isMarked(row.id)).length;

  const closeDescription = !isTeam
    ? `Each Participant who took part gets ${formatPoints(competition.participationPoints ?? 0)} points, and check-ins stop.`
    : `${teamLabel}s ranked by headcount get Placement Points (${placementPointsList(
        competition.placementPoints,
      )}), and check-ins stop.`;

  return (
    <div className="flex flex-col gap-8">
      {locked && (
        <p className="border-border rounded-lg border px-3 py-2 text-sm">
          This Competition is closed. Reopen it to change who took part or its
          settings.
        </p>
      )}

      {/* The run area's own heading names this list ("Who took part"). */}
      <div className="flex flex-col gap-3">
        <p className="text-foreground/70 text-sm tabular-nums">
          {markedCount} of {roster.length}
        </p>
        <Input
          type="search"
          aria-label="Search the roster"
          placeholder="Search by name"
          className="h-11 sm:h-9 sm:max-w-xs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {shown.length === 0 ? (
          <p className="text-foreground/70 text-sm">
            {roster.length === 0
              ? "No Participants on the roster yet."
              : "No one matches."}
          </p>
        ) : (
          <ul className="grid gap-x-6 sm:grid-cols-2" aria-label="Roster">
            {shown.map((row) => {
              const checkedIn = saved.get(row.id) === true;
              const noTeam = isTeam && row.team === null;
              return (
                <li key={row.id}>
                  <Field
                    orientation="horizontal"
                    className="min-h-11 items-center sm:min-h-9"
                    data-disabled={locked || noTeam}
                  >
                    <Checkbox
                      id={`${id}-p-${row.id}`}
                      checked={isMarked(row.id)}
                      disabled={locked || noTeam}
                      onCheckedChange={(on) => toggle(row, on)}
                    />
                    <FieldLabel
                      htmlFor={`${id}-p-${row.id}`}
                      className="font-normal"
                    >
                      {row.name}
                      {row.team || checkedIn ? (
                        <span className="text-foreground/60 text-xs">
                          {[row.team, checkedIn && "checked in"]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </FieldLabel>
                  </Field>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isTeam && (
        <section
          className="flex flex-col gap-2"
          aria-label={`${teamLabel} counts`}
        >
          <h2 className="text-lg font-semibold">{teamLabel} counts</h2>
          {teamCounts.length === 0 ? (
            <p className="text-foreground/70 text-sm">No one yet.</p>
          ) : (
            <ol className="flex flex-col gap-1 text-sm">
              {teamCounts.map((row) => (
                <li key={row.teamId} className="flex gap-2 tabular-nums">
                  <span className="text-foreground/60 w-6">{row.place}</span>
                  <span className="font-medium">{row.name}</span>
                  <span>{row.count}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {competition.closed ? (
          <>
            <p className="text-foreground/70 text-sm">
              Closed: its Points Entries are in the Standings. Reopen to change
              who took part.
            </p>
            <ConfirmActionButton
              title="Reopen this Competition?"
              description="The generated Points Entries are withdrawn."
              confirmLabel="Reopen"
              action={() => reopenParticipation(competition.id)}
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
            description={closeDescription}
            confirmLabel="Close"
            action={() => closeParticipation(competition.id)}
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
