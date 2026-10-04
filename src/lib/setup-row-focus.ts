/** The add row's marker, in place of a row id. */
export const ADD_ROW = "add";

/** Marks the add row's Add button, the focus target of an emptied list. */
export const ADD_BUTTON_ATTR = "data-setup-add";

/**
 * Where focus goes after deleting the setup row `deletedId` from a list
 * showing `rowIds` in order: the next row, else the previous one, else
 * (the list is now empty) the add row. An add row among `rowIds` isn't a
 * row to move to.
 */
export function setupRowFocusTarget(
  rowIds: string[],
  deletedId: string,
): string {
  const rows = rowIds.filter((id) => id !== ADD_ROW);
  const index = rows.indexOf(deletedId);
  if (index === -1) return ADD_ROW;
  return rows[index + 1] ?? rows[index - 1] ?? ADD_ROW;
}

/**
 * The control to focus inside the target of `setupRowFocusTarget`: the add
 * row's Add button, or null for a row's first control (its Edit button).
 */
export function setupRowFocusSelector(targetId: string): string | null {
  return targetId === ADD_ROW ? `[${ADD_BUTTON_ATTR}]` : null;
}
