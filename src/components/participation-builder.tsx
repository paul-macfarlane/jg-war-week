"use client";

import { useRouter } from "next/navigation";
import { useActionState, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  closeParticipation,
  markParticipant,
  reopenParticipation,
  setParticipationSettings,
  unmarkParticipant,
} from "@/actions/participation";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import { DatePicker } from "@/components/date-picker";
import { fieldErrorsOf, formErrorOf } from "@/components/form-field-errors";
import { PlacementPointsRows } from "@/components/placement-points-rows";
import { TimeCombobox } from "@/components/time-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { placementPointsList } from "@/lib/games/view";
import { formatPoints } from "@/lib/points";
import { fromEasternClock, toEasternClock } from "@/lib/schedule";
import type { MutationResult } from "@/mutations/types";

/** A Participant of the roster: id, shown name and Team (null for none). */
type RosterRow = { id: string; name: string; team: string | null };

type SettingsFields = {
  participationPoints: string;
  placementPoints: string;
  selfCheckIn: boolean;
  closesDate: string;
  closesTime: string;
};

function clockOf(date: Date | null): { date: string; time: string } {
  if (!date) return { date: "", time: "" };
  const clock = toEasternClock(date);
  return { date: clock.date, time: clock.time.slice(0, 5) };
}

/**
 * A `participation` Competition's setup (ADR 0009): its scoring settings
 * and Self check-in, the roster as a checklist to tick who took part (each
 * tick saves at once), the team counts in team scoring, and Close /
 * Reopen. Names, ids and booleans only: no email reaches it.
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
    name: string;
    scoring: "team" | "individual";
    /** N, for an individual Competition; null for a team one. */
    participationPoints: number | null;
    /** The Placement Points, for a team Competition; null for an individual one. */
    placementPoints: number[] | null;
    selfCheckIn: boolean;
    checkInClosesAt: Date | null;
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

  const closes = clockOf(competition.checkInClosesAt);
  const [fields, setFields] = useState<SettingsFields>({
    participationPoints:
      competition.participationPoints === null
        ? ""
        : formatPoints(competition.participationPoints),
    placementPoints: competition.placementPoints?.join(", ") ?? "",
    selfCheckIn: competition.selfCheckIn,
    closesDate: closes.date,
    closesTime: closes.time,
  });
  function set<K extends keyof SettingsFields>(
    key: K,
    value: SettingsFields[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }
  const [result, formAction, saving] = useActionState(
    async (): Promise<MutationResult> => {
      const closesAt = fromEasternClock(fields.closesDate, fields.closesTime);
      const saved = await setParticipationSettings(competition.id, {
        // An individual Competition gives N each; a team one ranks Teams
        // by headcount for its Placement Points.
        participationPoints: isTeam ? "" : fields.participationPoints,
        placementPoints: isTeam ? fields.placementPoints : "",
        selfCheckIn: fields.selfCheckIn,
        checkInClosesAt: closesAt ? closesAt.toISOString() : null,
      });
      if (saved.ok) {
        toast.success("Participation settings saved");
        router.refresh();
      } else {
        toast.error(saved.error);
      }
      return saved;
    },
    null,
  );
  const fieldErrors = fieldErrorsOf(result);
  const formError = formErrorOf(result);

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

  const scoringLine = isTeam
    ? `${teamLabel} · Ranked by headcount`
    : "Individual";
  const closeDescription = !isTeam
    ? `Each Participant who took part gets ${formatPoints(competition.participationPoints ?? 0)} points, and check-ins stop.`
    : `${teamLabel}s ranked by headcount get Placement Points (${placementPointsList(
        competition.placementPoints,
      )}), and check-ins stop.`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{competition.name}</h1>
        <p className="text-foreground/70 text-sm">
          Participation · {scoringLine}
        </p>
      </div>

      {locked && (
        <p className="border-border rounded-lg border px-3 py-2 text-sm">
          This Competition is closed. Reopen it to change who took part or its
          settings.
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-6">
        <FieldSet>
          <FieldLegend>Settings</FieldLegend>
          <FieldGroup className="gap-4">
            {!isTeam && (
              <Field
                className="sm:max-w-48"
                data-invalid={!!fieldErrors.participationPoints}
              >
                <FieldLabel htmlFor={`${id}-points`}>
                  Points per Participant
                </FieldLabel>
                <Input
                  id={`${id}-points`}
                  inputMode="decimal"
                  className="h-11 sm:h-9"
                  disabled={saving || locked}
                  aria-invalid={!!fieldErrors.participationPoints}
                  value={fields.participationPoints}
                  onChange={(event) =>
                    set("participationPoints", event.target.value)
                  }
                />
                <FieldError>{fieldErrors.participationPoints}</FieldError>
              </Field>
            )}
            {isTeam && (
              <Field
                className="sm:max-w-md"
                data-invalid={!!fieldErrors.placementPoints}
              >
                <PlacementPointsRows
                  value={fields.placementPoints}
                  invalid={!!fieldErrors.placementPoints}
                  onChange={(value) => set("placementPoints", value)}
                />
                <FieldDescription>
                  {teamLabel}s are ranked by how many of their Participants took
                  part; ties share the higher place.
                </FieldDescription>
                <FieldError>{fieldErrors.placementPoints}</FieldError>
              </Field>
            )}
          </FieldGroup>
        </FieldSet>

        <Field orientation="horizontal" className="max-w-xl">
          <Switch
            id={`${id}-self-check-in`}
            checked={fields.selfCheckIn}
            disabled={saving || locked}
            onCheckedChange={(on) => set("selfCheckIn", on)}
          />
          <FieldContent>
            <FieldLabel htmlFor={`${id}-self-check-in`}>
              Participants can check in
            </FieldLabel>
            <FieldDescription>
              Participants check themselves in, or out again, from this
              Competition&apos;s page until the close time or until you close
              it. You can tick or untick anyone.
            </FieldDescription>
          </FieldContent>
        </Field>
        {fields.selfCheckIn && (
          <FieldGroup className="gap-4 sm:flex-row">
            <Field className="sm:max-w-48">
              <FieldLabel htmlFor={`${id}-closes-date`}>
                Check-in closes
              </FieldLabel>
              <DatePicker
                id={`${id}-closes-date`}
                name="checkInClosesDate"
                value={fields.closesDate}
                onValueChange={(value) => set("closesDate", value)}
              />
            </Field>
            <Field className="sm:max-w-40">
              <FieldLabel htmlFor={`${id}-closes-time`}>Time (ET)</FieldLabel>
              <TimeCombobox
                id={`${id}-closes-time`}
                name="checkInClosesTime"
                value={fields.closesTime}
                onValueChange={(value) => set("closesTime", value)}
              />
            </Field>
          </FieldGroup>
        )}

        {formError && <FieldError>{formError}</FieldError>}
        <Button
          type="submit"
          size="lg"
          className="min-h-11 w-fit"
          disabled={saving || locked}
        >
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </form>

      <section
        className="flex flex-col gap-3"
        aria-labelledby={`${id}-took-part`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`${id}-took-part`} className="text-lg font-semibold">
            Who took part
          </h2>
          <span className="text-foreground/70 text-sm tabular-nums">
            {markedCount} of {roster.length}
          </span>
        </div>
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
      </section>

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
              Closed: its Points Entries are in the ledger. Reopen to change who
              took part.
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
