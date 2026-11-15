/**
 * WHERE THE WEBSITE'S FOOT IS DRAWN INSIDE THE PRODUCT (founder, 14 November
 * 2026: "no landing page ... that's how the best sites are ... but the down
 * would still have our infos").
 *
 * A stranger who opens the website lands in the listings, not on a marketing
 * page, and the page still ends with the company, the links, the store badges
 * and the legal line. That foot belongs under the browsing pages a stranger
 * arrives on, where the list comes to an end. It does not belong on the map
 * (a full-height surface with nothing "under" it), on a listing (its own
 * sticky bar owns the bottom of the screen) or on any screen that needs an
 * account. Pure, so the shell and the tests share it.
 */
const FOOT_ROUTES: ReadonlySet<string> = new Set(["/search", "/stays", "/restaurants"]);

export function showsSiteFoot(pathname: string | null | undefined, view?: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.replace(/\/+$/, "") || "/";
  if (!FOOT_ROUTES.has(path)) return false;
  return view !== "map";
}
