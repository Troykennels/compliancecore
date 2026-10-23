/**
 * Turns a stored notification target into something React Router can navigate.
 *
 * Some jobs recorded `actionUrl` as an ABSOLUTE url built from FRONTEND_URL or
 * APP_URL. React Router v6 treats any string that does not start with "/" as a
 * RELATIVE path, so navigating to "http://localhost:5173/expiry" produced
 * something like "/dashboard/http:/localhost:5173/expiry", matched the catch-all
 * route, and dumped the user on the dashboard. Clicking an expiry or calendar
 * reminder simply never opened the thing it was about.
 *
 * The jobs now store relative paths, but rows written before that fix are
 * already in customers' databases and will keep arriving in their bell for
 * weeks — so the reading side has to cope rather than assume.
 */
export function toAppPath(actionUrl: string | null | undefined): string | null {
  if (!actionUrl) return null;

  const trimmed = actionUrl.trim();
  if (!trimmed) return null;

  // Already an in-app path.
  if (trimmed.startsWith('/')) {
    try {
      const url = new URL(trimmed, window.location.origin);
      if (url.origin !== window.location.origin) return null;
      return `${url.pathname.replace(/^\/app(?=\/|$)/, '') || '/dashboard'}${url.search}${url.hash}`;
    } catch { return null; }
  }

  // Absolute URL: keep only the part after the origin. Anything pointing at a
  // different host is not ours to navigate to internally, so it is dropped
  // rather than turned into a bogus internal route.
  try {
    const url = new URL(trimmed);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname.replace(/^\/app(?=\/|$)/, '') || '/dashboard'}${url.search}${url.hash}`;
  } catch {
    // Not a URL and not a path — a bare word like "expiry". Treat it as a path
    // so it at least resolves from the root rather than the current route.
    return /^[a-z][a-z0-9/-]*(?:[?#].*)?$/i.test(trimmed) ? `/${trimmed}` : null;
  }
}
