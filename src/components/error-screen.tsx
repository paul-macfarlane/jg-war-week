"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";

export type ErrorScreenProps = {
  error: Error & { digest?: string };
  /** Re-fetches and re-renders the segment that failed. */
  retry: () => void;
};

/**
 * What an error boundary shows instead of Next's default screen: a short
 * message, "Try again" and a link home. The error itself goes to the
 * console; its message shows only in development, and the digest (which
 * matches the server log) always.
 */
export function ErrorScreen({ error, retry }: ErrorScreenProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-foreground/70">
        This page ran into a problem. Try again, or head back to the current War
        Week.
      </p>
      {process.env.NODE_ENV === "development" && error.message ? (
        <pre className="bg-muted w-full overflow-x-auto rounded-lg p-3 text-left text-xs whitespace-pre-wrap">
          {error.message}
        </pre>
      ) : null}
      {error.digest ? (
        <p className="text-foreground/60 text-xs">
          Reference: <code>{error.digest}</code>
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Go to the current War Week
        </Link>
      </div>
    </main>
  );
}
