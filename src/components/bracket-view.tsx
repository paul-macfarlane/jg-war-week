"use client";

import Link from "next/link";
import { useState } from "react";

import { reportHeatResult } from "@/actions/heat-reports";
import { AutoRefresh } from "@/components/auto-refresh";
import { BracketTree } from "@/components/bracket-tree";
import {
  type BracketViewEntrant,
  EntrantMark,
} from "@/components/entrant-mark";
import { HeatResultForm } from "@/components/heat-result-form";
import { ResponsiveSheetDialog } from "@/components/responsive-sheet-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useYou } from "@/components/you";
import { isHeadToHead } from "@/lib/bracket/config";
import { isBye } from "@/lib/bracket/formats";
import { advancesFromPlace } from "@/lib/bracket/tree";
import type { Bracket, Heat } from "@/lib/bracket/types";
import {
  type NextHeat,
  entrantForYou,
  formatRecordedAt,
  groupRounds,
  heatName,
  isDecided,
  nextHeatFor,
} from "@/lib/bracket/view";
import { YOU_ROW_CLASS } from "@/lib/you";

type Scoring = "team" | "individual";

/** The "You" pill beside Your Entrant. */
export function YouMark() {
  return (
    <span
      data-you
      className="bg-accent text-accent-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
    >
      You
    </span>
  );
}

/** What fills `slot` of `heat`: a Heat's winner, or a semifinal's loser. */
function feederLabel(bracket: Bracket, heat: Heat, slot: number) {
  const winner = bracket.heats.find(
    (h) => h.winnerTo?.heatId === heat.id && h.winnerTo.slot === slot,
  );
  if (winner) return heatName(bracket, winner);
  const loser = bracket.heats.find(
    (h) => h.loserTo?.heatId === heat.id && h.loserTo.slot === slot,
  );
  return loser ? `${heatName(bracket, loser)}'s loser` : null;
}

/** "A", "A and B", "A, B and C". */
function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * A Heat's places: each Entrant with its mark and score. A
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
    !isHeadToHead(bracket.config) &&
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
          const feeder = feederLabel(bracket, heat, i);
          return (
            <li
              key={i}
              className="text-foreground/60 flex min-h-8 items-center px-1 italic"
            >
              {bye ? "Bye" : feeder ? `Waiting for ${feeder}` : "Waiting"}
            </li>
          );
        }
        const advances = !bye && advancesFromPlace(bracket, heat, slot.place);
        return (
          <li
            key={i}
            data-advances={advances ? "" : undefined}
            className={`flex min-h-8 min-w-0 items-center gap-2 px-1 ${YOU_ROW_CLASS}`}
          >
            {ranked && (
              <span
                aria-label={`Place ${slot.place}`}
                className={`w-5 shrink-0 text-right text-sm tabular-nums ${advances ? "text-primary font-bold" : "text-foreground/60"}`}
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
                  className={`min-w-0 truncate ${advances ? "font-semibold" : decided ? "text-foreground/70" : ""}`}
                >
                  {entrant.label}
                </span>
                <span className="text-foreground/60 min-w-0 text-xs break-words">
                  {entrant.participantNames.join(", ")}
                </span>
              </span>
            ) : (
              <span
                className={`min-w-0 truncate ${advances ? "font-semibold" : decided ? "text-foreground/70" : ""}`}
              >
                {entrant.label}
              </span>
            )}
            {advances && !ranked && (
              <span aria-label="Winner" className="text-primary font-bold">
                ✓
              </span>
            )}
            {entrant.id === youEntrantId && <YouMark />}
            {slot.score && (
              <span
                className={`ml-auto shrink-0 tabular-nums ${advances ? "font-semibold" : ""}`}
              >
                {slot.score}
              </span>
            )}
          </li>
        );
      })}
      {bye && !isHeadToHead(bracket.config) && (
        <li className="text-foreground/60 flex min-h-8 items-center px-1 italic">
          Bye — advances
        </li>
      )}
    </ul>
  );
}

