/**
 * Which tapped links are worth fetching whole before the tap completes
 * (`components/app/IntentPrefetch.tsx`): the public catalogue's detail pages,
 * same origin, by uuid. Anything else answers null and is left to the router's
 * own prefetch.
 */
const DETAIL = /^\/(listing|stay|restaurant)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i;

export function intentPrefetchHref(href: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (!DETAIL.test(url.pathname)) return null;
  return `${url.pathname}${url.search}`;
}
