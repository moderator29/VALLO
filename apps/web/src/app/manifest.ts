import type { MetadataRoute } from "next";
import { CHROME_COLOUR } from "@/lib/theme/chrome";
import { SHELL_START } from "@/lib/native/shell";

/**
 * Web app manifest, served by Next at `/manifest.webmanifest`.
 *
 * A typed route rather than a static file so the brand colours, the start URL
 * and the shortcut list stay in the same language as the rest of the app and
 * cannot drift out of sync with the routes they point at.
 *
 * The audience is Nigerian and often on a mid-range Android over a metered
 * data bundle, so an installed home-screen app with an offline shell is real
 * reach, not decoration. Everything referenced here exists on disk under
 * `public/pwa`. The app icons are drawn by `scripts/build-brand-logo.mjs` from
 * the new vector logo (D81, 8 October 2026): the mark on the brand navy, the
 * maskable one held inside the safe circle. That script is the record of the
 * padding, the background and the safe zone, which used to exist only in the
 * pixels; `scripts/build-web-icons.mjs` keeps the shortcut icons.
 *
 * THE COLOURS ARE THE CANVAS, FROM ITS ONE HOME. `theme_color` paints the
 * chrome above an installed app and `background_color` paints the splash
 * before the first frame; both read `CHROME_COLOUR`, which
 * `lib/theme/chrome.ts` measured against the dark canvas and the glass header
 * it abuts, so install, splash, status bar and first paint are one continuous
 * dark surface. Dark is the default theme and the operating system does not
 * override it, so neither value is ever white. `capacitor.config.ts` writes
 * the same value out by hand for the native shells and its comment points at
 * the same home.
 */

const NAVY = CHROME_COLOUR;

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vallo",
    short_name: "Vallo",
    /*
     * THIS SENTENCE CARRIED THREE FAULTS AND IT IS THE ONE A STORE LISTING
     * QUOTES.
     *
     * It offered "experiences", which is not a value `property_type` has, so
     * the category can never return a row: the same phantom the landing page
     * was carrying. It claimed "Verified listings" when zero listings are
     * verified and a check constraint enforces that, which is the same
     * unsupportable claim that has now come off /about. And it described four
     * nightly-shaped things on a platform that also sells houses, land, shops
     * and offices, so it read as a booking app.
     */
    description:
      "Rent, buy or stay across Nigeria, without the runaround. Property: a flat for the year, a house to buy, a shop to trade from, or the land itself, with the cost of moving in written down and the person behind the listing named. Vallo Stays: hotels, apartments, guest houses, resorts and restaurant tables. One account for all of it, and every payment goes straight to the person you are paying.",
    lang: "en-NG",
    dir: "ltr",
    /*
     * THE INSTALLED APP USED TO OPEN ON A SIGN-IN WALL (R3 finding F-12).
     *
     * `start_url` was `/home`, and `proxy.ts` counts `home` among the product
     * segments, so a signed-out launch of the installed app redirected
     * straight to `/sign-in?notice=sign-in-required`. A first launch has to
     * show the product. `/` is public, it is the landing built to the
     * founder's governing images, and a signed-in reader is one tap from
     * Home through the header, so nobody who has an account loses anything.
     *
     * THEN THE FOUNDER'S RULE OF 29 SEPTEMBER: the installed app opens like
     * the store app. Signed out, the first screen is the welcome intro (not
     * skippable, leading to the sign-up options and sign in); signed in, it
     * is Home. So the PWA starts at the shell's own decider (`SHELL_START`,
     * `lib/native/shell.ts`), which answers exactly that and never `/`.
     * Still public, so a signed-out launch meets no wall.
     */
    start_url: SHELL_START,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: NAVY,
    theme_color: NAVY,
    /*
     * The W3C category names the stores and launchers read. Property is the
     * platform and Stays is the other side of the coin, so lifestyle and
     * shopping lead and travel follows; nothing here claims a category the
     * product does not sell.
     */
    categories: ["lifestyle", "shopping", "travel"],
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Held inside the 80 per cent safe zone so an aggressive circular or
        // squircle launcher mask cannot clip the roof off the mark.
        src: "/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Search property",
        short_name: "Search",
        description: "Rent, buy, shortlet, land and commercial, in one search",
        url: "/search",
        icons: [{ src: "/pwa/shortcut-search.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "My bookings",
        short_name: "Bookings",
        description: "Your stays, trips and inspections, with their payment references",
        url: "/bookings",
        icons: [{ src: "/pwa/shortcut-bookings.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Agreements",
        short_name: "Agreements",
        description: "Your agreements and payments",
        url: "/agreements",
        icons: [{ src: "/pwa/shortcut-wallet.png", sizes: "96x96", type: "image/png" }],
      },
    ],
    /*
     * THE INSTALL CARD.
     *
     * Without these, an install prompt is a browser dialogue carrying a name
     * and an icon. With them, Chrome on Android renders a store-style card with
     * real screens in it, which is the difference between "a site wants to
     * install something" and "this is the app". On the mid-range Android this
     * product is built for, that prompt is the whole install funnel.
     *
     * Chrome uses the richer card only when at least one wide screenshot is
     * present alongside the narrow ones, which is why the desktop shot is here
     * on a portrait-locked application.
     *
     * They are RENDERED FROM THE RUNNING APPLICATION by
     * `scripts/build-pwa-screenshots.mjs`, not drawn, so they cannot drift from
     * what a person actually meets. That script refuses to write a shot that
     * captured a page error, and it waits out the entrance choreography so
     * nothing is caught half-revealed. The three narrow screens are the three
     * a stranger meets first: the landing, the property search, and the Stays
     * side; the labels are the honest one-line reading of each.
     */
    screenshots: [
      {
        src: "/pwa/shots/narrow-home.jpg",
        sizes: "780x1688",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "Property and Stays, one platform",
      },
      {
        src: "/pwa/shots/narrow-search.jpg",
        sizes: "780x1688",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "Rent, buy, shortlet, land and commercial, in one search",
      },
      {
        /* The Stays home, captured by `scripts/build-pwa-screenshots.mjs`
           (rerun 8 October 2026 for the new logo, D81 and D82; it replaced
           `narrow-markets.jpg`, which showed the old glass mark). */
        src: "/pwa/shots/narrow-stays.jpg",
        sizes: "780x1688",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "Hotels, shortlets and restaurants, on the Stays side",
      },
      {
        src: "/pwa/shots/wide-home.jpg",
        sizes: "2560x1600",
        type: "image/jpeg",
        form_factor: "wide",
        label: "Vallo on a larger screen",
      },
    ],
  };
}
