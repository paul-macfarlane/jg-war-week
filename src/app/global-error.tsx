"use client";

import { ErrorScreen, type ErrorScreenProps } from "@/components/error-screen";
import { ThemeRoot } from "@/components/theme-root";
import { APP_NAME } from "@/lib/pwa";

import "./globals.css";

/**
 * Replaces the root layout when it fails, so it renders its own
 * `<html>` and `<body>`.
 */
export default function GlobalError(props: ErrorScreenProps) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-dvh flex-col">
        <title>{APP_NAME}</title>
        <ThemeRoot className="bg-background text-foreground flex min-h-dvh flex-col font-sans">
          <ErrorScreen {...props} />
        </ThemeRoot>
      </body>
    </html>
  );
}
