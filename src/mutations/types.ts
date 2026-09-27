/** Who is writing, and for which War Week (ADR 0001). */
export type MutationContext = { warWeekId: string; actorEmail: string };

export type { WriteResult as MutationResult } from "@/lib/result";
