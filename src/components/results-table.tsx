"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Trophy,
} from "lucide-react";
import {
  Fragment,
  type ReactNode,
  useId,
  useState,
  useSyncExternalStore,
} from "react";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatPoints, formatPointsLabel } from "@/lib/points";
import {
  DEFAULT_RESULTS_SORT,
  PROVISIONAL_TEXT,
  type ResultsColumn,
  type ResultsSort,
  ariaSortFor,
  nextResultsSort,
  showsScore,
  sortResults,
  winnerKeys,
} from "@/lib/results-table";

/**
 * The "Provisional" badge: a button, so Tab, a tap and hover all open its
 * tooltip, which says the points become final at Close.
 */
export function ProvisionalBadge() {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        type="button"
        closeOnClick={false}
        // A tap opens it too: touch gives no hover, and the tooltip
        // closes again on a tap elsewhere (the trigger loses focus).
        onClick={() => setOpen(true)}
        className={badgeVariants({ variant: "outline" })}
      >
        Provisional
      </TooltipTrigger>
      <TooltipContent>{PROVISIONAL_TEXT}</TooltipContent>
    </Tooltip>
  );
}

/** One row of a results table: values only, never "Score x" text. */
export type ResultsTableRow = {
  /** Stable and unique within the table. */
  key: string;
  /** The row's place; null when it has none yet (shown "–", sorted last). */
  rank: number | null;
  name: string;
  /** Before the name: an Avatar or a Team's color dot. */
  lead?: ReactNode;
  /** Right after the name: the "You" tag. */
  after?: ReactNode;
  /** A line under the name: a Participant's Team. */
  detail?: ReactNode;
  score?: number | null;
  /** War Week points; null when the row earns none. */
  points: number | null;
  /**
   * A sub-row the row opens and closes (a points breakdown, a person's
   * other Attempts). `label` names the toggle for screen readers;
   * `visibleLabel`, when given, is shown on it ("3 more attempts").
   */
  expansion?: { label: string; visibleLabel?: string; content: ReactNode };
  /** Extra classes for the row, e.g. the "You" highlight. */
  className?: string;
};

/** Below Tailwind's `sm`, where the points fold under the name. */
const FOLDED_QUERY = "(max-width: 39.99rem)";

