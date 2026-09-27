"use client";

import { ErrorScreen, type ErrorScreenProps } from "@/components/error-screen";
import { ThemeRoot } from "@/components/theme-root";

// No `admin/loading.tsx` on purpose: a loading boundary above a page that
// calls `notFound()` streams its 404 as a 200 (a bad id's page would answer
// 200). See `.scratch/custom-inputs/execution.md`.

/** Admin pages theme themselves in `AdminShell`; this sits outside it. */
export default function AdminError(props: ErrorScreenProps) {
  return (
    <ThemeRoot className="bg-background text-foreground flex min-h-dvh flex-col font-sans">
      <ErrorScreen {...props} />
    </ThemeRoot>
  );
}
