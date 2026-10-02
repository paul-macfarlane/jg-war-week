"use client";

import { useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type FinalePhase, useFinale } from "@/components/use-finale";
import {
  type BracketFinaleRow,
  bracketFinaleRanks,
} from "@/lib/bracket/finale";
import type { RowFinale } from "@/lib/finale";

type Scoring = "team" | "individual";

type BracketFinaleProps = {
  /** The finalized Bracket's placings, by place then Seed Position. */
  rows: BracketFinaleRow[];
  competitionName: string;
  edition: string;
  storyTheme: string;
  scoring: Scoring;
  /** The Appearance Theme primary color, for marks with no Team color. */
  primaryColor: string;
};

/**
 * The Bracket Finale player (`/<edition>/finale/<competitionId>`): a
 * finalized Bracket's placings count in from last place to first, tied
 * places together, and end on the champion. Start, `Space` or a click on the
 * stage plays it; Replay plays it again; `prefers-reduced-motion` shows the
 * final state. Plays `rows` as given: reads nothing from Standings, writes
 * nothing (CONTEXT.md, "Finale rules").
 */
export function BracketFinale(props: BracketFinaleProps) {
  const [ranks] = useState(() => bracketFinaleRanks(props.rows));
  const { phase, start, rows, startedAt } = useFinale(ranks);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // A focused button handles its own Space press.
      if (event.key !== " " || event.target instanceof HTMLButtonElement) {
        return;
      }
      event.preventDefault();
      if (phase !== "playing") start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, start]);

  return (
    <BracketFinaleStage
      {...props}
      phase={phase}
      finale={rows}
      startedAt={startedAt}
      onStart={start}
    />
  );
}

function PlaceMark({
  row,
  scoring,
  primaryColor,
}: {
  row: BracketFinaleRow;
  scoring: Scoring;
  primaryColor: string;
}) {
  if (scoring === "individual") {
    return (
      <Avatar
        name={row.label}
        teamColor={row.color}
        primaryColor={primaryColor}
        image={row.image}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="size-4 shrink-0 rounded-full"
      style={{ backgroundColor: row.color ?? primaryColor }}
    />
  );
}

/**
 * The Bracket Finale stage for a phase (props only): `ready` shows the
 * title and Start; `playing` lists the places shown so far (the rest hold
 * their space, unnamed); `done` lists every place under the champion card
 * and offers Replay.
 */
export function BracketFinaleStage({
  phase,
  rows,
  finale,
  competitionName,
  edition,
  storyTheme,
  scoring,
  primaryColor,
  startedAt,
  onStart,
}: BracketFinaleProps & {
  phase: FinalePhase;
  /** Each row's state, in row order, while playing. */
  finale: RowFinale[] | undefined;
  startedAt: number | null;
  onStart: () => void;
}) {
  const champion = rows.find((row) => row.place === 1);

  return (
    <div
      data-finale={phase}
      data-finale-started-at={startedAt ?? undefined}
      className="relative flex min-h-[calc(100dvh-4rem)] cursor-default flex-col items-center overflow-hidden px-4 py-8 md:py-12"
      onClick={() => {
        if (phase === "ready") onStart();
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[40rem] bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_60%)]"
      />
      <div className="relative flex w-full max-w-3xl flex-1 flex-col gap-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <p className="text-primary text-xs font-semibold tracking-[0.25em] uppercase md:text-sm">
            War Week {edition.toUpperCase()} · {storyTheme}
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Finale
          </h1>
          <p className="text-foreground/70 text-lg md:text-xl">
            {competitionName}
          </p>
        </header>

        {phase === "ready" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <Button
              className="h-20 rounded-2xl px-16 text-3xl font-bold md:h-24 md:text-4xl"
              onClick={(event) => {
                event.stopPropagation();
                onStart();
              }}
            >
              Start
            </Button>
            <p className="text-foreground/60 text-sm">
              Press Space or tap anywhere to start.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 md:text-lg">
            {phase === "done" && champion ? (
              <Card aria-label="Champion" className="ring-primary ring-2">
                <CardContent className="flex flex-col items-center gap-2 text-center">
                  <span aria-hidden className="text-6xl">
                    🏆
                  </span>
                  <span className="flex items-center gap-3 text-3xl font-bold md:text-4xl">
                    <PlaceMark
                      row={champion}
                      scoring={scoring}
                      primaryColor={primaryColor}
                    />
                    {champion.label}
                  </span>
                  <span className="text-foreground/70">
                    Champion of {competitionName}
                  </span>
                </CardContent>
              </Card>
            ) : null}
            <ol className="flex flex-col gap-2">
              {rows.map((row, i) => {
                const state = finale?.[i];
                const shown = !state || state.shown;
                return (
                  <li
                    key={row.entrantId}
                    aria-hidden={shown ? undefined : true}
                    className={
                      state
                        ? shown
                          ? "translate-y-0 opacity-100 transition-all duration-500"
                          : "translate-y-2 opacity-0"
                        : undefined
                    }
                  >
                    <Card
                      size="sm"
                      className="flex-row items-center gap-3 px-4 py-3"
                    >
                      <span className="text-foreground/60 w-6 text-sm font-medium tabular-nums">
                        {row.place}
                      </span>
                      {shown ? (
                        <>
                          <PlaceMark
                            row={row}
                            scoring={scoring}
                            primaryColor={primaryColor}
                          />
                          <span className="flex-1 font-semibold">
                            {row.label}
                          </span>
                        </>
                      ) : (
                        // Holds the row's space without naming it early.
                        <span className="flex-1">&nbsp;</span>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ol>
            {phase === "done" ? (
              <div className="flex justify-center">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStart();
                  }}
                >
                  Replay
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