function subscribeFolded(onChange: () => void) {
  const query = window.matchMedia(FOLDED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the points column is folded under the name. The CSS does the
 * folding; this only moves the points sort's `aria-sort` to the header the
 * folded column's sort button sits in.
 */
function useFolded(): boolean {
  return useSyncExternalStore(
    subscribeFolded,
    () => window.matchMedia(FOLDED_QUERY).matches,
    () => false,
  );
}

function formatScore(score: number): string {
  return score.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

function SortIcon({ state }: { state: "ascending" | "descending" | "none" }) {
  if (state === "ascending") return <ArrowUp aria-hidden />;
  if (state === "descending") return <ArrowDown aria-hidden />;
  return <ArrowUpDown aria-hidden className="opacity-50" />;
}

function SortButton({
  column,
  sort,
  onSort,
  end = false,
  children,
}: {
  column: ResultsColumn;
  sort: ResultsSort;
  onSort: (column: ResultsColumn) => void;
  /** In a right-aligned column: line up with the cells' right edge. */
  end?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`${end ? "-mr-2.5" : "-ml-2.5"} h-auto min-h-7 py-1 whitespace-normal`}
      onClick={() => onSort(column)}
    >
      {children}
      <SortIcon state={ariaSortFor(sort, column)} />
    </Button>
  );
}

/**
 * The one results table (spec R20, decision 1), on the shadcn `Table`:
 * Rank · Participant or Team · Score (unit) · War Week points. The Score
 * column is left out when no row has a Score. Every header sorts (its
 * `aria-sort` set), Rank first by default. Every first place is the
 * Winner: highlighted, with a mark and the word. Below `sm` the points
 * fold under the name (with their own sort button), so the page never
 * scrolls sideways and nothing is dropped.
 */
export function ResultsTable({
  rows,
  label,
  entrantHeader,
  scoreUnit,
  pointsHeader = "War Week points",
  provisional = false,
}: {
  rows: ResultsTableRow[];
  /** The table's accessible name. */
  label: string;
  /** "Participant", or the War Week's Team Label. */
  entrantHeader: string;
  /** The Score's unit, shown in its header: "Score (kg)". */
  scoreUnit?: string | null;
  pointsHeader?: string;
  /** Points not final yet: the points header shows the Provisional badge. */
  provisional?: boolean;
}) {
  const [sort, setSort] = useState<ResultsSort>(DEFAULT_RESULTS_SORT);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const id = useId();
  const folded = useFolded();
  const onSort = (column: ResultsColumn) =>
    setSort((current) => nextResultsSort(current, column));
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const withScore = showsScore(rows);
  const winners = winnerKeys(rows);
  const columnCount = withScore ? 4 : 3;
  const scoreHeader = scoreUnit ? `Score (${scoreUnit})` : "Score";
  const pointsSort = (end: boolean) => (
    <span
      className={`flex flex-wrap items-center gap-x-1 gap-y-0.5 ${end ? "justify-end" : ""}`}
    >
      <SortButton column="points" sort={sort} onSort={onSort} end={end}>
        {pointsHeader}
      </SortButton>
      {provisional ? <ProvisionalBadge /> : null}
    </span>
  );

  return (
    <Table aria-label={label} className="table-fixed sm:table-auto">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead aria-sort={ariaSortFor(sort, "rank")} className="w-14">
            <SortButton column="rank" sort={sort} onSort={onSort}>
              Rank
            </SortButton>
          </TableHead>
          <TableHead
            aria-sort={
              folded && sort.column === "points"
                ? sort.direction
                : ariaSortFor(sort, "name")
            }
            className="h-auto py-1 whitespace-normal"
          >
            <SortButton column="name" sort={sort} onSort={onSort}>
              {entrantHeader}
            </SortButton>
            {/* Below `sm` the points column folds in here. */}
            <span className="sm:hidden">{pointsSort(false)}</span>
          </TableHead>
          {withScore ? (
            <TableHead
              aria-sort={ariaSortFor(sort, "score")}
              className="w-24 text-right whitespace-normal sm:w-auto"
            >
              <SortButton column="score" sort={sort} onSort={onSort} end>
                {scoreHeader}
              </SortButton>
            </TableHead>
          ) : null}
          <TableHead
            aria-sort={ariaSortFor(sort, "points")}
            className="hidden h-auto py-1 text-right sm:table-cell"
          >
            {pointsSort(true)}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortResults(rows, sort).map((row) => {
          const winner = winners.has(row.key);
          const open = expanded.has(row.key);
          const expansionId = `${id}-${row.key}`;
          const points = row.points === null ? "–" : formatPoints(row.points);
          return (
            <Fragment key={row.key}>
              <TableRow
                data-slot="results-row"
                data-winner={winner || undefined}
                className={`${winner ? "bg-primary/10 hover:bg-primary/15" : ""} ${row.className ?? ""}`}
              >
                <TableCell className="align-top font-medium tabular-nums">
                  <span className="flex items-center gap-1">
                    {row.rank ?? "–"}
                    {winner ? (
                      <Trophy aria-hidden className="text-primary size-4" />
                    ) : null}
                  </span>
                </TableCell>
                <th
                  scope="row"
                  className="p-2 text-left align-top font-normal whitespace-normal"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    {row.lead}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex min-w-0 flex-wrap items-center gap-1">
                        <span
                          data-slot="results-name"
                          className="font-medium break-words"
                        >
                          {row.name}
                        </span>
                        {row.after}
                        {winner ? <Badge>Winner</Badge> : null}
                      </span>
                      {row.detail ? (
                        <span className="text-foreground/70 text-xs">
                          {row.detail}
                        </span>
                      ) : null}
                      <span
                        data-slot="results-points-folded"
                        className="text-xs font-semibold tabular-nums sm:hidden"
                      >
                        {row.points === null
                          ? "No points"
                          : formatPointsLabel(row.points)}
                      </span>
                    </div>
                    {row.expansion ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size={row.expansion.visibleLabel ? "xs" : "icon-xs"}
                        aria-expanded={open}
                        aria-controls={expansionId}
                        aria-label={
                          row.expansion.visibleLabel
                            ? undefined
                            : row.expansion.label
                        }
                        onClick={() => toggle(row.key)}
                      >
                        {row.expansion.visibleLabel ? (
                          <>
                            {row.expansion.visibleLabel}
                            <span className="sr-only">
                              {" "}
                              ({row.expansion.label})
                            </span>
                          </>
                        ) : null}
                        <ChevronDown
                          aria-hidden
                          className={`transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </Button>
                    ) : null}
                  </div>
                </th>
                {withScore ? (
                  <TableCell className="text-right align-top tabular-nums">
                    {row.score === null || row.score === undefined
                      ? ""
                      : formatScore(row.score)}
                  </TableCell>
                ) : null}
                <TableCell
                  data-slot="results-points"
                  className="hidden text-right align-top font-semibold tabular-nums sm:table-cell"
                >
                  {points}
                </TableCell>
              </TableRow>
              {row.expansion ? (
                <TableRow
                  id={expansionId}
                  hidden={!open}
                  className="hover:bg-transparent"
                >
                  <TableCell
                    colSpan={columnCount}
                    data-slot="results-expansion"
                    className="whitespace-normal"
                  >
                    {row.expansion.content}
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
