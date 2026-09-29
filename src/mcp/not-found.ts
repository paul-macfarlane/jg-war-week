/** An MCP tool's answer when no Competition of the current War Week has `name`. */
export function notFoundMessage(name: string): string {
  return `No Competition named "${name}" found for the current War Week. Call get_current_war_week or ask about its Standings.`;
}
