"use client";

import Link from "next/link";
import { useState } from "react";

import { reportHeatResult } from "@/actions/heat-reports";
import { AutoRefresh } from "@/components/auto-refresh";
import {
  type BracketViewEntrant,
  EntrantMark,
} from "@/components/entrant-mark";
import { HeatResultForm } from "@/components/heat-result-form";
import { ResponsiveSheetDialog } from "@/components/responsive-sheet-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useYou } from "@/components/you";
import { isBye } from "@/lib/bracket/formats";
import type { Bracket, Heat } from "@/lib/bracket/types";
import {
  type NextHeat,
  entrantForYou,
  formatHeatWhen,
  groupRounds,
  heatName,
  isDecided,
  nextHeatFor,
} from "@/lib/bracket/view";
import { YOU_ROW_CLASS } from "@/lib/you";

type Scoring = "team" | "individual";

function YouMark() {
  return (
    <span
      data-you
      className="bg-accent text-accent-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
    >
      You
    </span>
  );
}

/** The Heat whose winner fills `slot` of `heat`, if any. */
function feederOf(bracket: Bracket, heat: Heat, slot: number) {
  return bracket.heats.find(
    (h) => h.winnerTo?.heatId === heat.id && h.winnerTo.slot === slot,
  );
}

/** "A", "A and B", "A, B and C". */
function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * A Heat's places: each Entrant with its mark, scores and forfeits. A
 * decided two-slot Heat marks its winner bold with a ✓; a decided Heat of
 * more lists its Entrants by place with their place numbers. An empty
 * single-elimination place reads "Bye" or "Waiting for …"; a Heats Round
 * not yet filled reads "Waiting for Round N to finish", and a Heats bye
 * says its Entrants advance.
 */
export function HeatRows({
  heat,
  bracket,
  entrantsById,
  scoring,
  primaryColor,
  youEntrantId = null,
}: {
  heat: Heat;
  bracket: Bracket;
  entrantsById: Map<string, BracketViewEntrant>;
  scoring: Scoring;
  primaryColor: string;
  youEntrantId?: string | null;
}) {
  const bye = isBye(bracket, heat);
  const decided = isDecided(heat) && !bye;
  const ranked = decided && heat.slots.length > 2;
  if (
    bracket.format === "heats" &&
    heat.slots.every((s) => s.entrantId === null)
  ) {
    return (
      <p className="text-foreground/60 flex min-h-8 items-center px-1 italic">
        Waiting for Round {heat.round - 1} to finish
      </p>
    );
  }
  const slots = heat.slots.map((slot, i) => ({ slot, i }));
  if (ranked) slots.sort((a, b) => (a.slot.place ?? 0) - (b.slot.place ?? 0));
  return (
    <ul className="flex flex-col gap-1">
      {slots.map(({ slot, i }) => {
        const entrant = slot.entrantId
          ? entrantsById.get(slot.entrantId)
          : undefined;
        if (!entrant) {
          const feeder = feederOf(bracket, heat, i);
          return (
            <li
              key={i}
              className="text-foreground/60 flex min-h-8 items-center px-1 italic"
            >
              {bye
                ? "Bye"
                : feeder
                  ? `Waiting for ${heatName(bracket, feeder)}`
                  : "Waiting"}
            </li>
          );
        }
        const won = decided && slot.place === 1;
        return (
          <li
            key={i}
            className={`flex min-h-8 min-w-0 items-center gap-2 px-1 ${YOU_ROW_CLASS}`}
          >
            {ranked && (
              <span
                aria-label={`Place ${slot.place}`}
                className={`w-5 shrink-0 text-right text-sm tabular-nums ${won ? "text-primary font-bold" : "text-foreground/60"}`}
              >
                {slot.place}
              </span>
            )}
            <EntrantMark
              entrant={entrant}
              scoring={scoring}
              primaryColor={primaryColor}
            />
            {entrant.squadId && entrant.participantNames.length > 0 ? (
              <span className="flex min-w-0 flex-col">
                <span
                  className={`min-w-0 truncate ${won ? "font-semibold" : decided ? "text-foreground/70" : ""}`}
                >
                  {entrant.label}
                </span>
                <span className="text-foreground/60 min-w-0 text-xs break-words">
                  {entrant.participantNames.join(", ")}
                </span>
              </span>
            ) : (
              <span
                className={`min-w-0 truncate ${won ? "font-semibold" : decided ? "text-foreground/70" : ""}`}
              >
                {entrant.label}
              </span>
            )}
            {won && !ranked && (
              <span aria-label="Winner" className="text-primary font-bold">
                ✓
              </span>
            )}
            {slot.forfeited && <Badge variant="outline">Forfeit</Badge>}
            {entrant.id === youEntrantId && <YouMark />}
            {slot.score && (
              <span
                className={`ml-auto shrink-0 tabular-nums ${won ? "font-semibold" : ""}`}
              >
                {slot.score}
              </span>
            )}
          </li>
        );
      })}
      {bye && bracket.format === "heats" && (
        <li className="text-foreground/60 flex min-h-8 items-center px-1 italic">
          Bye — advances
        </li>
      )}
    </ul>
  );
}

