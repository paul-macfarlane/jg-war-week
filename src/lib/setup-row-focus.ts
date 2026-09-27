/** The add row's marker, in place of a row id. */
export const ADD_ROW = "add";

/**
 * Where focus goes after deleting the setup row `deletedId` from a list
 * showing `rowIds` in order: the next row, else the previous one, else
 * (the list is now empty) the add row.
 */
export function setupRowFocusTarget(
  rowIds: string[],
  deletedId: string,
): string {
  const index = rowIds.indexOf(deletedId);
  if (index === -1) return ADD_ROW;
  return rowIds[index + 1] ?? rowIds[index - 1] ?? ADD_ROW;
}
