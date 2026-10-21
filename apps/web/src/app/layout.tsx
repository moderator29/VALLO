import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { localizedAlternates, openGraphLocales } from "@/lib/i18n/public-metadata";
import { OG_LOCALE } from "@/lib/i18n/public-locale";
import { prefersLessData } from "@/lib/save-data";
import { NONCE_HEADER } from "@/lib/security/csp";
import { ScrollToTop } from "@/components/site/ScrollToTop";
import { LivingCanvas } from "@/components/site/LivingCanvas";
import { ThemeSync } from "@/components/site/ThemeControl";
import { ServiceWorkerRegistrar } from "@/components/app/ServiceWorkerRegistrar";
import { VIEWER_HEADER, viewerMeta } from "@/lib/offline/viewer-stamp";
import { NativeRuntime } from "@/components/app/NativeRuntime";
import { STARTUP_GATE_SCRIPT, STARTUP_NATIVE_SCRIPT } from "@/components/startup/startup-script";
import { ThresholdStage } from "@/components/motion/ThresholdStage";
import { MOTION_COOKIE, motionAttributes, parseMotion } from "@/lib/motion/motion-pref";
import "./globals.css";
import "@/components/startup/startup.css";
import { siteUrl } from "@/lib/site";
import { CHROME_COLOUR } from "@/lib/theme/chrome";
import { THEME_BOOT_SCRIPT, THEME_KEY, parseThemeChoice, serverTheme } from "@/lib/theme/theme";
import { ITERATION_QUIET_SCRIPT } from "@/lib/motion/iteration-quiet";
import { RECENT_FLAG_SCRIPT } from "@/lib/search/recent-flag";
import { ClientCopyProvider } from "@/lib/i18n/client-copy";
import { clientCopyOf } from "@/lib/i18n/client-copy-of";
import { SuccessFlagHost } from "@/components/ui/SuccessFlagHost";
import { DetailsHost } from "@/components/ui/DetailsHost";

/*
 * The fonts are declared in `css/fonts.css` and served from `public/fonts`,
 * not through next/font. That file explains which subsets ship and why; this
 * one decides which of them the browser is told to fetch before it needs them.
 *
 * Inter is chosen for coverage, not fashion. It carries the naira sign
 * (U+20A6), the Yoruba and Igbo dotted vowels (ẹ ọ ṣ ị ụ), the Hausa hooked
 * letters (ɓ ɗ ƙ ƴ) and the combining tone marks that stack on top of those
 * vowels. Most display faces break on that last requirement.
 *
 * Preload is per locale, because the face a locale reads is per locale.
 * `tokens.css` swaps the display stack to Inter for Yoruba and Igbo, since
 * Poppins cannot draw their vowels, so on those two locales Poppins is never
 * painted at all and preloading it would be a download nobody uses. In its
 * place they get the vietnamese subset, which is the only one carrying
 * U+1EA0-1EF9, and on those locales it is needed by the first heading.
 *
 * Everything in these lists was measured, not assumed: a browser sweep of six
 * routes at 390px and at 1280px fetched Inter latin, Inter latin-ext and both
 * Poppins subsets on every single load.
 */
/*
 * OPS-10: ONLY WHAT THE FIRST SCREEN PAINTS IS PRELOADED. Six preloads
 * (about 155 KB) competed with the critical CSS and script on a 94 KB/s link.
 * A preload only raises priority; the other subsets still arrive when the
 * stylesheet asks for them, with `font-display: swap` covering the gap. The
 * first screen's body text is Inter latin and its heading Poppins 700 latin
 * (Inter vietnamese on the two locales whose headings need it). The naira
 * sign's own 1.2 KB face, `inter-naira` (V-78), is not preloaded either: the
 * stylesheet fetches it the first time a price is drawn, so English no longer
 * pulls the 85 KB latin-ext file for one glyph.
 *
 * THE HEADING FACE IS POPPINS 600 NOW, NOT 700 (C6, R3-18 round 2). The three
 * weights pass made headings 600, and measured on the eight signed-out routes
 * the first screen draws Poppins 600 on six of them and Poppins 700 on two
 * (the plate head of /move-in-cost and /for-agents). Preloading 700 fetched
 * an 8 KB face six pages never painted, while the 600 they did paint waited
 * for the stylesheet. The files live under /fonts/v2/ (fonts.css says why).
 */
