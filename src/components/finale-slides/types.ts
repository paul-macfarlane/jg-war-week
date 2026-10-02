import type { FinaleSlideData } from "@/lib/finale-slides";

/**
 * What every slide component gets (the step protocol): its data, how many
 * of its steps are shown (`step`), whether every step is (`final`: arrived
 * at by Back, or Next already finished it), and `complete()`, for a slide
 * that finishes by itself, so Next then moves on.
 */
export type FinaleSlideProps<K extends FinaleSlideData["kind"]> = {
  data: Extract<FinaleSlideData, { kind: K }>;
  step: number;
  final: boolean;
  complete: () => void;
  edition: string;
  storyTheme: string;
};
