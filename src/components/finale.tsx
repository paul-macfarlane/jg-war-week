"use client";

import Link from "next/link";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { FinaleSlideView } from "@/components/finale-slides";
import {
  type FinalePosition,
  type FinaleSlideData,
  backFinalePosition,
  completeFinaleSlide,
  finaleSlideSteps,
  nextFinalePosition,
} from "@/lib/finale-slides";

/** Controls that handle their own clicks and `Space`: never "next". */
const INTERACTIVE =
  "a, button, input, select, textarea, summary, video, audio, label, [role='button'], [contenteditable='true']";

/** Where typing happens: no slideshow key works there. */
const TYPING = "input, textarea, select, [contenteditable='true']";

/** A visit: the position, plus a count bumped on every arrival on a slide. */
type Visit = FinalePosition & { arrival: number };

const noSubscription = () => () => {};

/**
 * The Finale (`/<edition>/finale`): the closing-ceremony slideshow for the
 * projector. One slide fills the screen at a time, over the edition's
 * navigation. `→`, `Space`, `PageDown` or a click on the stage shows the
 * slide's next step, else the next slide; `←`/`PageUp` goes back (the
 * previous slide in its final state); `Escape` returns to the first slide.
 * Nothing auto-advances. See CONTEXT.md, "Finale rules".
 */
export function FinaleSlideshow({
  slides,
  edition,
  storyTheme,
  isOrganizer,
}: {
  /** The visible slides, in order, each with its data. */
  slides: FinaleSlideData[];
  edition: string;
  storyTheme: string;
  /** Offers "Set up the Finale" when there's nothing to show. */
  isOrganizer: boolean;
}) {
  const steps = useMemo(() => slides.map(finaleSlideSteps), [slides]);
  const [visit, setVisit] = useState<Visit>({ index: 0, step: 0, arrival: 0 });
  // True once hydrated: the keys work from then on (a hook for e2e).
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  const go = useCallback(
    (to: (position: FinalePosition) => FinalePosition) =>
      setVisit((current) => {
        const next = to(current);
        if (next.index === current.index && next.step === current.step) {
          return current;
        }
        return {
          ...next,
          arrival:
            next.index === current.index
              ? current.arrival
              : current.arrival + 1,
        };
      }),
    [],
  );
  const next = useCallback(
    () => go((p) => nextFinalePosition(p, steps)),
    [go, steps],
  );
  const back = useCallback(
    () => go((p) => backFinalePosition(p, steps)),
    [go, steps],
  );
  const first = useCallback(
    () =>
      setVisit((current) => ({
        index: 0,
        step: 0,
        arrival: current.arrival + 1,
      })),
    [],
  );
  const index = visit.index;
  const complete = useCallback(
    () =>
      setVisit((current) => ({
        ...current,
        ...completeFinaleSlide(current, index, steps),
      })),
    [index, steps],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(TYPING)) return;
      switch (event.key) {
        case "ArrowRight":
        case "PageDown":
          next();
          break;
        case "ArrowLeft":
        case "PageUp":
          back();
          break;
        case "Escape":
          first();
          break;
        case " ":
          // A focused button or link handles its own Space press.
          if (target?.closest(INTERACTIVE)) return;
          next();
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, first]);

  const onStageClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(INTERACTIVE)) return;
    next();
  };

  const slide = slides[index];

  return (
    <div
      data-finale-slide={slide?.kind}
      data-finale-slide-index={slide ? index : undefined}
      data-finale-step={slide ? visit.step : undefined}
      data-finale-hydrated={hydrated ? "" : undefined}
      className="bg-background text-foreground fixed inset-0 z-[60] cursor-default overflow-hidden"
      onClick={slide ? onStageClick : undefined}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_60%)]"
      />
      <Link
        href={`/${edition}`}
        className="text-foreground/60 hover:text-foreground absolute top-3 right-4 z-10 rounded px-2 py-1 text-sm underline-offset-4 hover:underline"
      >
        Exit
      </Link>
      {slide ? (
        <>
          <section aria-label={slide.name} className="relative h-full w-full">
            <FinaleSlideView
              key={`${slide.key}:${visit.arrival}`}
              data={slide}
              step={visit.step}
              final={visit.step >= steps[index]}
              complete={complete}
              edition={edition}
              storyTheme={storyTheme}
            />
          </section>
          <p aria-live="polite" className="sr-only">
            Slide {index + 1} of {slides.length}: {slide.name}
          </p>
          {index === 0 ? (
            <p className="text-foreground/60 pointer-events-none absolute inset-x-0 bottom-[4vh] text-center text-sm">
              → next · ← back
            </p>
          ) : null}
        </>
      ) : (
        <div className="relative flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-[clamp(1.5rem,3vw,2.5rem)] font-semibold">
            Nothing to show yet.
          </p>
          {isOrganizer ? (
            <Link
              href="/admin/finale"
              className="text-primary underline underline-offset-4"
            >
              Set up the Finale
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
