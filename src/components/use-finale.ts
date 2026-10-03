import { useCallback, useEffect, useState } from "react";

import { finaleDurationMs, finaleRows } from "@/lib/finale";

export type FinalePhase = "ready" | "playing" | "done";

/**
 * Runs the Finale clock. `start()` plays the countdown for `ranks` (the
 * shown list's ranks, in order) and ends in the final state; under
 * `prefers-reduced-motion` it goes straight to the final state. `finish()`
 * jumps a playing countdown to its final state. Returns the phase, each
 * row's state while playing, and the wall-clock time the countdown started,
 * for evidence capture.
 *
 * `initial` is where it opens: `ready` (waits for `start()`, the Bracket
 * Finale), `playing` (plays from its first render, the Standings countdown
 * slide arriving) or `done` (the final state, that slide arrived at by
 * Back).
 */
export function useFinale(ranks: number[], initial: FinalePhase = "ready") {
  const [phase, setPhase] = useState<FinalePhase>(initial);
  const [durationMs, setDurationMs] = useState(() =>
    initial === "playing" ? finaleDurationMs(ranks) : 0,
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // Bumped on every start so Replay restarts the clock.
  const [run, setRun] = useState(initial === "playing" ? 1 : 0);
  const playing = phase === "playing";

  const start = useCallback(() => {
    setDurationMs(finaleDurationMs(ranks));
    setElapsedMs(0);
    setStartedAt(null);
    setPhase("playing");
    setRun((n) => n + 1);
  }, [ranks]);

  const finish = useCallback(() => {
    setPhase((current) => (current === "playing" ? "done" : current));
  }, []);

  useEffect(() => {
    if (run === 0 || !playing) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let frame = 0;
    let begin: number | null = null;
    const tick = (now: number) => {
      if (begin === null) {
        begin = now;
        setStartedAt(Date.now());
      }
      const elapsed = now - begin;
      if (reducedMotion || elapsed >= durationMs) {
        setPhase("done");
        return;
      }
      setElapsedMs(elapsed);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, durationMs, playing]);

  return {
    phase,
    start,
    finish,
    rows: playing ? finaleRows(ranks, elapsedMs) : undefined,
    startedAt,
  };
}
