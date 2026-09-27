computed color-scheme of `document.documentElement` on /xi (Matrix, background #000000):
  before: "light" -- at 136e5ba `globals.css` forced `:root { color-scheme: light }`
          and ThemeRoot's inline `colorScheme: dark` sat on a non-scrolling div
          inside <body>, so it never reached <html>. (Before ticket 14 set any
          color-scheme, the UA default "normal" applied to the themed subtree.)
  after:  "dark"

The viewport's scrollbar takes its scheme from <html>, so only the html value
decides it. The edition layout's ThemeRoot now renders
`data-color-scheme={backgroundColorScheme(background)}` (`pageColorScheme`),
and `globals.css` adds `html:has([data-color-scheme="dark"]) { color-scheme: dark; }`.
The inline `colorScheme` on ThemeRoot stays for the themed subtree. ArchiveCard
ThemeRoots don't carry the attribute, so /history stays light.

Proved by e2e/theme.spec.ts (signed in as the e2e Participant):
  - "a dark Appearance Theme makes the whole page dark, scrollbar included":
    /xi -> getComputedStyle(document.documentElement).colorScheme === "dark";
    screenshot xi-dark-scheme.png (copied here as after.png)
  - "a light Appearance Theme keeps the page light": /x (#fdf6e3) -> "light"
  - "the Archive stays light though its cards wear dark themes": /history -> "light"

Chromium headless commonly renders overlay scrollbars regardless of
color-scheme, so the computed html value above, not the pixels, is the
evidence.
