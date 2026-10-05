"use client";

import { cn } from "cn";
import { useRouter } from "next/navigation";
import { type DragEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteCustomFinaleSlide,
  moveFinaleSlide,
  setFinaleSlideHidden,
} from "@/actions/finale-slides";
import type { ColorSwatch } from "@/components/color-field";
import { CustomFinaleSlideForm } from "@/components/custom-finale-slide-form";
import {
  MoveUpDownButtons,
  ROW_ACTION,
  SETUP_EDITOR,
  SetupAddButton,
  SetupListRow,
} from "@/components/setup-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SAVE_FAILED_ERROR } from "@/lib/autosave";
import type { FinaleSlideKind } from "@/lib/enums";
import { type FinaleSlideRef, finaleSlideRef } from "@/lib/finale-slides";
import type { WriteResult } from "@/lib/result";
import type { Content } from "@/lib/rich-text/content";

/** One row of the list, as the page passes it. */
export type FinaleSlideListItem = {
  key: string;
  id: string | null;
  kind: FinaleSlideKind;
  name: string;
  hidden: boolean;
  /** A Custom slide's body (already sanitized) and background. */
  body: Content | null;
  backgroundColor: string | null;
};

/**
 * The War Week's Finale slides in their Finale order. An Organizer hides or
 * shows each, moves it with Move up/down, or drags it to a new place (on a
 * pointer device; the buttons are the keyboard and touch way). Each change
 * saves at once.
 */
export function FinaleSlidesEditor({
  warWeekId,
  slides,
  themeSwatches,
}: {
  /** The War Week this page was rendered for; every change posts it. */
  warWeekId: string;
  slides: FinaleSlideListItem[];
  /** The theme's colors, as a Custom slide background's swatches. */
  themeSwatches: ColorSwatch[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  function run(action: () => Promise<WriteResult>) {
    startTransition(async () => {
      const result = await action().catch(() => ({
        ok: false as const,
        error: SAVE_FAILED_ERROR,
      }));
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  const move = (slide: FinaleSlideRef, toIndex: number) =>
    run(() => moveFinaleSlide(warWeekId, { slide, toIndex }));

  function dragProps(slide: FinaleSlideListItem, index: number) {
    const endDrag = () => {
      setDragging(null);
      setOver(null);
    };
    return {
      draggable: !pending,
      onDragStart: (event: DragEvent<HTMLLIElement>) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", slide.key);
        setDragging(slide.key);
      },
      onDragOver: (event: DragEvent<HTMLLIElement>) => {
        if (dragging === null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(slide.key);
      },
      onDragLeave: () => setOver((key) => (key === slide.key ? null : key)),
      onDrop: (event: DragEvent<HTMLLIElement>) => {
        event.preventDefault();
        const key = dragging ?? event.dataTransfer.getData("text/plain");
        const moving = slides.find((s) => s.key === key);
        endDrag();
        const ref = moving && finaleSlideRef(moving);
        if (ref && moving.key !== slide.key) move(ref, index);
      },
      onDragEnd: endDrag,
      className: cn(
        "cursor-grab",
        dragging === slide.key && "opacity-50",
        over === slide.key && dragging !== slide.key && "bg-muted",
      ),
    };
  }

  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-3">
      <ol aria-label="Finale slides">
        {slides.map((slide, index) => {
          const ref = finaleSlideRef(slide);
          const customId = slide.kind === "custom" ? slide.id : null;
          return (
            <SetupListRow
              key={slide.key}
              id={slide.key}
              label={slide.name}
              name={
                <span className="flex flex-wrap items-center gap-2">
                  {slide.name}
                  {slide.hidden ? (
                    <Badge variant="outline">Hidden</Badge>
                  ) : null}
                </span>
              }
              rowProps={{
                // e2e reads the list by these.
                ...{
                  "data-finale-slide-name": slide.name,
                  "data-finale-slide-hidden": slide.hidden ? "" : undefined,
                },
                ...dragProps(slide, index),
              }}
              form={
                customId
                  ? (close) => (
                      <CustomFinaleSlideForm
                        warWeekId={warWeekId}
                        slideId={customId}
                        initial={{
                          heading: slide.name,
                          body: slide.body ?? { type: "doc", content: [] },
                          backgroundColor: slide.backgroundColor,
                        }}
                        themeSwatches={themeSwatches}
                        onSaved={close}
                      />
                    )
                  : undefined
              }
              onDelete={
                customId ? () => deleteCustomFinaleSlide(customId) : undefined
              }
              deleteTitle={`Delete "${slide.name}"?`}
              deleteSuccess="Custom slide deleted"
              aside={
                ref ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className={ROW_ACTION}
                      disabled={pending}
                      aria-label={`${slide.hidden ? "Show" : "Hide"} "${slide.name}"`}
                      onClick={() =>
                        run(() =>
                          setFinaleSlideHidden(warWeekId, {
                            slide: ref,
                            hidden: !slide.hidden,
                          }),
                        )
                      }
                    >
                      {slide.hidden ? "Show" : "Hide"}
                    </Button>
                    <MoveUpDownButtons
                      label={slide.name}
                      first={index === 0}
                      last={index === slides.length - 1}
                      disabled={pending}
                      onMove={(direction) =>
                        move(ref, direction === "up" ? index - 1 : index + 1)
                      }
                    />
                  </>
                ) : null
              }
            />
          );
        })}
      </ol>
      <SetupAddButton
        label="Add Custom slide"
        form={(close) => (
          <CustomFinaleSlideForm
            warWeekId={warWeekId}
            themeSwatches={themeSwatches}
            onSaved={close}
          />
        )}
      />
    </div>
  );
}
