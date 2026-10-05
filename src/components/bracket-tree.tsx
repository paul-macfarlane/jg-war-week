"use client";

import {
  type BracketViewEntrant,
  EntrantMark,
} from "@/components/entrant-mark";
import { Button } from "@/components/ui/button";
import { advancePerMatchLabel } from "@/lib/bracket/config";
import { resultLockReason } from "@/lib/bracket/self-report";
import {
  type TreeConnector,
  type TreeMatch,
  type TreeSlot,
  bracketTree,
} from "@/lib/bracket/tree";
import type { Bracket, Match } from "@/lib/bracket/types";
import { formatRecordedAt } from "@/lib/bracket/view";
import type { ScoreDirection } from "@/lib/enums";
import { isSetByHand, parseScore } from "@/lib/scoring";
import { YOU_ROW_CLASS } from "@/lib/you";

type Scoring = "team" | "individual";

/**
 * Whether a decided Match's places differ from what its Scores give
 * (`isSetByHand`): a tie settled, or a correction.
 */
function setByHand(match: Match, direction: ScoreDirection): boolean {
  if (match.status !== "played") return false;
  return isSetByHand(
    match.slots.flatMap((s) =>
      s.entrantId
        ? [
            {
              id: s.entrantId,
              place: s.place,
              score: s.score === null ? null : parseScore(s.score),
            },
          ]
        : [],
    ),
    direction,
  );
}

const LINE = "pointer-events-none absolute border-foreground/30";

/**
 * A head-to-head Match's connector lines: in from the Match that feeds
 * it, and out to the Match its winner goes to, half of the bracket shape
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

/** One line of a Match's box; a Squad's Participants under its name. */
function SlotRow({
  slot,
  match,
  multiEntrant,
  entrantsById,
  scoring,
  scoreUnit,
  primaryColor,
  youEntrantId,
}: {
  slot: TreeSlot;
  match: TreeMatch;
  /** More than 2 per Match: places shown, a waiting Match as one line. */
  multiEntrant: boolean;
  entrantsById: Map<string, BracketViewEntrant>;
  scoring: Scoring;
  scoreUnit: string | null;
  primaryColor: string;
  youEntrantId: string | null;
}) {
  if (slot.kind !== "entrant") {
    const text =
      slot.kind === "bye"
        ? "Bye"
        : multiEntrant
          ? `Waiting for ${slot.waitingFor} to finish`
          : `Waiting for ${slot.waitingFor}`;
    return (
      <div className="text-foreground/60 flex min-h-8 min-w-0 items-center px-1.5 text-sm italic">
        <span className="truncate">{text}</span>
      </div>
    );
  }
  const entrant = entrantsById.get(slot.entrantId);
  const out = match.decided && !match.bye && !slot.advances;
  const squadNames =
    entrant?.squadId && entrant.participantNames.length > 0
      ? entrant.participantNames.join(", ")
      : null;
  return (
    <div
      data-advances={slot.advances || undefined}
      className={`flex min-h-8 min-w-0 items-center gap-2 rounded-md px-1.5 text-sm ${slot.advances ? "bg-primary/15 font-semibold" : out ? "text-foreground/60" : ""} ${YOU_ROW_CLASS}`}
    >
      {multiEntrant && match.decided && slot.place !== null && (
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
        <span className="sr-only">
          {match.final
            ? " wins"
            : match.thirdPlace
              ? " takes 3rd"
              : " advances"}
        </span>
      )}
      {slot.entrantId === youEntrantId && (
        <span data-you className="sr-only">
          (You)
        </span>
      )}
      {slot.score && (
        <span className="ml-auto shrink-0 tabular-nums">
          {slot.score}
          {scoreUnit?.trim() ? ` ${scoreUnit.trim()}` : ""}
        </span>
      )}
    </div>
  );
}

