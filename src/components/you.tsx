"use client";

import { createContext, useContext } from "react";

import type { You } from "@/lib/you";

const YouContext = createContext<You>(null);

/**
 * Knows who "you" are in this War Week. `linkedId` is the Participant the
 * server matched to the session email (account linking); without one,
 * nobody is You.
 */
export function YouProvider({
  linkedId,
  children,
}: {
  linkedId: string | null;
  children: React.ReactNode;
}) {
  const you: You = linkedId ? { participantId: linkedId } : null;
  return <YouContext.Provider value={you}>{children}</YouContext.Provider>;
}

/** Who "you" are in this War Week, or null when nobody is known. */
export function useYou(): You {
  return useContext(YouContext);
}

/** The "You" tag, rendered only in the signed-in person's own row. */
export function YouTag({ participantId }: { participantId: string }) {
  const you = useContext(YouContext);
  if (you?.participantId !== participantId) return null;
  return (
    <span
      data-you
      className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-semibold"
    >
      You
    </span>
  );
}
