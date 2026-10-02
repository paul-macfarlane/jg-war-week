"use client";

import { useRouter } from "next/navigation";
import { type DragEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { moveFinaleSlide, setFinaleSlideHidden } from "@/actions/finale-slides";
import { SETUP_EDITOR, SetupListRow } from "@/components/setup-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FinaleSlideKind } from "@/lib/enums";
import { type FinaleSlideRef, finaleSlideRef } from "@/lib/finale-slides";
import type { WriteResult } from "@/lib/result";

/** One row of the list, as the page passes it. */
export type FinaleSlideListItem = {
  key: string;
  id: string | null;
  kind: FinaleSlideKind;
  name: string;
  hidden: boolean;
};

const ROW_ACTION = "min-h-11 min-w-11 sm:min-h-8";

/**
 * The War Week's Finale slides in their Finale order. An Organizer hides or
 * shows each, moves it with Move up/down, or drags it to a new place (on a
 * pointer device; the buttons are the keyboard and touch way). Each change
 * saves at once. A Host sees the list without controls.
 */
export function FinaleSlidesEditor({
  warWeekId,
  slides,
  canEdit,
}: {
  /** The War Week this page was rendered for; every change posts it. */
  warWeekId: string;
  slides: FinaleSlideListItem[];
  /** Organizers only: the controls and the drag. */
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  function run(action: () => Promise<WriteResult>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  const move = (slide: FinaleSlideRef, toIndex: number) =>
    run(() => moveFinaleSlide(warWeekId, { slide, toIndex }));

  function dragProps(slide: FinaleSlideListItem, index: number) {
    if (!canEdit) return undefined;
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
        if (moving && moving.key !== slide.key) {
          move(finaleSlideRef(moving), index);
        }
      },
      onDragEnd: endDrag,
      className: [
        "cursor-grab",
        dragging === slide.key ? "opacity-50" : "",
        over === slide.key && dragging !== slide.key ? "bg-muted" : "",
      ].join(" "),
    };
  }

  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-3">
      <ol aria-label="Finale slides">
        {slides.map((slide, index) => (
          <SetupListRow
            key={slide.key}
            id={slide.key}
            label={slide.name}
            name={
              <span className="flex flex-wrap items-center gap-2">
                {slide.name}
                {slide.hidden ? <Badge variant="outline">Hidden</Badge> : null}
              </span>
            }
            rowProps={dragProps(slide, index)}
            aside={
              canEdit ? (
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
                          slide: finaleSlideRef(slide),
                          hidden: !slide.hidden,
                        }),
                      )
                    }
                  >
                    {slide.hidden ? "Show" : "Hide"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={ROW_ACTION}
                    disabled={pending || index === 0}
                    aria-label={`Move "${slide.name}" up`}
                    onClick={() => move(finaleSlideRef(slide), index - 1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={ROW_ACTION}
                    disabled={pending || index === slides.length - 1}
                    aria-label={`Move "${slide.name}" down`}
                    onClick={() => move(finaleSlideRef(slide), index + 1)}
                  >
                    ↓
                  </Button>
                </>
              ) : null
            }
          />
        ))}
      </ol>
    </div>
  );
}
