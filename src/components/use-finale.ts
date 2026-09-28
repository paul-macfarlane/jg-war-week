import { useCallback, useEffect, useState } from "react";

import { finaleDurationMs, finaleRows } from "@/lib/finale";

export type FinalePhase = "ready" | "playing" | "done";

/**
 * Runs the Finale clock. `start()` plays the countdown for `ranks` (the
 * shown list's ranks, in order) and ends in the final state; under
 * `prefers-reduced-motion` it goes straight to the final state. Returns the
 * phase, each row's state while playing, and the wall-clock time the
 * countdown started, for evidence capture.
 */
export function useFinale(ranks: number[]) {
  const [phase, setPhase] = useState<FinalePhase>("ready");
  const [durationMs, setDurationMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // Bumped on every start so Replay restarts the clock.
  const [run, setRun] = useState(0);

  const start = useCallback(() => {
    setDurationMs(finaleDurationMs(ranks));
    setElapsedMs(0);
    setStartedAt(null);
    setPhase("playing");
    setRun((n) => n + 1);
  }, [ranks]);

  useEffect(() => {
    if (run === 0) return;
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
  }, [run, durationMs]);

  return {
    phase,
    start,
    rows: phase === "playing" ? finaleRows(ranks, elapsedMs) : undefined,
    startedAt,
  };
}