/**
 * The "Your next Heat" card (props only): the Heat You play next and
 * against whom, or the Round You advanced to. `canReport` adds **Report
 * result** (the server found the Heat reportable by You, known by account
 * linking).
 */
export function YourNextHeatCard({
  next,
  bracket,
  entrantsById,
  canReport,
  onReport,
}: {
  next: NextHeat;
  bracket: Bracket;
  entrantsById: Map<string, BracketViewEntrant>;
  canReport: boolean;
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

type BracketLayout = "tree" | "list";

/**
 * The Competition page's Bracket: the champion and Your next Heat pinned on
 * top, then the Bracket as a tree (the default) or, with the List toggle, a
 * vertical list of Heats grouped by Round with (single elimination)
 * "Winner → …" chips; Your Entrant highlighted under the You rules. Owns
 * the report Sheet (a centered Dialog on large screens), and refreshes
 * live while it's closed (a Bracket not drawn yet too, so the draw
 * appears).
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
  /** The Bracket Finale, once the Bracket is finalized; null before. */
  finaleHref: string | null;
  selfReport: BracketViewSelfReport;
}) {
  const you = useYou();
  const [reporting, setReporting] = useState<string | null>(null);
  const [layout, setLayout] = useState<BracketLayout>("tree");
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
  const winner = champion ? entrantsById.get(champion) : undefined;
  const heatsById = new Map(bracket.heats.map((h) => [h.id, h]));
  const canReport =
    selfReport.on &&
    you?.participantId === selfReport.linkedParticipantId &&
    next?.kind === "heat" &&
    next.heat.id === selfReport.reportableHeatId;
  const reportHeat = reporting ? heatsById.get(reporting) : undefined;
  const close = () => setReporting(null);
  const squadHelp = entrants.some((e) => e.squadId) ? (
    <p className="text-foreground/70 text-sm">
      <span className="font-medium">Squad</span>: a pair or group from one Team,
      playing as one entrant
    </p>
  ) : null;

  if (bracket.heats.length === 0) {
    return (
      <section className="flex flex-col gap-2" aria-label="Bracket">
        <h2 className="text-lg font-semibold">Bracket</h2>
        {squadHelp}
        <p className="text-foreground/70 text-sm">
          The Bracket hasn&apos;t been drawn yet.
        </p>
        <AutoRefresh />
      </section>
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="Bracket">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Bracket</h2>
        <Tabs
          value={layout}
          onValueChange={(value) => setLayout(value as BracketLayout)}
        >
          <TabsList aria-label="Bracket view" className="h-11 sm:h-8">
            <TabsTrigger value="tree" className="px-3">
              Tree
            </TabsTrigger>
            <TabsTrigger value="list" className="px-3">
              List
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {squadHelp}

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
          canReport={canReport}
          onReport={() => {
            if (next.kind === "heat") setReporting(next.heat.id);
          }}
        />
      )}

      {layout === "tree" ? (
        <BracketTree
          bracket={bracket}
          entrantsById={entrantsById}
          scoring={scoring}
          primaryColor={primaryColor}
          youEntrantId={youEntrantId}
        />
      ) : (
        <div className="flex flex-col gap-4">
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
                    isHeadToHead(bracket.config) && heat.winnerTo
                      ? heatsById.get(heat.winnerTo.heatId)
                      : undefined;
                  const loserTo = heat.loserTo
                    ? heatsById.get(heat.loserTo.heatId)
                    : undefined;
                  return (
                    <li key={heat.id}>
                      <Card size="sm">
                        <CardContent className="flex min-w-0 flex-col gap-2">
                          <span className="text-foreground/60 text-xs font-medium">
                            {heatName(bracket, heat)}
                          </span>
                          {heat.recordedAt && (
                            <span className="text-foreground/70 text-xs">
                              {formatRecordedAt(heat.recordedAt)}
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
                          {loserTo && (
                            <Badge variant="outline">
                              Loser → {heatName(bracket, loserTo)}
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
        </div>
      )}

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
