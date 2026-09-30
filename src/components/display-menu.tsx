"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DISPLAY_CHANGE_EVENT,
  DISPLAY_STORAGE_KEY,
  type Display,
  parseDisplay,
} from "@/lib/display";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const satisfies readonly {
  value: Display;
  label: string;
  icon: typeof Sun;
}[];

/** Applies a Display to `<html>` (System: no attribute). */
function applyDisplay(display: Display) {
  const html = document.documentElement;
  if (display === "system") delete html.dataset.display;
  else html.dataset.display = display;
}

function subscribe(onChange: () => void) {
  // Another tab changed the Display: the page follows, not only the control.
  const onStorage = (event: StorageEvent) => {
    if (event.key === DISPLAY_STORAGE_KEY) {
      applyDisplay(parseDisplay(event.newValue));
    }
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(DISPLAY_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DISPLAY_CHANGE_EVENT, onChange);
  };
}

function readDisplay(): Display {
  try {
    return parseDisplay(window.localStorage.getItem(DISPLAY_STORAGE_KEY));
  } catch {
    // Storage blocked: the Display this page applied is the one it shows.
    const applied = document.documentElement.dataset.display;
    return applied === "light" || applied === "dark" ? applied : "system";
  }
}

/** Stores the Display and applies it to `<html>`. */
function chooseDisplay(display: Display) {
  try {
    window.localStorage.setItem(DISPLAY_STORAGE_KEY, display);
  } catch {
    // Storage refused (private mode): the choice lasts until reload.
  }
  applyDisplay(display);
  window.dispatchEvent(new Event(DISPLAY_CHANGE_EVENT));
}

/**
 * The viewer's Display: Light, Dark or System, remembered in this browser.
 * `iconOnly` hides the labels (the desktop header); each item keeps its
 * accessible name either way.
 */
export function DisplayMenu({
  iconOnly = false,
  className,
}: {
  iconOnly?: boolean;
  className?: string;
}) {
  const display = useSyncExternalStore(
    subscribe,
    readDisplay,
    () => "system" as const,
  );

  return (
    <ToggleGroup
      aria-label="Display"
      variant="outline"
      spacing={0}
      value={[display]}
      onValueChange={(value) => {
        // Single-select and never empty: pressing the current item keeps it.
        const next = value[0];
        if (next) chooseDisplay(parseDisplay(next));
      }}
      className={className}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={label}
          className={cn("h-11 min-w-11 sm:h-8 sm:min-w-8", !iconOnly && "px-3")}
        >
          <Icon aria-hidden />
          {!iconOnly && label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
