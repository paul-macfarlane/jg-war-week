/** A stable lowercase-hyphenated form of a Competition Group's name. */
export function groupTabSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The tab ?group=<slug> names; the first tab when it is unknown or missing. */
export function resolveGroupTab(
  slugs: string[],
  param: string | string[] | undefined,
): string {
  return typeof param === "string" && slugs.includes(param)
    ? param
    : (slugs[0] ?? "");
}
