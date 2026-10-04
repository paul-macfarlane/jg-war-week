"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { setFinaleAwardsLayout } from "@/actions/finale-slides";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SAVE_FAILED_ERROR } from "@/lib/autosave";
import { FINALE_AWARDS_LAYOUTS, type FinaleAwardsLayout } from "@/lib/enums";

const LABELS: Record<FinaleAwardsLayout, string> = {
  "one-slide": "All on one slide",
  "per-category": "One slide per Category",
};

/**
 * How the Finale shows Awards: every Award on one slide, or one slide per
 * Award Category. An Organizer's choice saves at once (a refusal shows as
 * a toast and the choice goes back); a Host sees it, disabled.
 */
export function FinaleAwardsLayoutControl({
  warWeekId,
  layout,
  canEdit,
}: {
  warWeekId: string;
  layout: FinaleAwardsLayout;
  /** Organizers only. */
  canEdit: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [value, setValue] = useState(layout);
  const [pending, startTransition] = useTransition();

  function choose(next: FinaleAwardsLayout) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await setFinaleAwardsLayout(warWeekId, next).catch(() => ({
        ok: false as const,
        error: SAVE_FAILED_ERROR,
      }));
      if (!result.ok) {
        toast.error(result.error);
        setValue(previous);
      }
      router.refresh();
    });
  }

  return (
    <Field>
      <FieldLabel id={`${id}-label`}>Awards layout</FieldLabel>
      <ToggleGroup
        aria-labelledby={`${id}-label`}
        value={[value]}
        onValueChange={(chosen) => {
          // A choice can't be deselected.
          const [next] = chosen as FinaleAwardsLayout[];
          if (next && next !== value) choose(next);
        }}
        disabled={!canEdit || pending}
        variant="outline"
        className="grid w-full grid-cols-1 gap-2 sm:max-w-md sm:grid-cols-2"
      >
        {FINALE_AWARDS_LAYOUTS.map((option) => (
          <ToggleGroupItem
            key={option}
            value={option}
            className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/80 h-auto min-h-11 py-2 whitespace-normal sm:min-h-9"
          >
            {LABELS[option]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <FieldDescription>
        {value === "one-slide"
          ? "One Awards slide shows every Award, grouped by Category, one at a time."
          : "Each Award Category gets its own slide, its Awards shown one at a time."}
        {canEdit ? null : " Only an Organizer can change it."}
      </FieldDescription>
    </Field>
  );
}
