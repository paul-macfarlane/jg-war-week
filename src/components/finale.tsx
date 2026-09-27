"use client";

import { useEffect, useState } from "react";

import {
  IndividualStandingsList,
  TeamStandingsList,
} from "@/components/standings";
import { Button } from "@/components/ui/button";
import { useFinale } from "@/components/use-finale";
import type { Standings } from "@/lib/standings";

/**
 * The Finale player (`/<edition>/finale`): the closing-ceremony screen for
 * the projector. It opens on a Start button (also `Space`, or a click
 * anywhere on the stage), then counts in the main leaderboard, team
 * Standings in `teams` mode or individual Standings in free-for-all, and
 * ends on a Replay button. See CONTEXT.md, "Finale rules": it shows
 * `standings` exactly as given and never reorders or recomputes them.
 */
export function Finale({
  standings,
  edition,
  storyTheme,
  teamLabel,
  primaryColor,
}: {
  standings: Standings;
  edition: string;
  storyTheme: string;
  teamLabel: string;
  /** The Appearance Theme primary color, for Avatars with no Team. */
  primaryColor: string;
}) {
  const main = standings.main;
  const [ranks] = useState(() =>
    (main === "team" ? standings.team : standings.individual).map(
      (row) => row.rank,
    ),
  );
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

  const title =
    main === "team" ? `${teamLabel} standings` : "Individual leaderboard";

  return (
    <div
      data-finale={phase}
      data-finale-started-at={startedAt ?? undefined}
      className="relative flex min-h-[calc(100dvh-4rem)] cursor-default flex-col items-center overflow-hidden px-4 py-8 md:py-12"
      onClick={() => {
        if (phase === "ready") start();
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
          <p className="text-foreground/70 text-lg md:text-xl">{title}</p>
        </header>

        {phase === "ready" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <Button
              className="h-20 rounded-2xl px-16 text-3xl font-bold md:h-24 md:text-4xl"
              onClick={(event) => {
                event.stopPropagation();
                start();
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
            {main === "team" ? (
              <TeamStandingsList rows={standings.team} finale={rows} />
            ) : (
              <IndividualStandingsList
                rows={standings.individual}
                finale={rows}
                primaryColor={primaryColor}
              />
            )}
            {phase === "done" ? (
              <div className="flex justify-center">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    start();
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