const PRELOADED_FONTS: Record<string, readonly string[]> = {
  yo: ["inter-latin", "inter-vietnamese"],
  ig: ["inter-latin", "inter-vietnamese"],
  default: ["inter-latin", "poppins-600-latin"],
};

const baseMetadata: Metadata = {
  /*
   * THE FALLBACK WAS `http://localhost:3000`, WRITTEN OUT HERE.
   *
   * metadataBase is what every relative URL in this file resolves against: the
   * Open Graph image, the Twitter card, the canonical. A deployment that
   * forgets one environment variable therefore does not fail, it publishes
   * share cards pointing at localhost, and in a WhatsApp-first market the
   * share card is the first thing most people meet. Nothing breaks loudly, the
   * unfurl is simply blank for everybody.
   *
   * `siteUrl()` in `lib/site.ts` already resolves this properly and this file
   * was not using it: explicit variable first, then Vercel's production domain,
   * then the preview domain, and only then a local port. That is the same
   * ladder `lib/site.ts` wrote for auth redirects after a real sign-up landed a
   * phone on localhost, which is the same fault one layer down.
   */
  metadataBase: new URL(siteUrl()),
  /*
   * THE TITLE IS THE POSITION, NOT THE OLD SLOGAN.
   *
   * It read "Vallo. Real Estate reimagined!" in all three slots below. That
   * line is the old positioning and it told a first time visitor nothing
   * about what Vallo helps them do, which is the founder's own objection of
   * 22 September. It is also the one title a person meets before they have
   * seen a single screen: the browser tab, the search result and every link
   * anybody pastes into a chat. So it says the same thing the landing
   * headline says, and the two move together.
   *
   * The description says what the product IS rather than listing categories.
   * An earlier line described "homes, hotels, restaurants and experiences",
   * which was the travel app this stopped being, and promised "verified
   * listings" while the catalogue holds zero. The line that replaced it swung
   * the other way and described property only, on a product that had grown a
   * second side. It now names both, and names nothing that has no shipped
   * surface. The word verified is deliberately NOT here: it is sanctioned in
   * the founder's approved headline and nowhere else, because on this
   * catalogue it is a claim rather than a description.
   */
  title: {
    default: "Vallo. Rent, buy or stay, without the runaround.",
    template: "%s | Vallo",
  },
  description:
    "Homes, land, hotels and shortlets across Nigeria. See what you will actually pay before you call anybody, know who is behind every listing, and keep the record. Vallo Stays carries hotels, apartments, guest houses, resorts and restaurant tables on the same account and the same inbox.",
  applicationName: "Vallo",
  /*
   * BOTH SIDES, because the list carried nine property words and not one
   * word for the half of the product that sells nights (content truth sweep,
   * 19 September). Every term below is a market this platform actually
   * serves; nothing is here for the volume.
   */
  keywords: [
    "Nigeria",
    "rent",
    "property",
    "real estate",
    "apartments",
    "shortlet",
    "land",
    "hotels",
    "guest houses",
    "serviced apartments",
    "restaurants",
    "Vallo Stays",
    "Lagos",
    "Abuja",
    "Port Harcourt",
  ],
  /*
   * The card image is NOT declared here on purpose. `opengraph-image.jpg` sits
   * beside this file and Next emits og:image and twitter:image for it
   * automatically, at the right URL, with dimensions. Declaring `images` here
   * as well would be a second copy of the same fact that drifts the first time
   * the file changes. `scripts/build-og-image.mjs` is the generator.
   */
  /*
   * OPS-16: EVERY PAGE NAMES ITS OWN ADDRESS. `./` resolves against
   * metadataBase and the page's own path, so each page's canonical and
   * og:url are itself on the production host, and a page that sets its own
   * (a listing does) overrides this.
   */
  alternates: { canonical: "./" },
  openGraph: {
    url: "./",
    title: "Vallo. Rent, buy or stay, without the runaround.",
    description:
      "Homes, land, hotels and shortlets across Nigeria, with the cost of moving in written down before you call anybody. Hotels, apartments and restaurant tables on Vallo Stays. One account, one inbox.",
    siteName: "Vallo",
    locale: "en_NG",
    type: "website",
  },
  /*
   * THE CARD TYPE ONLY (W3, round 5). A title and description here were
   * inherited by every page that set its own Open Graph words and no Twitter
   * ones, which is every page: /terms, /check, a share door all unfurled on X,
   * Telegram and Slack as "Vallo. Space, without the runaround." over their
   * own picture. With only the card type here, Next fills the Twitter title,
   * description and image from each page's own Open Graph (`postProcessMetadata`),
   * so the two can never disagree again.
   */
  twitter: {
    card: "summary_large_image",
  },
  /* UI-16: no site-wide robots tag. Indexable is the default with no tag at
     all; stating "index, follow" here put it beside the "noindex" that a
     not-found page or a private page adds, so those pages carried both. */

  /*
   * Installable app metadata. Emitted by Next rather than hand written tags:
   * the manifest link points at the typed route in `app/manifest.ts`, and
   * `appleWebApp` produces apple-mobile-web-app-capable plus the status bar
   * style. `black-translucent` is the right pairing with the viewport's
   * `viewportFit: "cover"` already set below, so the navy canvas runs under
   * the status bar instead of leaving a pale strip above the brand.
   * Next renders `appleWebApp.capable` as the standards-track
   * `mobile-web-app-capable`, not the apple-prefixed name, so the Apple tag is
   * added through `other`. iOS Safari still reads the apple-prefixed tag to
   * decide whether an installed page opens standalone, and without it an iPhone
   * install would open in a browser chrome instead of as an app. Setting
   * `mobile-web-app-capable` here as well would emit it twice.
   */
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Vallo",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  /*
   * The platform previously shipped no favicon at all: the smallest declared
   * icon was 192px, so every browser tab downscaled it 12:1 and rendered a
   * blurred smear at 16px. The set now starts at the sizes tabs actually
   * request and keeps the large ones for install surfaces.
   */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/pwa/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

/*
 * A10: THE SITE'S TITLE AND DESCRIPTION IN THE READER'S LANGUAGE, AND ON A
 * PUBLIC PAGE THE ADDRESS IT IS CANONICAL AT.
 *
 * `/ha`, `/yo` and `/ig` serve the public pages through a rewrite, so a
 * relative canonical would name the bare English address and tell a search
 * engine the Hausa page is a copy. On a public page the canonical is the
 * address as typed, with the four languages as hreflang alternates
 * (`lib/i18n/public-metadata.ts`); everywhere else it is `./` as before.
 * The words are `publicMeta.site`, English unchanged.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const site = getDictionary(locale).publicMeta.site;
  const alternates = await localizedAlternates();
  return {
    ...baseMetadata,
    title: { default: site.title, template: "%s | Vallo" },
    description: site.description,
    alternates: alternates ?? baseMetadata.alternates,
    openGraph: {
      ...baseMetadata.openGraph,
      ...(alternates?.canonical ? { url: alternates.canonical as string } : {}),
      title: site.title,
      description: site.shareDescription,
      /* Other-language card locales only where those languages have a body. */
      ...(alternates && !alternates.languages ? { locale: OG_LOCALE[locale] } : openGraphLocales(locale)),
    },
    twitter: { ...baseMetadata.twitter },
  };
}

