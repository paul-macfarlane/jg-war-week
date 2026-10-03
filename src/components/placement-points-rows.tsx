"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  FieldDescription,
  FieldError,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MAX_PLACEMENTS, placementLabel } from "@/lib/competitions";
import {
  QUICK_FILL,
  placementPointsFromRows,
  placementRowErrors,
  rowsFromPlacementPoints,
} from "@/lib/placement-rows";

/**
 * Placement Points as numbered rows (1st, 2nd…), up to five, with a
 * 5 · 3 · 1 quick fill and live errors. `value` is the same comma-separated
 * text the Competition action already validates. `invalid` marks every
 * row when the server refused the Placement Points.
 */
export function PlacementPointsRows({
  value,
  invalid = false,
  onChange,
}: {
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const [rows, setRowsState] = useState(() => rowsFromPlacementPoints(value));
  // Tracks the last `value` this render saw, so the rows only resync when
  // the form actually resets `value` out from under them (typing or adding
  // a blank row also changes `value`, via our own `onChange` below, but
  // that's not a reset). Comparing canonicalized forms keeps a
  // non-canonical `value` (e.g. "5,3,1") from mismatching itself forever.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    const isReset =
      value === "" ||
      placementPointsFromRows(rows) !==
        placementPointsFromRows(rowsFromPlacementPoints(value));
    if (isReset) setRowsState(rowsFromPlacementPoints(value));
  }

  function setRows(next: string[]) {
    setRowsState(next);
    onChange(placementPointsFromRows(next));
  }

  const errors = placementRowErrors(rows);

  return (
    <FieldSet className="min-w-0 gap-2">
      <FieldLegend variant="label" className="mb-1">
        Placement Points
      </FieldLegend>
      {rows.length === 0 ? (
        <FieldDescription>
          None. Add places, 1st first, or use 5 · 3 · 1.
        </FieldDescription>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((row, index) => {
            const label = placementLabel(index + 1);
            return (
              <li key={index} className="flex items-center gap-2">
                <span className="w-8 text-sm font-medium tabular-nums">
                  {label}
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  aria-label={`${label} place Placement Points`}
                  aria-invalid={invalid || undefined}
                  className="border-border h-11 w-28 sm:h-9"
                  value={row}
                  onChange={(event) =>
                    setRows(
                      rows.map((r, i) =>
                        i === index ? event.target.value : r,
                      ),
                    )
                  }
                />
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        {rows.length < MAX_PLACEMENTS && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setRows([...rows, ""])}
            className="min-h-11 sm:min-h-9"
          >
            Add place
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={rows.length === 0}
          className="min-h-11 sm:min-h-9"
          onClick={() => setRows(rows.slice(0, -1))}
        >
          Remove last
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-label="Fill 5, 3, 1"
          className="min-h-11 sm:min-h-9"
          onClick={() => setRows([...QUICK_FILL])}
        >
          5 · 3 · 1
        </Button>
      </div>
      <FieldError
        aria-live="polite"
        errors={errors.map((message) => ({ message }))}
      />
    </FieldSet>
  );
}
