"use client";

import { useState } from "react";

import { FormValueInput } from "@/components/form-value-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { normalizeHex } from "@/lib/color";

export type ColorSwatch = {
  /** `#rrggbb` */
  color: string;
  label: string;
};

/**
 * A hex color field: a swatch + hex button that opens a Popover with a hex
 * `Input` (committing on a valid hex per `normalizeHex`) and a grid of theme
 * and Team swatches.
 */
export function ColorField({
  name,
  value,
  onValueChange,
  swatches,
  id,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: {
  name?: string;
  /** `#rrggbb` */
  value: string;
  onValueChange: (hex: string) => void;
  swatches: ColorSwatch[];
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  function commit(input: string) {
    const normalized = normalizeHex(input);
    if (!normalized) {
      setError("Use a hex color like #1a2b3c.");
      return;
    }
    setError(null);
    setDraft(normalized);
    onValueChange(normalized);
  }

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
          setDraft(value);
          setError(null);
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid}
            type="button"
            variant="outline"
            className="h-11 justify-start gap-2 sm:h-9"
          />
        }
      >
        <span
          aria-hidden
          className="border-border size-5 shrink-0 rounded-full border"
          style={{ backgroundColor: value }}
        />
        <span className="font-mono text-sm">{value}</span>
      </PopoverTrigger>
      <PopoverContent className="max-w-[calc(100vw-2rem)]">
        <div className="flex flex-col gap-2">
          <Input
            value={draft}
            onChange={(event) => {
              const typed = event.target.value;
              setDraft(typed);
              const normalized = normalizeHex(typed);
              if (normalized) {
                setError(null);
                onValueChange(normalized);
              }
            }}
            onBlur={(event) => commit(event.target.value)}
            aria-label="Hex color"
            placeholder="#1a2b3c"
          />
          {error && <p className="text-destructive text-xs">{error}</p>}
          {/* Five 44px swatches per row fit the popover on a 320px phone. */}
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
            {swatches.map((swatch, index) => (
              <Button
                // Theme and Team colors can repeat.
                key={`${swatch.label}-${index}`}
                type="button"
                variant="outline"
                size="icon"
                aria-label={swatch.label}
                className="size-11 sm:size-8"
                style={{ backgroundColor: swatch.color }}
                onClick={() => {
                  setDraft(swatch.color);
                  setError(null);
                  onValueChange(swatch.color);
                }}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
      {name && <FormValueInput name={name} value={value} />}
    </Popover>
  );
}
