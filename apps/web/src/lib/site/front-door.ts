/**
 * WHAT VALLOSPACES.COM OPENS ON (the founder, 14 November 2026, asked twice:
 * "Haven't you remove landing page from website and make it our Home Screen
 * of VALLO unsigned ... And then the down part would still be this our
 * stuffs", with the signed-out discovery screen and the site footer).
 *
 * THE DECISION, IN ONE PLACE, THREE WAYS:
 *
 *   signed in                  -> `/home`. Someone already inside has a home
 *                                 screen, and the marketing page is not it.
 *   signed out, catalogue on   -> the DISCOVERY screen at `/`, with the site
 *                                 footer under it. The address stays `/`,
 *                                 which is what makes it the home screen
 *                                 rather than a redirect to `/search`.
 *   signed out, catalogue off  -> the landing page, unchanged. With
 *                                 `VALLO_PUBLIC_CATALOGUE` off a stranger may
 *                                 not be shown the catalogue at all
 *                                 (`lib/catalogue/public-access.ts`), so the
 *                                 front door has to be something else, and
 *                                 the landing page is that something.
 *
 * The native shell is not in this decision at all: it announces itself in its
 * user agent and is sent to `SHELL_START` before any of this is read.
 *
 * HOW THE DISCOVERY CASE IS SERVED. The proxy REWRITES `/` to `/search`,
 * which is the one implementation of that screen; nothing is copied, and the
 * browser's address bar still reads `/`. The page is told it is serving the
 * front door by this header, and answers by drawing the site footer and the
 * structured data that belongs to the home page. A client cannot set it: the
 * proxy deletes any copy that arrives before anything reads it, exactly as it
 * does for the locale and viewer headers.
 */

/** Set by the proxy on a rewritten front door. Never trusted from a client. */
export const FRONT_DOOR_HEADER = "x-vallo-front-door";

/** Where the landing page lives now that `/` is the home screen. */
export const LANDING_PATH = "/tour";
