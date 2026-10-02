/** Whether `typed` is `expected`, ignoring case and surrounding spaces. */
export function confirmTextMatches(typed: string, expected: string): boolean {
  return typed.trim().toLowerCase() === expected.trim().toLowerCase();
}
