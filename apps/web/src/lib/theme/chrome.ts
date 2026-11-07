/**
 * The colour of the chrome ABOVE the page, and the one place it is written
 * down.
 *
 * IT WAS A PAIR UNTIL 23 SEPTEMBER 2026, when the founder removed light mode.
 * There is one theme, so there is one chrome colour, and the `AppTheme` union
 * that used to index this record is gone with it.
 *
 * FOUR THINGS PAINT THIS AND NONE OF THEM CAN READ A TOKEN.
 *
 *   `viewport.themeColor`        a `<meta>` tag, serialised on the server
 *   the before-paint script      runs before the stylesheet, on purpose
 *   `manifest.ts`                a JSON document
 *   `capacitor.config.ts`        read by a native plugin at install time
 *
 * Every one of them is emitted where no CSS has run, so a `var()` in any of
 * them resolves to nothing, which for a colour means "paint nothing" and on a
 * status bar means a white strip above a near-black page. That is why these are
 * literals, and it is also why they need a single home: four serialisation
 * points with no stylesheet between them will drift, and nothing will report it
 * because there is no stylesheet to report it to.
 *
 * WHY THIS IS NOT `--nf-surface-canvas`, MEASURED RATHER THAN ASSERTED. The
 * chrome abuts the TOP of the page, and the top of the page is the sticky glass
 * header, not the canvas behind it. Sampled at 390 in dark: the canvas computes
 * to #000010 and the header's fill samples #090919. #010118 sits between them
 * and nearer the header, which is the surface it actually touches. Somebody
 * chose this value correctly and recorded only that it matched, so the next
 * person to reach for the obvious token would have moved the chrome nine units
 * away from the thing it abuts.
 *
 * NO `"use client"` HERE, DELIBERATELY. This constant is read by
 * `viewport.themeColor` in the root layout and by `manifest.ts`, both of which
 * are server side, and by two Capacitor helpers that are not. A plain constant
 * belongs below that boundary so both sides can read it without either one
 * pulling the other's runtime in. (There used to be a client module above it
 * that owned a `MutationObserver` on `data-theme`; it went with light mode on
 * 23 September 2026.)
 *
 * `capacitor.config.ts` is the one consumer that still writes the value out by
 * hand, because it sits outside `src` and is read by tooling rather than by the
 * app. Its comment points here. If these values move, that file moves with them.
 */

export const CHROME_COLOUR = "#010118";

/**
 * The browser chrome over the LIGHT theme (reintroduced 25 September 2026).
 * Since the clean, unified sweep (29 September 2026, plan item 1) the light
 * canvas is cool paper (7 November 2026, was warm #F4F4F1), `--nf-surface-canvas` #F5F6F8, not white, so the bar
 * is that same paper and the page runs up into it without a seam. Written by
 * the before-paint script and the theme control, never by the server, which
 * cannot know a "system" choice. It is a literal for the reason above: none
 * of its consumers can read a token.
 */
export const CHROME_COLOUR_LIGHT = "#F5F6F8";
