"use client";

import { useEffect, useState } from "react";

import {
  IndividualStandingsList,
  TeamStandingsList,
} from "@/components/standings";
import { Button } from "@/components/ui/button";
import { useFinale } from "@/components/use-finale";
import { finaleTopRows } from "@/lib/finale";

import { SlideEyebrow } from "./slide-eyebrow";
import type { FinaleSlideProps } from "./types";

/**
 * The Standings countdown slide: the main leaderboard (team Standings in
 * `teams` mode, individual Standings in free-for-all) counting in from last
 * place to first. Arriving by Next plays it (the presenter's deliberate
 * start); Next while it plays jumps to the final state; arriving by Back
 * shows the final state. Replay plays it again. Shows `standings` exactly
 * as given and never reorders or recomputes them (CONTEXT.md, "Finale
 * rules").
 */
export function StandingsSlide({
  data,
  final,
  complete,
  edition,
  storyTheme,
}: FinaleSlideProps<"standings">) {
  const { standings, teamLabel, primaryColor } = data;
  const main = standings.main;
  // Only the top 10 (ties included) count down; the rest are one line.
  const [top] = useState(() =>
    main === "team"
      ? finaleTopRows(standings.team)
      : finaleTopRows(standings.individual),
  );
  const [ranks] = useState(() => top.shown.map((row) => row.rank));
  const noun = main === "team" ? teamLabel : "Participant";
  const moreLine = `\u2026and ${top.moreCount} more ${noun}${top.moreCount === 1 ? "" : "s"} scored`;
  const { phase, start, finish, rows, startedAt } = useFinale(
    ranks,
    final ? "done" : "playing",
  );

  useEffect(() => {
    if (final) finish();
  }, [final, finish]);

  useEffect(() => {
    if (phase === "done") complete();
  }, [phase, complete]);

  const title = main === "team" ? `${teamLabel} standings` : "Standings";

  return (
    <div
      data-finale={phase}
      data-finale-started-at={startedAt ?? undefined}
      className="flex h-full w-full flex-col items-center gap-[2.5vh] overflow-y-auto px-4 py-[4vh]"
    >
      <header className="flex flex-col items-center gap-2 text-center">
        <SlideEyebrow edition={edition} storyTheme={storyTheme} />
        <h1 className="text-[clamp(2.25rem,5vw,5.5rem)] leading-tight font-bold tracking-tight">
          {title}
        </h1>
      </header>
      {/* Projector scale: the leaderboard list's own sizes, zoomed (its
          rows, order and values untouched). */}
      <div className="flex w-full max-w-[min(64rem,92vw)] flex-col gap-6 min-[1800px]:[zoom:1.5] md:text-lg lg:[zoom:1.25] xl:text-2xl">
        {main === "team" ? (
          <TeamStandingsList
            rows={standings.team.slice(0, top.shown.length)}
            finale={rows}
          />
        ) : (
          <IndividualStandingsList
            rows={standings.individual.slice(0, top.shown.length)}
            finale={rows}
            primaryColor={primaryColor}
          />
        )}
        {top.moreCount > 0 ? (
          <p data-finale-more className="text-foreground/70 text-center">
            {moreLine}
          </p>
        ) : null}
        {phase === "done" ? (
          <div className="flex justify-center">
            <Button
              size="lg"
              variant="outline"
              onClick={(event) => {
                // Replay never advances, and gives the keys back.
                event.currentTarget.blur();
                start();
              }}
            >
              Replay
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
