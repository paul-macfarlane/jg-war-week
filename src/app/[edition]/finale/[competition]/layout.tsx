import { notFound } from "next/navigation";

import { getBracketFinalePage } from "./bracket-finale";

/**
 * Checks the Competition is a closed Bracket of this edition above any
 * `loading.tsx`: a loading boundary above a `notFound()` streams the 404 as
 * a 200, so the page itself must never be the one to call it.
 */
export default async function BracketFinaleLayout({
  params,
  children,
}: LayoutProps<"/[edition]/finale/[competition]">) {
  const { edition, competition } = await params;
  if (!(await getBracketFinalePage(edition, competition))) notFound();
  return children;
}
