"use client";

import { useState } from "react";

import {
  type BracketViewEntrant,
  EntrantMark,
} from "@/components/entrant-mark";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type TreeConnector,
  type TreeHeat,
  type TreeSlot,
  bracketTree,
} from "@/lib/bracket/tree";
import type { Bracket } from "@/lib/bracket/types";
import { formatRecordedAt } from "@/lib/bracket/view";
import { YOU_ROW_CLASS } from "@/lib/you";

type Scoring = "team" | "individual";

const LINE =
  "pointer-events-none absolute hidden border-foreground/30 md:block";

/**
 * A single-elimination Heat's connector lines (from `md` up): in from the
 * Heat that feeds it, and out to the Heat its winner goes to, half of the
 * bracket shape joining it to its pair.
 */
function Connectors({
  incoming,
  out,
}: {
  incoming: boolean;
  out: TreeConnector | undefined;
}) {
  return (
    <>
      {incoming && (
        <span
          aria-hidden
          className={`${LINE} top-1/2 right-full w-4 border-t`}
        />
      )}
      {out && (
        <>
          <span
            aria-hidden
            className={`${LINE} top-1/2 left-full w-4 border-t`}
          />
          <span
            aria-hidden
            className={`${LINE} left-[calc(100%+1rem)] border-l ${out.toSlot === 0 ? "top-1/2 bottom-0" : "top-0 bottom-1/2"}`}
          />
        </>
      )}
    </>
  );
}

/** One line of a Heat's box. */
function SlotRow({
  slot,
  heat,
  heatsFormat,
  isFinal,
  entrantsById,
  scoring,
  primaryColor,
  youEntrantId,
}: {
  slot: TreeSlot;
  heat: TreeHeat;
  heatsFormat: boolean;
  isFinal: boolean;
  entrantsById: Map<string, BracketViewEntrant>;
  scoring: Scoring;
  primaryColor: string;
  youEntrantId: string | null;
}) {
  if (slot.kind !== "entrant") {
    const text =
      slot.kind === "bye"
        ? "Bye"
        : heatsFormat
          ? `Waiting for ${slot.waitingFor} to finish`
          : `Waiting for ${slot.waitingFor}`;
    return (
      <div className="text-foreground/60 flex h-8 min-w-0 items-center px-1.5 text-sm italic">
        <span className="truncate">{text}</span>
      </div>
    );
  }
  const entrant = entrantsById.get(slot.entrantId);
  const out = heat.decided && !heat.bye && !slot.advances;
  return (
    <div
      data-advances={slot.advances || undefined}
      className={`flex h-8 min-w-0 items-center gap-2 rounded-md px-1.5 text-sm ${slot.advances ? "bg-primary/15 font-semibold" : out ? "text-foreground/60" : ""} ${YOU_ROW_CLASS}`}
    >
      {heatsFormat && heat.decided && slot.place !== null && (
        <span
          aria-label={`Place ${slot.place}`}
          className="w-4 shrink-0 text-right text-xs tabular-nums"
        >
          {slot.place}
        </span>
      )}
      {entrant && (
        <EntrantMark
          entrant={entrant}
          scoring={scoring}
          primaryColor={primaryColor}
        />
      )}
      <span className="min-w-0 truncate">{entrant?.label ?? "Unknown"}</span>
      {slot.advances && (
        <span className="sr-only">{isFinal ? " wins" : " advances"}</span>
      )}
      {slot.entrantId === youEntrantId && (
        <span data-you className="sr-only">
          (You)
        </span>
      )}
      {slot.score && (
        <span className="ml-auto shrink-0 tabular-nums">{slot.score}</span>
      )}
    </div>
  );
}

/** The Round to show first on a phone: the first with a Heat still to decide. */
function openRound(rounds: { round: number; heats: TreeHeat[] }[]): number {
  return (
    rounds.find((r) => r.heats.some((h) => !h.decided))?.round ??
    rounds.at(-1)?.round ??
    1
  );
}

/**
 * The tree view of a Bracket: Rounds as columns left to right, each Heat a
 * box of its Entrants with those going through highlighted, and (single
 * elimination) connector lines to the Heat each winner goes to. On a phone,
 * one Round at a time behind Round tabs; wider, every Round, scrolling
 * inside its own box when there are too many to fit. Results fill in as
 * Heats are decided.
 */
export function BracketTree({
  bracket,
  entrantsById,
  scoring,
  primaryColor,
  youEntrantId = null,
}: {
  bracket: Bracket;
  entrantsById: Map<string, BracketViewEntrant>;
  scoring: Scoring;
  primaryColor: string;
  youEntrantId?: string | null;
}) {
  const heatsById = new Map(bracket.heats.map((h) => [h.id, h]));
  const tree = bracketTree(bracket);
  const [active, setActive] = useState(() => openRound(tree.rounds));
  const knockout = tree.headToHead;
  const heatsFormat = !tree.headToHead;
  const finalRound = tree.rounds.at(-1)?.round ?? 0;
  const outOf = new Map(tree.connectors.map((c) => [c.fromHeatId, c]));

  return (
    <div data-bracket-tree className="flex min-w-0 flex-col gap-3">
      <Tabs
        value={active}
        onValueChange={(value) => setActive(value as number)}
        className="md:hidden"
      >
        <TabsList
          aria-label="Rounds"
          className="h-11 w-full justify-start overflow-x-auto"
        >
          {tree.rounds.map((round) => (
            <TabsTrigger key={round.round} value={round.round}>
              {round.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="min-w-0 overflow-x-auto md:pb-2">
        <div className="flex min-w-0 md:w-max md:min-w-full md:gap-8">
          {tree.rounds.map((round) => (
            <div
              key={round.round}
              role="group"
              aria-label={round.name}
              data-active={round.round === active}
              className="flex w-full min-w-0 shrink-0 flex-col data-[active=false]:hidden md:w-56 md:data-[active=false]:flex"
            >
              <h3 className="mb-1 hidden text-sm font-semibold md:block">
                {round.name}
              </h3>
              <div
                className={`flex flex-1 flex-col ${knockout ? "" : "justify-center gap-3"}`}
              >
                {round.heats.map((heat) => {
                  const source = heatsById.get(heat.id);
                  const recorded = source?.recordedAt
                    ? formatRecordedAt(source.recordedAt)
                    : "";
                  return (
                    <div
                      key={heat.id}
                      className={`relative flex items-center ${knockout ? "flex-1 py-2" : ""}`}
                    >
                      {knockout && (
                        <Connectors
                          incoming={heat.round > 1}
                          out={outOf.get(heat.id)}
                        />
                      )}
                      <div
                        role="group"
                        aria-label={heat.name}
                        className="bg-card text-card-foreground ring-foreground/10 flex w-full min-w-0 flex-col gap-1 rounded-lg p-2 ring-1"
                      >
                        <span className="text-foreground/60 px-1.5 text-xs font-medium">
                          {heat.name}
                        </span>
                        {recorded && (
                          <span className="text-foreground/70 px-1.5 text-xs">
                            {recorded}
                          </span>
                        )}
                        {heat.slots.map((slot, i) => (
                          <SlotRow
                            key={i}
                            slot={slot}
                            heat={heat}
                            heatsFormat={heatsFormat}
                            isFinal={heat.round === finalRound}
                            entrantsById={entrantsById}
                            scoring={scoring}
                            primaryColor={primaryColor}
                            youEntrantId={youEntrantId}
                          />
                        ))}
                        {heat.bye && heatsFormat && (
                          <span className="text-foreground/60 px-1.5 text-sm italic">
                            Bye — advances
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
