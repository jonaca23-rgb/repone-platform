const BASE = "http://same.site";

/**
 * Returns `next` only if it is a path on this site, otherwise `fallback`.
 * Used for post-login redirects (`?next=`), where `${origin}${next}` with
 * next = "@evil.com" or "//evil.com" would send the user to another host.
 */
export function safeNextPath(next: string | null, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  const url = new URL(next, BASE);
  if (url.origin !== BASE) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
