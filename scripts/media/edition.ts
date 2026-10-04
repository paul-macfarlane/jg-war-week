/** The edition `--edition <slug>` names (default `xii`), lower-cased. */
export function requestedEdition(argv: string[]): string {
  const flag = argv.indexOf("--edition");
  const value = flag === -1 ? undefined : argv[flag + 1];
  if (flag !== -1 && (!value || value.startsWith("--"))) {
    throw new Error("--edition needs a value, e.g. `--edition xii`");
  }
  return (value ?? "xii").toLowerCase();
}

/**
 * Fails, telling the runner which demo seed to load, unless the War Week `/`
 * resolves to is the requested edition.
 */
export function assertEdition(current: string, requested: string): void {
  if (current.toLowerCase() === requested.toLowerCase()) return;
  throw new Error(
    `/ resolves to War Week ${current}, not the requested ${requested}: run \`pnpm seed:demo:${requested}\` first (or pass --edition ${current})`,
  );
}
