computed color-scheme (before):
  document.documentElement: "normal" (always the :root default; the app never toggles the .dark class)
  ThemeRoot's themed element: "normal"

computed color-scheme (after):
  document.documentElement: "light" (always the :root default; the app never toggles the .dark class)
  ThemeRoot's themed element: "dark"

Chromium headless commonly renders overlay scrollbars regardless of
color-scheme, so the themed element's computed value above is the
evidence that warWeekThemeStyle now sets color-scheme: dark for a dark
Appearance Theme (Matrix, on /xi), reaching every native control inside
the themed subtree (dropdowns, inner scroll areas, dialogs).

document.documentElement's own color-scheme is always the `:root` default
("light" per `globals.css`) both before and after, because this app never
toggles the `.dark` class (there is no OS/system dark-mode switch here) --
only the per-War-Week Appearance Theme, applied as inline style on
ThemeRoot's own element, changes. Before this ticket, `warWeekThemeStyle`
set no `color-scheme` at all, so the themed element's computed value fell
back to the UA default ("normal"); after, it is explicitly "dark" for a
dark background like War Week XI's Matrix theme.
