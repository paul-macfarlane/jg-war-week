Evidence-only staging: no real /xi/teams row is narrow enough on its
own to force a clip (the roster row's flex-wrap moves a whole badge to
its own line instead of shrinking it). To isolate and prove the Badge
component's own clip-vs-wrap CSS, the Leader's row (`<li>`) was given a
fixed 220px width, `overflow: hidden` and `white-space: nowrap` via an
inline style set from the test script (DOM-only, never touching app
code), after temporarily lengthening War Week XI's real Leader Title
to "Distinguished Expedition Leader" in the database (restored after).
Before: the Badge's own `overflow-hidden` + `whitespace-nowrap` clips
the title mid-word. After: `h-auto min-h-5 whitespace-normal` lets the
Badge wrap onto more than one line inside the same 220px row instead.
