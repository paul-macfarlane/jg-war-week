import { notFound } from "next/navigation";

import { getCompetitionPage } from "./competition";

/**
 * Checks the Competition exists above this segment's `loading.tsx`: a
 * loading boundary above a `notFound()` streams the 404 as a 200, so the
 * page itself must never be the one to call it.
 */
export default async function CompetitionLayout({
  params,
  children,
}: LayoutProps<"/[edition]/competitions/[id]">) {
  const { edition, id } = await params;
  if (!(await getCompetitionPage(edition, id))) notFound();
  return children;
}