/**
 * The one tree of a Bracket, for admin and Participants alike: Rounds as
 * columns left to right, each Match a box of its Entrants with those going
 * through highlighted, and (head-to-head) connector lines to the Match
 * each winner goes to. The Rounds scroll sideways inside their own region
 * when they don't fit, so the page itself never does. Each Match in
 * `recordableMatchIds` carries a visible Record result (Edit once played)
 * that calls `onRecord`; each in `lockedMatchIds` (locked by
 * `resultLockReason`, spec R21 D1c: a later Match used its result, or in a
 * Group Bracket a later Round has one) shows Edit and Clear result
 * disabled with that reason beside them; any other Match has none. Hiding a button grants
 * nothing: the action authorizes. A decided Match whose places differ from
 * its Scores says "Set by hand".
 */
export function BracketTree({
  bracket,
  entrantsById,
  scoring,
  scoreUnit = null,
  scoreDirection = "none",
  primaryColor,
  youEntrantId = null,
  highlightedMatchId = null,
  recordableMatchIds = [],
  lockedMatchIds = [],
  onRecord,
  onEditRound,
  reporters = {},
}: {
  bracket: Bracket;
  entrantsById: Map<string, BracketViewEntrant>;
  scoring: Scoring;
  /** The Score unit, shown beside each Match row's Score. */
  scoreUnit?: string | null;
  /** The Score direction, for "Set by hand". */
  scoreDirection?: ScoreDirection;
  primaryColor: string;
  youEntrantId?: string | null;
  /** A Match to ring (Jump to your Match), or null. */
  highlightedMatchId?: string | null;
  /** The Matches the viewer may record now; each shows Record result or Edit. */
  recordableMatchIds?: readonly string[];
  /** Decided Matches the viewer would edit, but whose result is locked (`resultLockReason`). */
  lockedMatchIds?: readonly string[];
  onRecord?: (matchId: string) => void;
  /**
   * A Group Bracket's admin: each Round heading carries an Edit that calls
   * this with the Round (its Matches' sizes, advancing and Entrants).
   */
  onEditRound?: (round: number) => void;
  /** Who self-reported each Match's current result, by Match id: a name. */
  reporters?: Record<string, string>;
}) {
  const matchesById = new Map(bracket.matches.map((m) => [m.id, m]));
  const recordable = new Set(onRecord ? recordableMatchIds : []);
  const locked = new Set(onRecord ? lockedMatchIds : []);
  const tree = bracketTree(bracket);
  const knockout = tree.headToHead;
  const multiEntrant = !tree.headToHead;
  const outOf = new Map(tree.connectors.map((c) => [c.fromMatchId, c]));

  /** One Match's box in its slot of the Round's column (`place` sizes it). */
  const renderMatch = (match: TreeMatch, place: string) => {
    const source = matchesById.get(match.id);
    const recorded = source?.recordedAt
      ? formatRecordedAt(source.recordedAt)
      : "";
    const reporter = reporters[match.id];
    const highlighted = match.id === highlightedMatchId;
    const lockReason =
      source && locked.has(match.id) && !recordable.has(match.id)
        ? resultLockReason(bracket, source)
        : null;
    return (
      <div
        key={match.id}
        data-third-place={match.thirdPlace ? "" : undefined}
        className={`relative flex items-center ${place}`}
      >
        {knockout && !match.thirdPlace && (
          <Connectors incoming={match.round > 1} out={outOf.get(match.id)} />
        )}
        <div
          role="group"
          aria-label={match.name}
          data-match-id={match.id}
          tabIndex={-1}
          data-highlighted={highlighted ? "" : undefined}
          aria-current={highlighted ? "true" : undefined}
          className={`text-card-foreground relative flex w-full min-w-0 flex-col gap-1 rounded-lg p-2 ${
            highlighted
              ? "bg-card ring-primary ring-4"
              : match.thirdPlace
                ? "bg-muted/40 ring-foreground/5 opacity-90 ring-1"
                : "bg-card ring-foreground/10 ring-1"
          }`}
        >
          <span className="text-foreground/60 px-1.5 text-xs font-medium">
            {match.name}
          </span>
          {recorded && (
            <span className="text-foreground/70 px-1.5 text-xs">
              {recorded}
            </span>
          )}
          {match.slots.map((slot, i) => (
            <SlotRow
              key={i}
              slot={slot}
              match={match}
              multiEntrant={multiEntrant}
              entrantsById={entrantsById}
              scoring={scoring}
              scoreUnit={scoreUnit}
              primaryColor={primaryColor}
              youEntrantId={youEntrantId}
            />
          ))}
          {match.bye && multiEntrant && (
            <span className="text-foreground/60 px-1.5 text-sm italic">
              Bye — advances
            </span>
          )}
          {multiEntrant && !match.bye && !match.final && (
            // Matches of one Round may send on different numbers.
            <span className="text-foreground/60 px-1.5 text-xs">
              {advancePerMatchLabel(match.advancing)}
            </span>
          )}
          {source && setByHand(source, scoreDirection) && (
            <span
              data-slot="set-by-hand"
              className="text-foreground/70 px-1.5 text-xs"
            >
              Set by hand
            </span>
          )}
          {reporter && (
            <span className="text-foreground/70 px-1.5 text-xs">
              Reported by {reporter}
            </span>
          )}
          {lockReason && (
            <div className="mt-1 flex flex-col gap-1">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 sm:min-h-8"
                  aria-label={`Edit ${match.name}`}
                  aria-describedby={`${match.id}-lock-reason`}
                  disabled
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 sm:min-h-8"
                  aria-label={`Clear result of ${match.name}`}
                  aria-describedby={`${match.id}-lock-reason`}
                  disabled
                >
                  Clear result
                </Button>
              </div>
              <p
                id={`${match.id}-lock-reason`}
                data-slot="match-lock-reason"
                className="text-foreground/70 px-1.5 text-xs"
              >
                {lockReason}
              </p>
            </div>
          )}
          {recordable.has(match.id) && (
            // Its ::after stretches over the Match's box, so the whole Match
            // is one tap target; the box is the containing block.
            <Button
              type="button"
              variant={match.decided ? "outline" : "default"}
              size="sm"
              aria-label={`${match.decided ? "Edit" : "Record result for"} ${match.name}`}
              className="mt-1 min-h-11 self-start after:absolute after:inset-0 after:rounded-lg active:not-aria-[haspopup]:translate-none sm:min-h-8"
              onClick={() => onRecord?.(match.id)}
            >
              {match.decided ? "Edit" : "Record result"}
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
              <div className="mb-1 flex min-h-8 items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{round.name}</h3>
                {multiEntrant && onEditRound && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Edit ${round.name} settings`}
                    className="min-h-11 sm:min-h-8"
                    onClick={() => onEditRound(round.round)}
                  >
                    Edit
                  </Button>
                )}
              </div>
              {knockout && round.matches.some((m) => m.thirdPlace) ? (
                // The final stays in the middle row, where its semifinals'
                // lines meet; the 3rd place Match sits under it, unjoined.
                // Equal outer rows leave room for it without overlap.
                <div className="relative grid flex-1 grid-rows-[1fr_auto_1fr]">
                  <div aria-hidden />
                  {round.matches
                    .filter((m) => !m.thirdPlace)
                    .map((match) => renderMatch(match, "py-2"))}
                  {round.matches
                    .filter((m) => m.thirdPlace)
                    .map((match) => renderMatch(match, "self-start py-2"))}
                </div>
              ) : (
                <div
                  className={`relative flex flex-1 flex-col ${knockout ? "" : "justify-center gap-3"}`}
                >
                  {round.matches.map((match) =>
                    renderMatch(match, knockout ? "flex-1 py-2" : ""),
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
