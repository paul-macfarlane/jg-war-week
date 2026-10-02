"use client";

import { Medal } from "lucide-react";
import { useEffect, useRef } from "react";

import { Avatar } from "@/components/avatar";
import type { FinaleAward } from "@/lib/finale-slides";

import { SlideEyebrow } from "./slide-eyebrow";
import type { FinaleSlideProps } from "./types";

/**
 * An Awards slide: the War Week's Awards, grouped by Award Category (the
 * uncategorized last as "Other Awards"), one Award revealed per step. In
 * the per-Category layout each slide holds one Category's Awards under its
 * name. Each newly revealed Award scrolls into view if the slide is full.
 */
export function AwardsSlide({
  data,
  step,
  final,
  edition,
  storyTheme,
}: FinaleSlideProps<"awards">) {
  const total = data.groups.reduce((sum, g) => sum + g.awards.length, 0);
  const shown = final ? total : Math.min(step, total);
  const latest = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (shown === 0 || final) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    latest.current?.scrollIntoView({
      block: "nearest",
      behavior: reduce.matches ? "auto" : "smooth",
    });
  }, [shown, final]);

  // Where each group's Awards start in the reveal order.
  const starts = data.groups.map((_, g) =>
    data.groups
      .slice(0, g)
      .reduce((sum, group) => sum + group.awards.length, 0),
  );
  return (
    <div className="flex h-full w-full flex-col items-center justify-center-safe gap-[4vh] overflow-y-auto px-[5vw] py-[7vh]">
      <header className="flex flex-col items-center gap-[1.5vh] text-center">
        <SlideEyebrow edition={edition} storyTheme={storyTheme} />
        <h1 className="text-[clamp(2.25rem,5.5vw,5.5rem)] leading-tight font-bold tracking-tight">
          {data.heading}
        </h1>
      </header>
      {/* Groups flow side by side, each its heading over its cards, so a
          War Week's Awards fit the projector; past that the slide scrolls. */}
      <div className="flex w-full max-w-[min(116rem,94vw)] flex-wrap items-start justify-center gap-x-[3vw] gap-y-[4vh]">
        {data.groups.map((group, g) => {
          const first = starts[g];
          if (first >= shown) return null;
          const revealed = group.awards.slice(0, shown - first);
          return (
            <section
              key={group.key}
              className="flex w-full flex-col gap-[2vh] sm:w-auto"
            >
              {group.name ? (
                <h2 className="text-primary-text text-[clamp(1.25rem,2.2vw,2.5rem)] font-bold">
                  {group.name}
                </h2>
              ) : null}
              <ul className="flex flex-wrap gap-[1.5vw]">
                {revealed.map((award, i) => (
                  <li
                    key={award.id}
                    ref={first + i === shown - 1 ? latest : undefined}
                    className="animate-in fade-in zoom-in-95 w-full duration-500 motion-reduce:animate-none sm:w-[clamp(16rem,26vw,30rem)]"
                  >
                    <AwardCard award={award} primaryColor={data.primaryColor} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AwardCard({
  award,
  primaryColor,
}: {
  award: FinaleAward;
  primaryColor: string;
}) {
  return (
    <div className="bg-card text-card-foreground ring-foreground/10 flex h-full flex-col gap-[1vh] rounded-2xl p-[clamp(1rem,1.4vw,1.75rem)] ring-1">
      <h3 className="flex items-center gap-3 text-[clamp(1.375rem,2vw,2.25rem)] leading-tight font-bold">
        <Medal aria-hidden className="text-primary-text size-[1em] shrink-0" />
        {award.name}
      </h3>
      {award.team ? (
        <p className="flex items-center gap-3 text-[clamp(1.0625rem,1.45vw,1.625rem)] font-semibold">
          <span
            aria-hidden
            className="size-[0.7em] shrink-0 rounded-full"
            style={{ backgroundColor: award.team.color }}
          />
          {award.team.name}
        </p>
      ) : null}
      {award.participants.length > 0 ? (
        <ul className="flex flex-col gap-[0.8vh]">
          {award.participants.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 text-[clamp(1.0625rem,1.45vw,1.625rem)] font-semibold"
            >
              <Avatar
                name={p.displayName}
                teamColor={p.teamColor}
                primaryColor={primaryColor}
                image={p.image}
                className="size-[1.5em]"
              />
              {p.displayName}
            </li>
          ))}
        </ul>
      ) : null}
      {award.description ? (
        <p className="text-foreground/75 text-[clamp(0.9375rem,1.1vw,1.25rem)]">
          {award.description}
        </p>
      ) : null}
    </div>
  );
}
