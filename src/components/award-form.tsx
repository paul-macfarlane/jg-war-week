"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type AwardActionResult,
  createAward,
  updateAward,
} from "@/actions/awards";
import { EntityCombobox } from "@/components/entity-combobox";
import { FormValueInput } from "@/components/form-value-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AWARD_DESCRIPTION_MAX,
  AWARD_NAME_MAX,
  type AwardInput,
} from "@/lib/awards";
import type { AwardFormOptions } from "@/queries/awards";

/** Base UI's Select won't accept `""` as an item value. */
const NO_TEAM = "none";

/**
 * Give or edit one Award: name, description, and its recipients — one Team,
 * any number of Participants, or both. The server action checks the
 * recipients belong to this War Week; its error is what's shown.
 */
export function AwardForm({
  warWeekId,
  awardId,
  initial,
  options,
  teamLabel,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  /** Set when editing an existing Award. */
  awardId?: string;
  initial?: AwardInput;
  options: AwardFormOptions;
  /** The War Week's Team Label, e.g. "House". */
  teamLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [teamId, setTeamId] = useState(initial?.teamId ?? "");
  const [participantIds, setParticipantIds] = useState<string[]>(
    initial?.participantIds ?? [],
  );
  const [result, setResult] = useState<AwardActionResult | null>(null);

  // Also lets SelectValue show the Team's name rather than its id.
  const teamItems = [
    { value: NO_TEAM, label: `No ${teamLabel}` },
    ...options.teams.map((team) => ({ value: team.id, label: team.name })),
  ];
  const participantItems = options.participants.map((p) => ({
    id: p.id,
    label: p.name,
    detail: p.team ?? undefined,
  }));

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      name,
      description,
      teamId: teamId || null,
      participantIds,
    };
    startTransition(async () => {
      const saved = awardId
        ? await updateAward(awardId, input)
        : await createAward(warWeekId, input);
      setResult(saved);
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      toast.success("Award saved");
      router.push("/admin/awards");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-label="Award">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="award-name">Name</FieldLabel>
          <Input
            id="award-name"
            name="name"
            required
            maxLength={AWARD_NAME_MAX}
            className="h-11 sm:h-9"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="award-description">Description</FieldLabel>
          <Textarea
            id="award-description"
            name="description"
            rows={3}
            maxLength={AWARD_DESCRIPTION_MAX}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <FieldSet>
          <FieldLegend variant="label">Recipients</FieldLegend>
          <FieldDescription>
            A {teamLabel}, Participants, or both. Awards don&apos;t affect the
            Standings.
          </FieldDescription>

          <FieldGroup>
            {options.teams.length > 0 && (
              <Field>
                <FieldLabel htmlFor="award-team">{teamLabel}</FieldLabel>
                <Select
                  value={teamId === "" ? NO_TEAM : teamId}
                  items={teamItems}
                  onValueChange={(value) =>
                    setTeamId(!value || value === NO_TEAM ? "" : value)
                  }
                >
                  <SelectTrigger id="award-team" className="h-11 w-full sm:h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {teamItems.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                        className="min-h-11 sm:min-h-8"
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* "" posts as no Team. */}
                <FormValueInput name="teamId" value={teamId} />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="award-participants">
                Participants ({participantIds.length} chosen)
              </FieldLabel>
              <EntityCombobox
                id="award-participants"
                multiple
                name="participantIds"
                items={participantItems}
                value={participantIds}
                onValueChange={setParticipantIds}
                placeholder={`Find by name or ${teamLabel}`}
                aria-label="Find Participants"
              />
            </Field>
          </FieldGroup>
        </FieldSet>
      </FieldGroup>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          size="lg"
          className="min-h-11 sm:min-h-9"
          disabled={pending}
        >
          {pending ? "Saving…" : awardId ? "Save changes" : "Give Award"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11 sm:min-h-9"
          onClick={() => router.push("/admin/awards")}
        >
          Cancel
        </Button>
      </div>
      {result && !result.ok && !pending && (
        <FieldError>{result.error}</FieldError>
      )}
    </form>
  );
}
