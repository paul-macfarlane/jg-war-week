"use client";

import { ErrorScreen, type ErrorScreenProps } from "@/components/error-screen";

// Renders inside the edition layout, so the War Week's theme and navigation
// stay in place around it.
export default function EditionError(props: ErrorScreenProps) {
  return <ErrorScreen {...props} />;
}