/**
 * The "Your next Heat" card (props only): the Heat You play next, when and
 * against whom, or the Round You advanced to. `canReport` adds **Report
 * result** (the server found the Heat reportable by You, known by account
 * linking); `pickOnly` says how to report when You are known only by the
 * "Which one is you?" pick.
 */
export function YourNextHeatCard({
  next,
  bracket,
  entrantsById,
  when,
  canReport,
  pickOnly,
  onReport,
}: {
  next: NextHeat;
  bracket: Bracket;
  entrantsById: Map<string, BracketViewEntrant>;
  /** The Heat's Day, time and place, when it has them. */
  when: string | null;
  canReport: boolean;
  pickOnly: boolean;
  onReport: () => void;
}) {
  return (
    <Card size="sm" aria-label="Your next Heat" className="ring-accent ring-2">
      <CardContent className="flex min-w-0 flex-col gap-1">
        {next.kind === "advanced" ? (
          <>
            <span className="text-foreground/60 text-xs font-medium uppercase">
              Your next Heat
            </span>
            <span className="font-semibold">
              Advanced to Round {next.round} · waiting for Round{" "}
              {next.round - 1} to finish
            </span>
          </>
        ) : (
          <>
            <span className="text-foreground/60 text-xs font-medium uppercase">
              Your next Heat · {heatName(bracket, next.heat)}
            </span>
            {when && <span className="text-foreground/70 text-sm">{when}</span>}
            {next.opponentIds.length > 0 ? (
              <span className="font-semibold break-words">
                vs{" "}
                {listNames(
                  next.opponentIds.map(
                    (id) => entrantsById.get(id)?.label ?? "Unknown",
                  ),
                )}
              </span>
            ) : (
              <span className="text-foreground/70">
                {next.waitingFor
                  ? `Waiting for ${heatName(bracket, next.waitingFor)}`
                  : "Waiting for an opponent"}
              </span>
            )}
            {canReport ? (
              <Button
                type="button"
                size="lg"
                className="mt-2 min-h-11 w-fit"
                onClick={onReport}
              >
                Report result
              </Button>
            ) : pickOnly ? (
              <p className="text-foreground/70 text-sm">
                To report results, ask an Organizer to add your email to the
                roster.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** What the page decided about self-report for this Bracket. */
export type BracketViewSelfReport = {
  on: boolean;
  /** The Participant the session email links to, or null. */
  linkedParticipantId: string | null;
  /** Your next Heat, when the server found it reportable by You; else null. */
  reportableHeatId: string | null;
};

/**
 * The phone Bracket view: a vertical list of Heats grouped by Round, with
 * (single elimination) "Winner → …" chips, the champion and Your next Heat
 * pinned on top, and Your Entrant highlighted under the You rules. Owns the
 * report Sheet (a centered Dialog on large screens), and refreshes live
 * while it's closed (a Bracket not drawn yet too, so the draw appears).
 */
export function BracketView({
  competitionId,
  entrants,
  bracket,
  champion,
  scoring,
  primaryColor,
  participantTeams,
  participantSquads,
  days,
  finaleHref,
  selfReport,
}: {
  competitionId: string;
  entrants: BracketViewEntrant[];
  bracket: Bracket;
  champion: string | null;
  scoring: Scoring;
  primaryColor: string;
  /** Each Participant's Team id, for finding Your Team's Entrant. */
  participantTeams: Record<string, string>;
  /** Each Participant's Squad id in this Competition, for Your Squad's Entrant. */
  participantSquads: Record<string, string>;
  /** The War Week's Days, for a timed Heat's Day, time and place. */
  days: { id: string; date: string }[];
  /** The Bracket Finale, once the Bracket is finalized; null before. */
  finaleHref: string | null;
  selfReport: BracketViewSelfReport;
}) {
  const you = useYou();
  const [reporting, setReporting] = useState<string | null>(null);
  const entrantsById = new Map(entrants.map((e) => [e.id, e]));
  const youEntrantId = entrantForYou(
    entrants,
    you
      ? {
          participantId: you.participantId,
          teamId: participantTeams[you.participantId] ?? null,
          squadId: participantSquads[you.participantId] ?? null,
        }
      : null,
    scoring,
  );
  const next = youEntrantId ? nextHeatFor(bracket, youEntrantId) : null;
  const nextWhen =
    next && next.kind === "heat" ? formatHeatWhen(next.heat, days) : null;
  const winner = champion ? entrantsById.get(champion) : undefined;
  const heatsById = new Map(bracket.heats.map((h) => [h.id, h]));
  const canReport =
    selfReport.on &&
    you?.via === "email" &&
    you.participantId === selfReport.linkedParticipantId &&
    next?.kind === "heat" &&
    next.heat.id === selfReport.reportableHeatId;
  const pickOnly = selfReport.on && you?.via === "pick";
  const reportHeat = reporting ? heatsById.get(reporting) : undefined;
  const close = () => setReporting(null);

  if (bracket.heats.length === 0) {
    return (
      <section className="flex flex-col gap-2" aria-label="Bracket">
        <h2 className="text-lg font-semibold">Bracket</h2>
        <p className="text-foreground/70 text-sm">
          The Bracket hasn&apos;t been drawn yet.
        </p>
        <AutoRefresh />
      </section>
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="Bracket">
      <h2 className="text-lg font-semibold">Bracket</h2>

      {winner && (
        <Card size="sm" aria-label="Champion" className="ring-primary ring-2">
          <CardContent className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="text-3xl">
              🏆
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground/60 text-xs font-medium uppercase">
                Champion
              </span>
              <span
                className={`flex min-w-0 items-center gap-2 text-lg font-bold ${YOU_ROW_CLASS}`}
              >
                <EntrantMark
                  entrant={winner}
                  scoring={scoring}
                  primaryColor={primaryColor}
                />
                <span className="truncate">{winner.label}</span>
                {winner.id === youEntrantId && <YouMark />}
              </span>
            </div>
            {finaleHref && (
              <Link
                href={finaleHref}
                className={`${buttonVariants({ variant: "outline", size: "sm" })} ml-auto shrink-0`}
              >
                Play the Finale
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {next && (
        <YourNextHeatCard
          next={next}
          bracket={bracket}
          entrantsById={entrantsById}
          when={nextWhen}
          canReport={canReport}
          pickOnly={pickOnly}
          onReport={() => {
            if (next.kind === "heat") setReporting(next.heat.id);
          }}
        />
      )}

      {groupRounds(bracket).map((round) => (
        <section
          key={round.round}
          className="flex flex-col gap-2"
          aria-label={round.name}
        >
          <h3 className="font-semibold">{round.name}</h3>
          <ul className="flex flex-col gap-2">
            {round.heats.map((heat) => {
              const to =
                bracket.format === "single-elimination" && heat.winnerTo
                  ? heatsById.get(heat.winnerTo.heatId)
                  : undefined;
              const when = formatHeatWhen(heat, days);
              return (
                <li key={heat.id}>
                  <Card size="sm">
                    <CardContent className="flex min-w-0 flex-col gap-2">
                      <span className="text-foreground/60 text-xs font-medium">
                        {heatName(bracket, heat)}
                      </span>
                      {when && (
                        <span className="text-foreground/70 text-xs">
                          {when}
                        </span>
                      )}
                      <HeatRows
                        heat={heat}
                        bracket={bracket}
                        entrantsById={entrantsById}
                        scoring={scoring}
                        primaryColor={primaryColor}
                        youEntrantId={youEntrantId}
                      />
                      {to && (
                        <Badge variant="secondary">
                          Winner → {heatName(bracket, to)}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <ResponsiveSheetDialog
        open={reportHeat !== undefined}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        {reportHeat && (
          <HeatResultForm
            key={reportHeat.id}
            heat={reportHeat}
            bracket={bracket}
            entrantsById={entrantsById}
            scoring={scoring}
            primaryColor={primaryColor}
            submit={(result) =>
              reportHeatResult(competitionId, reportHeat.id, result)
            }
            confirmResets={false}
            successToast={() => "Result reported."}
            onSaved={close}
          />
        )}
      </ResponsiveSheetDialog>

      {reportHeat === undefined && <AutoRefresh />}
    </section>
  );
}
