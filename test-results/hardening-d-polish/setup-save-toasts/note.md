already fixed; closed

`src/components/days-editor.tsx` already calls `useSetupRow(..., "Day saved", ...)`,
which toasts `toast.success("Day saved")` on a successful save (custom-inputs
Phase B). No code change made for this item; before.png and after.png are
identical because the behavior was already correct.
