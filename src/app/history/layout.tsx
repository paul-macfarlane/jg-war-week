import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { WarWeekChrome } from "@/components/war-week-chrome";
import { getCurrentWarWeek } from "@/queries/war-weeks";

export const dynamic = "force-dynamic";

/** History wears the current War Week's chrome: nav, tab bar, theme, footer. */
export default async function HistoryLayout({
  children,
}: {
  children: ReactNode;
}) {
  const current = await getCurrentWarWeek();
  if (!current) notFound();
  return <WarWeekChrome warWeek={current}>{children}</WarWeekChrome>;
}
