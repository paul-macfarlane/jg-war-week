"use client";

import {
  type BracketViewEntrant,
  EntrantMark,
} from "@/components/entrant-mark";
import { Button } from "@/components/ui/button";
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

const LINE = "pointer-events-none absolute border-foreground/30";

/**
 * A single-elimination Heat's connector lines: in from the Heat that feeds
 * it, and out to the Heat its winner goes to, half of the bracket shape
 * joining it to its pair.
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

/** One line of a Heat's box; a Squad's Participants under its name. */
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
      <div className="text-foreground/60 flex min-h-8 min-w-0 items-center px-1.5 text-sm italic">
        <span className="truncate">{text}</span>
      </div>
    );
  }
  const entrant = entrantsById.get(slot.entrantId);
  const out = heat.decided && !heat.bye && !slot.advances;
  const squadNames =
    entrant?.squadId && entrant.participantNames.length > 0
      ? entrant.participantNames.join(", ")
      : null;
  return (
    <div
      data-advances={slot.advances || undefined}
      className={`flex min-h-8 min-w-0 items-center gap-2 rounded-md px-1.5 text-sm ${slot.advances ? "bg-primary/15 font-semibold" : out ? "text-foreground/60" : ""} ${YOU_ROW_CLASS}`}
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
      {squadNames ? (
        <span className="flex min-w-0 flex-col py-0.5">
          <span className="min-w-0 truncate">{entrant?.label}</span>
          <span className="text-foreground/70 min-w-0 text-xs font-normal break-words">
            {squadNames}
          </span>
        </span>
      ) : (
        <span className="min-w-0 truncate">{entrant?.label ?? "Unknown"}</span>
      )}
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

/**
 * The one tree of a Bracket, for admin and Participants alike: Rounds as
 * columns left to right, each Heat a box of its Entrants with those going
 * through highlighted, and (single elimination) connector lines to the Heat
 * each winner goes to. The Rounds scroll sideways inside their own region
 * when they don't fit, so the page itself never does. Each Heat in
 * `recordableHeatIds` carries a visible Record result (Edit once played)
 * that calls `onRecord`; any other Heat has none. Hiding a button grants
 * nothing: the action authorizes.
 */
export function BracketTree({
  bracket,
  entrantsById,
  scoring,
  primaryColor,
  youEntrantId = null,
  recordableHeatIds = [],
  onRecord,
  reporters = {},
}: {
  bracket: Bracket;
  entrantsById: Map<string, BracketViewEntrant>;
  scoring: Scoring;
  primaryColor: string;
  youEntrantId?: string | null;
  /** The Heats the viewer may record now; each shows Record result or Edit. */
  recordableHeatIds?: readonly string[];
  onRecord?: (heatId: string) => void;
  /** Who self-reported each Heat's current result, by Heat id: a name. */
  reporters?: Record<string, string>;
}) {
  const heatsById = new Map(bracket.heats.map((h) => [h.id, h]));
  const recordable = new Set(onRecord ? recordableHeatIds : []);
  const tree = bracketTree(bracket);
  const knockout = tree.headToHead;
  const heatsFormat = !tree.headToHead;
  const finalRound = tree.rounds.at(-1)?.round ?? 0;
  const outOf = new Map(tree.connectors.map((c) => [c.fromHeatId, c]));

  /** One Heat's box in its slot of the Round's column (`place` sizes it). */
  const renderHeat = (heat: TreeHeat, place: string) => {
    const source = heatsById.get(heat.id);
    const recorded = source?.recordedAt
      ? formatRecordedAt(source.recordedAt)
      : "";
    const reporter = reporters[heat.id];
    return (
      <div
        key={heat.id}
        data-third-place={heat.thirdPlace ? "" : undefined}
        className={`relative flex items-center ${place}`}
      >
        {knockout && !heat.thirdPlace && (
          <Connectors incoming={heat.round > 1} out={outOf.get(heat.id)} />
        )}
        <div
          role="group"
          aria-label={heat.name}
          className={`text-card-foreground relative flex w-full min-w-0 flex-col gap-1 rounded-lg p-2 ring-1 ${
            heat.thirdPlace
              ? "bg-muted/40 ring-foreground/5 opacity-90"
              : "bg-card ring-foreground/10"
          }`}
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
          {reporter && (
            <span className="text-foreground/70 px-1.5 text-xs">
              Reported by {reporter}
            </span>
          )}
          {recordable.has(heat.id) && (
            // Its ::after stretches over the Heat's box, so the whole Heat
            // is one tap target; the box is the containing block.
            <Button
              type="button"
              variant={heat.decided ? "outline" : "default"}
              size="sm"
              aria-label={`${heat.decided ? "Edit" : "Record result for"} ${heat.name}`}
              className="mt-1 min-h-11 self-start after:absolute after:inset-0 after:rounded-lg active:not-aria-[haspopup]:translate-none sm:min-h-8"
              onClick={() => onRecord?.(heat.id)}
            >
              {heat.decided ? "Edit" : "Record result"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div data-bracket-tree className="flex min-w-0 flex-col">
      <div
        role="region"
        aria-label="Rounds"
        tabIndex={0}
        data-testid="bracket-tree-scroll"
        className="focus-visible:ring-ring/50 min-w-0 overflow-x-auto rounded-lg pb-2 outline-none focus-visible:ring-3"
      >
        <div className="flex w-max min-w-full gap-8">
          {tree.rounds.map((round) => (
            <div
              key={round.round}
              role="group"
              aria-label={round.name}
              className="flex w-56 shrink-0 flex-col"
            >
              <h3 className="mb-1 text-sm font-semibold">{round.name}</h3>
              {knockout && round.heats.some((h) => h.thirdPlace) ? (
                // The final stays in the middle row, where its semifinals'
                // lines meet; the 3rd place game sits under it, unjoined.
                // Equal outer rows leave room for it without overlap.
                <div className="relative grid flex-1 grid-rows-[1fr_auto_1fr]">
                  <div aria-hidden />
                  {round.heats
                    .filter((h) => !h.thirdPlace)
                    .map((heat) => renderHeat(heat, "py-2"))}
                  {round.heats
                    .filter((h) => h.thirdPlace)
                    .map((heat) => renderHeat(heat, "self-start py-2"))}
                </div>
              ) : (
                <div
                  className={`relative flex flex-1 flex-col ${knockout ? "" : "justify-center gap-3"}`}
                >
                  {round.heats.map((heat) =>
                    renderHeat(heat, knockout ? "flex-1 py-2" : ""),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
