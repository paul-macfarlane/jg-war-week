already fixed; closed

`src/components/rich-text-editor.tsx` already wires each toolbar button's
`aria-pressed` to its mark/node's active state (`instance?.isActive(...)`),
and `aria-pressed:bg-muted` gives it a visible pressed background. No code
change made for this item; before.png and after.png are identical because
the behavior was already correct.
