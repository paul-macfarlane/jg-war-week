/** Hosts a rich-text video block may point at (YouTube, Loom, Vimeo, Drive). */
const ALLOWED_VIDEO_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "loom.com",
  "www.loom.com",
  "vimeo.com",
  "www.vimeo.com",
  "player.vimeo.com",
  "drive.google.com",
]);

/** Whether a URL is an https link to an allow-listed video host. */
export function isAllowedVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ALLOWED_VIDEO_HOSTS.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function matchPath(pathname: string, pattern: RegExp): string | null {
  const match = pathname.match(pattern);
  return match ? match[1] : null;
}

/** Ids in embed URLs are path segments; a raw `/` or `%` breaks the shape. */
const VIDEO_ID = /^[A-Za-z0-9_-]+$/;
/** Vimeo ids are always numeric. */
const VIMEO_ID = /^\d+$/;

/**
 * The iframe `src` for a rich-text video block's URL, or null when the URL
 * isn't on the allow-list (`isAllowedVideoUrl`) or doesn't point at a
 * recognized video on its host (including a host on the allow-list with an
 * unrecognized path). YouTube embeds use the `-nocookie` domain.
 */
export function videoEmbedUrl(url: string): string | null {
  if (!isAllowedVideoUrl(url)) return null;
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();

  if (
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com"
  ) {
    const id =
      parsed.searchParams.get("v") ??
      matchPath(parsed.pathname, /^\/shorts\/([^/]+)/) ??
      matchPath(parsed.pathname, /^\/embed\/([^/]+)/) ??
      matchPath(parsed.pathname, /^\/live\/([^/]+)/);
    return id && VIDEO_ID.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}`
      : null;
  }
  if (host === "youtu.be") {
    // Only the first path segment names the video; anything after it (a
    // stray segment, or an encoded `/`) is not part of the id.
    const id = parsed.pathname.replace(/^\//, "").split("/")[0];
    return id && VIDEO_ID.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}`
      : null;
  }
  if (host === "loom.com" || host === "www.loom.com") {
    const id =
      matchPath(parsed.pathname, /^\/share\/([^/]+)/) ??
      matchPath(parsed.pathname, /^\/embed\/([^/]+)/);
    return id && VIDEO_ID.test(id) ? `https://www.loom.com/embed/${id}` : null;
  }
  if (host === "vimeo.com" || host === "www.vimeo.com") {
    const id = matchPath(parsed.pathname, /^\/(\d+)/);
    return id && VIMEO_ID.test(id)
      ? `https://player.vimeo.com/video/${id}`
      : null;
  }
  if (host === "player.vimeo.com") {
    const id = matchPath(parsed.pathname, /^\/video\/(\d+)/);
    return id && VIMEO_ID.test(id)
      ? `https://player.vimeo.com/video/${id}`
      : null;
  }
  if (host === "drive.google.com") {
    const id = matchPath(parsed.pathname, /^\/file\/d\/([^/]+)/);
    return id && VIDEO_ID.test(id)
      ? `https://drive.google.com/file/d/${id}/preview`
      : null;
  }
  return null;
}

/**
 * The rich-text video iframe's fixed attributes, shared by the read-only
 * view and the editor so both draw the same player. `title` is the default;
 * the view may give each player its own (`RichText`'s `videoTitle`).
 */
export const VIDEO_IFRAME = {
  title: "Embedded video",
  allow: "fullscreen",
  loading: "lazy",
  referrerPolicy: "strict-origin-when-cross-origin",
} as const;
