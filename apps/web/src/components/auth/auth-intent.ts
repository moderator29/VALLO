/**
 * What somebody was trying to do when we stopped them, as a URL.
 *
 * A signed-out visitor may READ all of Vallo: the listings, discovery, the
 * map, a property page. They may not DO anything. Every action gates, and the
 * gate has one job beyond asking them to sign in, which is the job that
 * everybody gets wrong: it must put them back where they were, doing what they
 * were doing. A save that becomes "welcome to your home screen" is a save that
 * did not happen and a person who has to start again.
 *
 * So the intent travels as two ordinary query parameters and nothing else. No
 * store, no cookie, no session-scoped draft:
 *
 *   /listing/abc?q=lekki                 the screen they were on
 *   /listing/abc?q=lekki&do=save         the same screen, plus the verb
 *   /sign-up?next=%2Flisting%2Fabc%3F... the door, carrying the whole thing
 *
 * A URL survives a full page load, an email confirmation round trip, a browser
 * restart and the back button, which is more than any of the alternatives can
 * say. It is also inspectable, which is why the surfaces that honour an intent
 * treat it as a HINT rather than as a command: `do=pay` reopens the payment
 * panel, it never charges anybody. Nothing here authorises anything.
 *
 * Pure and framework free so it can be tested directly, and so the server
 * routes and the client components read one implementation.
 */

/** The query parameter carrying the verb, kept short because it is user visible. */
export const INTENT_PARAM = "do";

/** The query parameter carrying the destination, matching the auth routes. */
export const NEXT_PARAM = "next";

/**
 * Every action a signed-out person may not take.
 *
 * A closed union rather than a free string, so a call site cannot invent
 * `"favourite"` and quietly fall through the copy table into an unlabelled
 * prompt. Adding one means adding its sentence, which is the correct amount of
 * friction.
 *
 * There is no `wallet`: Vallo holds no customer money (ADR-0002, D48), so
 * there is no wallet to return anybody to, and `?do=wallet` reads as nothing.
 */
export const GATED_ACTIONS = [
  "save",
  "message",
  "inspect",
  "pay",
  "list",
  "switch-profile",
  "follow",
  "react",
  "post",
  "share",
] as const;

export type GatedAction = (typeof GATED_ACTIONS)[number];

export function isGatedAction(value: string | null | undefined): value is GatedAction {
  return typeof value === "string" && (GATED_ACTIONS as readonly string[]).includes(value);
}

/**
 * The screen to come back to, with the verb attached.
 *
 * `search` is whatever was already in the address bar, kept in full: somebody
 * saving from a filtered result set must land back on those results and not on
 * an unfiltered page that no longer contains the card they tapped.
 *
 * A pathname that does not start with a single slash is refused and collapsed
 * to `/`. This value ends up inside `?next=`, and `next` is the classic open
 * redirect: `//evil.example` and `https://evil.example` are both "paths" to a
 * careless parser and both leave the site. The auth routes validate it again
 * server side, because a query parameter is an input like any other and this
 * function is only the first of the two checks.
 */
export function returnHref(pathname: string, search: string, action: GatedAction): string {
  const safePath = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/";
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.set(INTENT_PARAM, action);
  return `${safePath}?${params.toString()}`;
}

/**
 * The door itself.
 *
 * Sign UP by default, and that is a considered default rather than a
 * duplicate of the middleware's. The middleware catches somebody who TYPED a
 * product address, who is far more likely to hold an account already, so it
 * sends them to sign in. This catches somebody who was browsing as a guest and
 * reached for a control, who by definition has not got an account yet on the
 * device they are holding. Both screens link to the other one.
 */
export function authHref(next: string, mode: "sign-up" | "sign-in" = "sign-up"): string {
  return `/${mode}?${NEXT_PARAM}=${encodeURIComponent(next)}`;
}

/**
 * Read the verb back off the address bar on the far side of sign-up.
 *
 * Anything unrecognised is null rather than an error: the parameter is user
 * editable, and a screen that throws because somebody typed `?do=banana` into
 * their own URL bar is a screen with a bug in it.
 */
export function readIntent(search: string | URLSearchParams): GatedAction | null {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search;
  const raw = params.get(INTENT_PARAM);
  return isGatedAction(raw) ? raw : null;
}

/**
 * The same address with the verb taken back off.
 *
 * A surface that has honoured an intent should replace the URL with this one,
 * so a refresh does not reopen the payment sheet for the rest of the session
 * and a shared link does not carry somebody else's half-finished action.
 */
export function withoutIntent(pathname: string, search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete(INTENT_PARAM);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * The address typed on the chooser, read back off the email screen's URL.
 *
 * The sign-in card takes the address first and the password second, per its
 * governing render, and the address travels between the two screens as an
 * ordinary query parameter for the same reasons `next` does. A query parameter
 * is an input, so only something shaped like an address is allowed to fill
 * the field, and the action validates it again on submit either way.
 */
export function emailFromQuery(raw: string | string[] | undefined): string {
  const value = (typeof raw === "string" ? raw : "").trim();
  if (value.length === 0 || value.length > 254) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? value : "";
}
