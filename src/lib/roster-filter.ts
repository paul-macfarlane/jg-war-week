/** The roster search: a case-insensitive substring of the name or the email. */
export function filterRoster<
  T extends { displayName: string; email: string | null },
>(participants: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return participants;
  return participants.filter(
    (p) =>
      p.displayName.toLowerCase().includes(needle) ||
      (p.email ?? "").toLowerCase().includes(needle),
  );
}

/** "12 of 100", or "No one matches 'zz'" when the search finds no one. */
export function rosterCountText(
  shown: number,
  total: number,
  query: string,
): string {
  if (shown === 0 && total > 0) return `No one matches '${query.trim()}'`;
  return `${shown} of ${total}`;
}
