/** What a click on a link tells us, read off the event and its `<a>`. */
export type LinkClick = {
  /** The link's resolved `href`. */
  href: string;
  /** The link's `target` attribute, or blank. */
  target: string;
  /** The link has a `download` attribute. */
  download: boolean;
  /** The mouse button: 0 is the main one. */
  button: number;
  /** Ctrl, Meta, Shift or Alt was held (a new tab or window). */
  modified: boolean;
  /** Something already handled the click. */
  defaultPrevented: boolean;
};

/**
 * The in-app path a click on a link would leave `here` for, or null when
 * the click doesn't leave this page in this tab: another site, a new tab
 * or window, a download, a click already handled, or this same page.
 */
export function leavingHref(click: LinkClick, here: string): string | null {
  if (click.defaultPrevented || click.button !== 0 || click.modified) {
    return null;
  }
  if (click.download || (click.target && click.target !== "_self")) {
    return null;
  }
  const from = new URL(here);
  const to = new URL(click.href, from);
  if (to.origin !== from.origin) return null;
  if (to.pathname === from.pathname && to.search === from.search) return null;
  return `${to.pathname}${to.search}${to.hash}`;
}
