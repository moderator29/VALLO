/**
 * THE SIGN-IN WALL, AS ONE SWITCH (STORE-P2-04).
 *
 * Whether a signed-out visitor may read the catalogue is the founder's
 * decision, not ours, so it is one server-side variable read at request time:
 *
 *   VALLO_PUBLIC_CATALOGUE=on   (also "1" or "true")
 *
 * Unset, or anything else, is the closed behaviour the product has today:
 * every catalogue screen sends a stranger to sign in.
 *
 * ON opens READ-ONLY the screens where the catalogue is browsed:
 * `/search`, `/stays` (and `/stays/search`), `/restaurants`, `/listing/<id>`,
 * `/stay/<id>` and `/restaurant/<id>`. Everything that is an account or an
 * action stays gated WHATEVER THIS SAYS, because the proxy only ever adds
 * these six first segments to the open set: `/u` and people search, messages
 * (including `/messages/new?listing=`, which creates a thread on GET), saved,
 * bookings, wallet, checkout, settings and every API route except the map's
 * pins (`PUBLIC_CATALOGUE_API_PATHS`).
 *
 * What a signed-out reader can see on those pages is decided by the database,
 * not by this switch: the `anon` role holds no SELECT on
 * `listings.address`, `businesses.address|phone|email` or
 * `accommodations.address`, so an exact address cannot reach a stranger.
 *
 * Anonymous page reads under the switch are counted per IP by the proxy
 * (`ANON_CATALOGUE_LIMIT` per `ANON_CATALOGUE_WINDOW_SECONDS`).
 */

export const PUBLIC_CATALOGUE_SEGMENTS: ReadonlySet<string> = new Set([
  "search",
  "stays",
  "restaurants",
  "listing",
  "stay",
  "restaurant",
  /* The compare page: published listings side by side, from ids in the address. */
  "compare",
]);

/** How many catalogue pages one address may open signed out per window. */
export const ANON_CATALOGUE_LIMIT = 120;
export const ANON_CATALOGUE_WINDOW_SECONDS = 300;

export function publicCatalogueEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return /^(1|true|on)$/i.test((env.VALLO_PUBLIC_CATALOGUE ?? "").trim());
}

/**
 * The one data route those pages call from the browser: the map's pins in a
 * bounding box. It carries its own per-address limit (`map_bounds`), and it
 * returns what the catalogue pages already show. No other API route opens.
 */
export const PUBLIC_CATALOGUE_API_PATHS: ReadonlySet<string> = new Set(["/api/map/listings"]);

/** Is this a page the switch opens? Matched on the first segment. */
export function isPublicCataloguePath(path: string): boolean {
  if (path === "/api" || path.startsWith("/api/")) return false;
  const [, first = ""] = path.split("/");
  return PUBLIC_CATALOGUE_SEGMENTS.has(first);
}

/** Where the native app opens (`/open`), for a caller with no session. */
export function signedOutStart(env: Record<string, string | undefined> = process.env): string {
  return publicCatalogueEnabled(env) ? "/search" : "/welcome";
}

/**
 * THE WEBSITE'S FRONT DOOR (founder, 14 November 2026: "in website there
 * should not be landing page ... that's the industry standard flow").
 *
 * A stranger who opens the website's root in a browser is taken straight to
 * the listings, the same screen the app opens on for a guest, and that screen
 * ends with the website's foot (`showsSiteFoot`). Somebody whose browser
 * carries a session goes to `/home-or-landing`, which answers `/home` for a
 * member and this same door for a session that turned out to be spent.
 *
 * Null while the public catalogue is closed (`VALLO_PUBLIC_CATALOGUE` unset):
 * the listings then need an account, so the root keeps the old front page
 * rather than sending a stranger into a sign-in wall. Marketing tags
 * (`utm_*`, `ref`) are carried; nothing else from the query is.
 */
export function websiteFrontDoor(
  input: { carriesSession: boolean; search?: URLSearchParams },
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (!publicCatalogueEnabled(env)) return null;
  if (input.carriesSession) return "/home-or-landing";
  const kept = new URLSearchParams();
  for (const [key, value] of input.search ?? []) {
    if ((/^utm_[a-z]+$/.test(key) || key === "ref") && value.length <= 120) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `/search?${query}` : "/search";
}

