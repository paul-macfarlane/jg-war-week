import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, following it as it changes. On the
 * server and during hydration it is `serverSnapshot` (default `false`), so
 * a caller can tell "not mounted yet" apart by passing `null`.
 */
export function useMediaQuery<S = false>(
  query: string,
  serverSnapshot: S = false as S,
): boolean | S {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore<boolean | S>(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverSnapshot,
  );
}
