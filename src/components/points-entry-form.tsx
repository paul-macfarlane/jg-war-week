"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type PointsEntryActionResult,
  createPointsEntry,
  updatePointsEntry,
} from "@/actions/points-entries";
import { EntityCombobox } from "@/components/entity-combobox";
import {
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { WarWeek } from "@/db/schema";
import {
  formatMaxPoints,
  placementLabel,
  pointsForPlacement,
} from "@/lib/competitions";
import { formatPoints } from "@/lib/points";
import { overMaxWarning } from "@/lib/points-entry";
import type { PointsEntryFormOptions } from "@/queries/points-entries";

type Initial = {
  competitionId: string;
  targetId: string;
  points: string;
  note: string;
};

/**
 * Add or edit one Points Entry. The target list follows the chosen
 * Competition's scoring: Teams for team Competitions, Participants for
 * individual ones. After adding, the Competition stays selected so the next
 * result can be entered straight away.
 */
export function PointsEntryForm({
  options,
  teamLabel,
  mode,
  entryId,
  initial,
}: {
  options: PointsEntryFormOptions;
  teamLabel: string;
  /** The War Week's Mode: a free-for-all has no Teams to ask about. */
  mode: WarWeek["mode"];
  /** Set when editing an existing entry. */
  entryId?: string;
  initial?: Initial;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [competitionId, setCompetitionId] = useState(
    initial?.competitionId ?? "",
  );
  const [targetId, setTargetId] = useState(initial?.targetId ?? "");
  const [points, setPoints] = useState(initial?.points ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  // Validation runs on the server; a refusal names its fields.
  const [result, formAction, pending] = useActionState(
    async (
      _previous: PointsEntryActionResult | null,
      formData: FormData,
    ): Promise<PointsEntryActionResult> => {
      const input = {
        competitionId: String(formData.get("competitionId") ?? ""),
        targetId: String(formData.get("targetId") ?? ""),
        points: String(formData.get("points") ?? ""),
        note: String(formData.get("note") ?? ""),
      };
      const saved = entryId
        ? await updatePointsEntry(entryId, input)
        : await createPointsEntry(input);
      if (!saved.ok) {
        toast.error(saved.error);
        return saved;
      }
      toast.success("Points Entry saved");
      if (entryId) {
        router.push("/admin/points");
      } else {
        setTargetId("");
        setPoints("");
        setNote("");
      }
      router.refresh();
      return saved;
    },
    null,
  );
  // Choosing another Competition clears the last refusal.
  const [dismissed, setDismissed] = useState<PointsEntryActionResult | null>(
    null,
  );
  const shown = result === dismissed ? null : result;
  const fieldErrors = fieldErrorsOf(shown);
  const formError = formErrorOf(shown);
  useFocusFirstInvalid(formRef, result);

  const competition = options.competitions.find((c) => c.id === competitionId);
  const targets =
    competition?.scoring === "team"
      ? options.teams
      : competition?.scoring === "individual"
        ? options.participants
        : [];
  // Before a Competition is chosen, a free-for-all War Week can only mean a
  // Participant; after, the Competition's scoring decides.
  const targetLabel = competition
    ? competition.scoring === "individual"
      ? "Participant"
      : teamLabel
    : mode === "free-for-all"
      ? "Participant"
      : teamLabel;
  const places = (competition?.placementPoints ?? []).map((_, i) => i + 1);
  const warning = competition
    ? overMaxWarning(
        points.trim() === "" ? NaN : Number(points),
        competition.maxPoints,
      )
    : null;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4"
      aria-label="Points Entry"
    >
      <FieldGroup>
        <Field data-invalid={!!fieldErrors.competitionId}>
          <FieldLabel htmlFor="points-entry-competition">
            Competition
          </FieldLabel>
          <EntityCombobox
            id="points-entry-competition"
            name="competitionId"
            aria-label="Competition"
            aria-invalid={!!fieldErrors.competitionId}
            required
            placeholder="Choose a Competition…"
            items={options.competitions.map((c) => ({
              id: c.id,
              label: c.name,
              detail: `${c.scoring === "team" ? teamLabel : "Individual"} · ${formatMaxPoints(c.maxPoints)}`,
            }))}
            value={competitionId}
            onValueChange={(id) => {
              setCompetitionId(id);
              setTargetId("");
              setDismissed(result);
            }}
          />
          <FieldError>{fieldErrors.competitionId}</FieldError>
        </Field>

        <Field data-invalid={!!fieldErrors.targetId}>
          <FieldLabel htmlFor="points-entry-target">{targetLabel}</FieldLabel>
          <EntityCombobox
            id="points-entry-target"
            name="targetId"
            aria-label={targetLabel}
            aria-invalid={!!fieldErrors.targetId}
            required
            disabled={!competition}
            placeholder={
              competition
                ? competition.scoring === "team"
                  ? `Choose a ${teamLabel}…`
                  : "Choose a Participant…"
                : "Choose a Competition first"
            }
            items={targets.map((t) => ({
              id: t.id,
              label: t.name,
              detail: t.team ?? undefined,
            }))}
            value={targetId}
            onValueChange={setTargetId}
          />
          <FieldError>{fieldErrors.targetId}</FieldError>
        </Field>

        <Field data-invalid={!!fieldErrors.points}>
          <FieldLabel htmlFor="points-entry-points">Points</FieldLabel>
          <Input
            id="points-entry-points"
            name="points"
            required
            // Text, not number: React's post-action form reset blanks a
            // focused number input. The server validates the number.
            inputMode="decimal"
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.points}
            value={points}
            onChange={(event) => setPoints(event.target.value)}
          />
          {warning && (
            <FieldDescription
              role="status"
              className="text-warning font-medium"
            >
              ⚠️ {warning}
            </FieldDescription>
          )}
          <FieldError>{fieldErrors.points}</FieldError>
        </Field>
        {competition && places.length > 0 && (
          <div
            role="group"
            aria-label="Placement Points"
            className="-mt-2 flex flex-wrap gap-2"
          >
            {places.map((place) => {
              const preset = pointsForPlacement(competition, place)!;
              return (
                <Button
                  key={place}
                  type="button"
                  variant="outline"
                  onClick={() => setPoints(String(preset))}
                >
                  {`${placementLabel(place)} · ${formatPoints(preset)}`}
                </Button>
              );
            })}
          </div>
        )}

        <Field data-invalid={!!fieldErrors.note}>
          <FieldLabel htmlFor="points-entry-note">Note (optional)</FieldLabel>
          <Input
            id="points-entry-note"
            name="note"
            maxLength={500}
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.note}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <FieldError>{fieldErrors.note}</FieldError>
        </Field>
      </FieldGroup>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          size="lg"
          className="min-h-11 sm:min-h-9"
          disabled={pending}
        >
          {pending ? "Saving…" : entryId ? "Save changes" : "Add Points Entry"}
        </Button>
        {entryId && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11 sm:min-h-9"
            onClick={() => router.push("/admin/points")}
          >
            Cancel
          </Button>
        )}
      </div>
      {formError && !pending && <FieldError>{formError}</FieldError>}
    </form>
  );
}
