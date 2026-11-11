/**
 * THE BRAND ICON VERSION (10 November 2026, the brand refresh).
 *
 * The icons and launch images live at the same paths as before, so a phone, a
 * browser and the service worker would keep serving the old ones. Every address
 * that names one carries this value as `?v=`, and the service worker's cache
 * version moved from v8 to v9 with it. Change it whenever an icon is redrawn.
 */
export const ICON_VERSION = "20261111";

/** An icon or launch image address with the cache-busting version added. */
export function versioned(path: string): string {
  return `${path}?v=${ICON_VERSION}`;
}
