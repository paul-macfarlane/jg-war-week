/**
 * The viewer's Display: Light, Dark or System. Stored per browser in
 * `localStorage` and applied as `html[data-display]` (absent for System,
 * which `globals.css` resolves from `prefers-color-scheme`).
 */
export type Display = "light" | "dark" | "system";

export const DISPLAY_STORAGE_KEY = "ww:display";

/** Fired on `window` when this tab changes the Display. */
export const DISPLAY_CHANGE_EVENT = "ww:display-change";

/** A stored value as a Display; anything but light, dark or system is System. */
export function parseDisplay(stored: string | null): Display {
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

/**
 * Runs in `<head>` before the body paints, so a stored Light or Dark never
 * flashes the other scheme. A throwing `localStorage` means System.
 */
export const DISPLAY_SCRIPT = `try{var d=localStorage.getItem(${JSON.stringify(DISPLAY_STORAGE_KEY)});if(d==="light"||d==="dark")document.documentElement.dataset.display=d}catch(e){}`;