export const viewport: Viewport = {
  /*
   * ONE DECLARED VALUE, AND NOW THERE IS ONLY ONE VALUE TO DECLARE.
   *
   * This was a pair keyed on `prefers-color-scheme` until the theme stopped
   * following the operating system, and then a single dark value with two
   * runtime writers that could paint the light one: the before-paint script in
   * the body, and `applyThemeColour` in the settings store. **Both writers are
   * gone with light mode, removed by the founder on 23 September 2026.** The
   * meta tag is now the only thing that ever sets the chrome colour, and it
   * sets it once, on the server, to the only colour the product has.
   *
   * The history is worth keeping because it names the failure mode. A `media`
   * query answers the OS; this product's theme answered STORAGE; the two
   * disagreed for exactly the visitor the dark default was written for, a phone
   * set to light opening Vallo for the first time, which got the dark canvas
   * under a #F4F5F7 browser chrome. Three of the six combinations of stored
   * choice and OS preference were mismatched, measured rather than reasoned
   * about. None of those combinations exists any more.
   *
   * IT READS `CHROME_COLOUR` RATHER THAN RESTATING IT. This was one of
   * four places the same hex was written out by hand, beside the manifest and
   * the Capacitor `StatusBar` block. All of them are serialised where no CSS
   * has run, so none can hold a token, and literals with no stylesheet between
   * them drift with nothing to report it. `lib/theme/chrome.ts` is the one
   * home, and it carries the measurement showing why this value is not
   * `--nf-surface-canvas`.
   */
  themeColor: CHROME_COLOUR,
  width: "device-width",
  initialScale: 1,
  /* Never below 1: a phone may not zoom the page OUT to fit something wide,
     which is what made the forms read "zoomed out". Zooming in is untouched. */
  minimumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  /* Read before a byte is rendered, because that is the only point at which a
     background image can be prevented rather than merely hidden. */
  const lessData = await prefersLessData();

  /* This request's Content Security Policy nonce, minted in middleware.

     The two scripts below run before first paint and are the reason this is
     read at all: without the nonce they are exactly what the policy is designed
     to stop, an inline script in the document, and the theme would flash on
     every first load. Undefined when the middleware did not run, which is every
     path its matcher excludes; React omits the attribute entirely rather than
     writing `nonce="undefined"`, and no policy is being served on those paths
     either, so the two absences agree. */
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  /* Whose page this is, for the service worker that keeps it for offline
     (`lib/offline/viewer-stamp.ts`): the copy in the head is the one the
     Android app's worker can read. Null on every render the proxy did not
     stamp, and then nothing is drawn. */
  const offlineStamp = viewerMeta(await headers());
  /* The theme the person chose, from the cookie, so an explicit Light is
     rendered light by the server and never flashes dark. "system" renders
     dark here and the before-paint script below resolves it. */
  const themeChoice = parseThemeChoice((await cookies()).get(THEME_KEY)?.value);
  /* Track M: the motion preference, painted on the root by the server so the
     first frame (and the splash decision below) already honours it. */
  const motion = motionAttributes(parseMotion((await cookies()).get(MOTION_COOKIE)?.value));

  return (
    <html
      lang={locale}
      dir={t.meta.dir}
      data-save-data={lessData ? "on" : undefined}
      data-theme={serverTheme(themeChoice)}
      data-theme-choice={themeChoice}
      {...motion}
      suppressHydrationWarning
    >
      <head>
        {/*
          THE NATIVE SPLASH GOES FIRST, AND THE BOOT TRACE STARTS (D68c, A.2).
          The very first script in the document: it tells the native splash
          to hide through the raw bridge, with no import and no frame waited
          for, and starts the stage-by-stage trace a founder's device can
          report back. Silent on the website. See components/startup.
        */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: STARTUP_NATIVE_SCRIPT }} />
        {offlineStamp ? <meta name={VIEWER_HEADER} content={offlineStamp.viewer} data-path={offlineStamp.path} /> : null}
        {/*
          The face arrives with the stylesheet rather than after it. `crossorigin`
          is not optional even though these are our own files: a font is always
          fetched in CORS mode, so a preload without it is a second, separate
          request and the first one is thrown away.
        */}
        {(PRELOADED_FONTS[locale] ?? PRELOADED_FONTS.default ?? []).map((name) => (
          <link
            key={name}
            rel="preload"
            as="font"
            type="font/woff2"
            href={`/fonts/v2/${name}.woff2`}
            crossOrigin="anonymous"
          />
        ))}
      </head>
      <body>
        {/*
          THE THEME SCRIPT WAS DELETED ON 23 SEPTEMBER 2026 AND CAME BACK ON
          THE 25TH, when the founder reversed the dark-only rule. It is the
          first script below, and this time it has a server half: the cookie
          is read above, so an explicit Light is rendered light and only a
          "system" choice is resolved in the browser.
        */}
        {/*
          `suppressHydrationWarning` on both before-paint scripts, and it
          is the sanctioned suppression rather than a silenced bug.

          React deliberately does not serialise `nonce` to the client: the
          server renders `nonce="uXXrY..."` and the client tree carries
          `nonce=""`, so the two can never agree and every route logged a
          hydration mismatch on these elements. R1 caught it in the dev
          log and then found it staring out of a shipped proof, as the "2
          Issues" badge in `docs/design/proofs/f5/inbox-390-dark.png` (a proof
          shot since removed from the tree; in git history at `85c5471`).

          The cost of leaving it was not the warning, it was that a permanent
          false positive hides the real hydration bugs behind it. The
          `suppressHydrationWarning` already on <html> does not reach
          descendants, so each script needs its own.
        */}
        {/*
          THE SIDE, BEFORE PAINT, the same way as the theme.

          Vallo has two sides, Property and Stays, and the shell's accent, its
          navigation and its dock all key off which one is active. The side is
          the `nf_side` cookie, which the server layout already reads, but
          chrome-coloured surfaces are painted from CSS custom properties
          scoped on `[data-side]`, and the attribute has to be on <html>
          before the first frame or the Stays accent flashes Property blue on
          every load. Only the attribute is set here; `sideOfPath` in the
          shell still wins over the cookie for a side-owned URL, and the
          reconciler writes the cookie back the moment the shell mounts.
        */}
        {/*
          THE THEME, BEFORE PAINT. Light mode is back (25 September 2026, the
          founder reversing the dark-only rule). The server already rendered
          an explicit choice from the cookie; this resolves "system" against
          the operating system and repairs a choice that only survived in
          storage, then sets the browser chrome to match. See
          `lib/theme/theme.ts`.
        */}
        {/*
          FIRST OF ALL, BEFORE REACT: no document-wide listener for animation
          laps. With one in place the browser wakes the main thread for every
          lap of every moving edge light; without it the lights cost the page
          nothing. See `lib/motion/iteration-quiet.ts`.
        */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: ITERATION_QUIET_SCRIPT }}
        />
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
        {/* Whether this phone remembers any opened listing, before paint, so
            Home holds the Recently viewed row's height open instead of jumping
            when it hydrates (`lib/search/recent-flag.ts`). */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: RECENT_FLAG_SCRIPT }}
        />
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "try{var s=document.cookie.match(/(?:^|; )nf_side=([^;]*)/);var v=s&&s[1];var p=location.pathname;if(/^\\/(stays|stay|restaurants|restaurant|trips|host)(\\/|$)/.test(p))v='stays';else if(/^\\/(home|search|agent|listing|rent|inspections|bookings)(\\/|$)/.test(p))v='property';if(v==='stays')document.documentElement.dataset.side='stays'}catch(e){}",
          }}
        />
        {/*
          The other half of the data-saver signal (inbox item 246).

          `Save-Data: on` is a header and only Chromium sends it, and only when
          the reader has switched data saver on. This covers the reader nobody
          asked: somebody on a 2g or slow-2g link, which on a lot of this
          market is simply what the connection is. Runs before first paint, in
          front of the ambient layer below it, so the 3.5MB of background
          artwork is never requested rather than requested and hidden.

          Only ever sets the flag. It cannot clear one the server set, because
          the header is the reader saying so outright and a connection reading
          does not overrule that.
        */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "try{var c=navigator.connection;if(c&&(c.saveData||/^(slow-)?2g$/.test(c.effectiveType||'')))document.documentElement.dataset.saveData='on'}catch(e){}" +
              // A low-end device (two cores or less, or two gigabytes or
              // less): the night glass drops its outer glow (brand-glass.css),
              // as the landing's own marker already does there.
              "try{var n=navigator;if((n.hardwareConcurrency&&n.hardwareConcurrency<=2)||(n.deviceMemory&&n.deviceMemory<=2))document.documentElement.dataset.motionLite='on'}catch(e){}",
          }}
        />
        {/*
          THE OPENING, DECIDED BEFORE PAINT (D68c, 7 October 2026).

          The logo never appears by itself on app open. The opening is this
          page arriving: the header and the dock resolving from frame one, the
          content rising into them, about 1,500ms on the first open of the day
          and about 400ms on a returning one, a tap anywhere settling it at
          once. Once per browser session, which on the native shell is once per
          cold start. Never under reduced motion, Calm, Off, the splash switch
          or data saving (one settled frame), and never on the console, the
          auth callback or a shared link. The gate and its controller are
          STARTUP_GATE_SCRIPT, tested in components/startup. Decided here,
          before the first frame, so nothing is shown and then changed.
        */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: STARTUP_GATE_SCRIPT,
          }}
        />
        {/*
          WITHOUT JAVASCRIPT, EVERYTHING BELOW THE FOLD WAS INVISIBLE.

          Reveal renders data-shown="false" on the server and an
          IntersectionObserver flips it, so a reader with no JavaScript, or a
          crawler that does not run it, got a page that faded out one viewport
          down and never came back. The fix costs nothing where JavaScript
          runs: this style exists only inside noscript, so the entrance
          choreography is untouched for everyone who can see it.
        */}
        <noscript>
          <style>{`.nf-reveal { opacity: 1 !important; transform: none !important; }`}</style>
        </noscript>
        {/* The living canvas, mounted once behind every page. */}
        <div className="nf-ambient" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <LivingCanvas />
        {/* Film grain over everything, so surfaces feel physical, not printed. */}
        <div className="nf-grain" aria-hidden="true" />
        <ScrollToTop />
        <ThemeSync />
        {/* Installs the offline shell after load, in production only. Renders nothing. */}
        <ServiceWorkerRegistrar />
        {/*
          THE NATIVE RUNTIME, MOUNTED (3 October 2026): this was the whole bug.

          `lib/native/boot.ts` has said for a while that this component "mounts
          this once from the root layout". It never did. No `<NativeRuntime />`
          existed anywhere in the tree -- not here, not in the (app) layout, not
          anywhere -- which meant `startNativeRuntime()` was never called, on
          any page, on any device, ever. Every plugin it starts, splash-hiding
          included, is reached only from inside that one call, so not one of
          them had run in production. A cold start on the native shell showed
          the branded splash and then nothing: not a hang, not a crash, not a
          slow network -- the one piece of code that could ever have taken it
          down was simply never in the page.
        */}
        <NativeRuntime />
        <a href="#main" className="nf-skip-link">
          {t.common.skipToContent}
        </a>
        {/* The few words client code on every screen needs, in the reader's
            language, so no route ships the whole dictionary for them
            (`lib/i18n/client-copy.tsx`). */}
        <ClientCopyProvider copy={clientCopyOf(t)}>
          {/* No framer-motion provider (D49.1): nothing renders an `m`
              element, and the hooks the ported components use (motion
              values, `animate`) need no feature bundle. */}
          {children}
          {/* The account's success moments (sign-up, email, password,
              passcode), wherever they land: docs/SUCCESS_MOMENTS.md. */}
          <SuccessFlagHost />
          {/* The one toast, the connection line and back to top. */}
          <DetailsHost />
        </ClientCopyProvider>
        <ThresholdStage welcome={t.authFlow.welcomeThrough} />
      </body>
    </html>
  );
}
