import type { NextConfig } from "next";

/**
 * The Supabase storage hostname, taken from the public project URL. Returns
 * an empty string when the URL is ABSENT, so a build without keys never throws
 * and simply serves the seed catalogue.
 *
 * DOC-P2-02: a URL that is SET but unusable fails the build instead of being
 * treated as absent. It used to return "" for a malformed value too, which
 * silently dropped the Supabase image host from the allowlist in exactly the
 * build that had a value: production. A typo in the Vercel variable is now a
 * red deploy with this message, not a site whose listing photos quietly stop
 * going through the optimiser.
 */
const supabaseImageHost = (() => {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (url.length === 0) return "";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL is set but is not a URL (${JSON.stringify(url.slice(0, 80))}). Expected https://<project>.supabase.co`,
    );
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must be https (got ${parsed.protocol}//${parsed.hostname}). Expected https://<project>.supabase.co`,
    );
  }
  return parsed.hostname;
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* SEC-17: no `X-Powered-By: Next.js` on every response. */
  poweredByHeader: false,

  /**
   * Where the build output goes. `.next` unless something asks otherwise.
   *
   * This exists because more than one person builds this app at once. Two
   * concurrent `next build` runs share one `.next`, and the second one's
   * `rm -rf` deletes `build-manifest.json` out from under the first, which
   * fails as "ENOENT ... build-manifest.json" during page collection, or as a
   * running server suddenly 500ing on every route with a missing
   * `required-server-files.json`. Both failures point at a file rather than at
   * the cause, and both cost real time before anyone suspects the other build.
   *
   * Setting NEXT_DIST_DIR gives a parallel worker its own output directory, so
   * `NEXT_DIST_DIR=.next-a2 npx next build` and the matching `next start` never
   * touch the shared one. The deploy path sets nothing and behaves exactly as
   * before.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /*
   * A git worktree whose node_modules are symlinks into another checkout
   * cannot build: Turbopack refuses to resolve `next` outside the workspace
   * root it detects. TURBOPACK_ROOT widens that root for such a build
   * (`TURBOPACK_ROOT=/home/user npx next build`). Unset, nothing changes.
   */
  ...(process.env.TURBOPACK_ROOT ? { turbopack: { root: process.env.TURBOPACK_ROOT } } : {}),

  // Workspace packages ship raw TypeScript, so Next compiles them in place.
  transpilePackages: ["@vallo/design-tokens", "@vallo/i18n"],

  experimental: {
    /*
     * THE CLIENT ROUTER KEEPS WHAT IT HAS JUST SEEN (Track M performance).
     * With the default of 0 for dynamic pages, going back to a tab you left
     * ten seconds ago fetched it again and showed its skeleton while it did.
     * Thirty seconds of reuse makes tab switching and back instant; live
     * surfaces (the inbox, notifications, a thread) keep themselves current
     * through their realtime subscriptions regardless. Prefetched pages keep
     * the default five minutes.
     */
    staleTimes: { dynamic: 30, static: 300 },
  },


  // Three image sources, all explicitly allowed through the optimiser and
  // nothing else: the seed catalogue's Unsplash photography, the Supabase
  // storage CDN that serves agent-uploaded listing photos and avatars once
  // real supply lands, and Google's avatar CDN. The Supabase host is derived
  // from the project URL so it follows the environment rather than being
  // hardcoded, and the pattern is omitted entirely when the URL is absent,
  // which keeps the allowlist tight in a build without keys.
  images: {
    /*
     * V-78, THE DATA DIET. A card in the two-column grid is about 170px wide
     * at 390px, and the smallest device width the optimiser offered was 640,
     * so every card photo was fetched at 640 wide. 384 and 480 are added so a
     * 1.5x or 2x phone gets a file the size it draws. AVIF first, WebP next,
     * each smaller than the JPEG it replaces.
     *
     * HOW LONG AN OPTIMISED FILE IS KEPT. One day at least, not thirty: the
     * floor applies to every image, and a listing photo taken down by
     * moderation must stop being served within a day, not a month. The
     * optimiser keeps a file for the longer of this floor and the source's
     * own max-age, so `/brand` art, which `headers()` below serves for 30
     * days, is still kept for 30 days.
     *
     * OPS-10: AVIF is typically a fifth to a third smaller than WebP for
     * photographs, which is the whole weight of a catalogue page on a metered
     * connection.
     */
    deviceSizes: [384, 480, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86_400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      /*
       * The photo a Google account already has.
       *
       * Somebody who signs up with Google has a face on file, and until this
       * was here it was discarded and they were drawn as a grey disc with a
       * letter in it. `next/image` THROWS on a host it was not told about, so
       * an avatar reaching an optimised image on an unlisted host is a 500 on
       * whatever screen drew it rather than a missing picture.
       *
       * Every avatar in the product is a plain img tag today, so nothing
       * currently needs this. It is here because Google hands the same photo
       * out from lh3 through lh6 and picks the shard itself, and a future
       * `<Image>` on any of them must not be able to take a screen down. The
       * path is pinned to the avatar prefix, which is the only thing on this
       * host we would ever render.
       */
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
        pathname: "/a/**",
      },
      ...(supabaseImageHost
        ? ([
            {
              protocol: "https" as const,
              hostname: supabaseImageHost,
              pathname: "/storage/v1/object/public/**",
            },
          ])
        : []),
    ],
  },

  /**
   * BECOME AN AGENT IS NOT A DESTINATION ANY MORE.
   *
   * There used to be a `/agents` pitch page, an `/agents/apply` wizard and an
   * `/agents/status` screen: a separate marketing funnel, in the public site
   * chrome, for something that is not a separate product. It is one account
   * with three profiles on it. You switch to the Seller or the Realtor profile
   * from the switch-profile sheet, and if that profile is not set up the sheet
   * explains what it is and starts the setup. So the three routes are gone and
   * these three redirects put anything still pointing at them where the thing
   * actually lives now.
   *
   * WHY REDIRECTS RATHER THAN JUST DELETING THEM. Three groups of links are
   * outside this change's reach: the marketing pages under `(site)`, which
   * another owner holds; the help centre and the docs chapters, which quote
   * the address in prose; and anything a person has already shared. A 404 on
   * "become an agent" is the worst possible answer for somebody who wants to
   * list a property, and it is the one visitor the business most wants.
   *
   * `/agents` lands on the profile with `?switch=owner`, which opens the
   * switch-profile sheet on the Seller explanation. That is the replacement,
   * exactly: the pitch is now the thing that starts the setup.
   *
   * All three are 307, not 308. A permanent redirect is cached by the browser
   * forever and these addresses may yet be wanted for something else.
   */
  async redirects() {
    return [
      /* A9 (30 September 2026): a stranger who clicked "Become an agent"
         met a sign-in wall with no word about cost, checks or payouts.
         `/for-agents` says all three, and its Start buttons carry
         `next=/profile/setup/agent` through sign-up. */
      { source: "/agents", destination: "/for-agents", permanent: false },
      { source: "/agents/apply", destination: "/profile/setup/owner", permanent: false },
      { source: "/agents/status", destination: "/profile/application", permanent: false },
      /*
       * `/support` IS SERVED NOW, SO IT NO LONGER REDIRECTS.
       *
       * It used to 307 to `/contact`, because the product offered the address
       * (the agent verification page's "Ask about this check", and two emails
       * in `lib/email/messages.ts`) and no page lived there. It is now the
       * in-app help and support home, `app/(app)/support/page.tsx`, with the
       * member's support conversations under `/support/messages`, and a
       * redirect here would shadow the page: `redirects()` runs before the
       * filesystem. `/contact` is still one tap away from it.
       */
      /*
       * `/verify`: the link `private.review_kyc_document` writes into every KYC
       * decision notification (migrations 20260809052558 and 20260925134322).
       * No page ever lived there, so the notice about a person's own documents
       * opened a 404. The redirect also mends every notification already sent.
       */
      { source: "/verify", destination: "/verification", permanent: false },
      /*
       * `/agent`, the console's own root, which has never rendered anything.
       *
       * `app/agent/` holds thirteen folders and no `page.tsx`, so the agent
       * console has no root: `nav-model.ts` sends people to
       * `/agent/dashboard` and everything works, right up until somebody
       * shortens the address in the bar or a link drops the segment. R2 found
       * it pointed at only from the dev harness and scored it as costing a
       * customer nothing, which is true of that one link and not of the agent
       * who types the obvious thing.
       */
      { source: "/agent", destination: "/agent/dashboard", permanent: false },
      /*
       * `/rent`, THE SECOND RENT SHELF, DELETED (V-26).
       *
       * It read `kind: "rental"` only, so a flat typed as an apartment or a
       * house for yearly rent never appeared on it: two shelves on one
       * platform that disagreed about what was for rent, and only one of them
       * had the filter drawer. The rent market is `/search?market=rent`, and
       * the one good idea on the old page, Message agent on each card, moved
       * there. `/rent/move-in` and `/rent/pay` are the transaction rather than
       * a shelf, and stay exactly where they are.
       *
       * Permanent, because this address is not coming back as a shelf. The
       * request's own query rides along (Next.js passes it through and merges
       * it with the destination's), so `/rent?q=Yaba` lands on
       * `/search?market=rent&q=Yaba` and a shared link keeps its words.
       */
      { source: "/rent", destination: "/search?market=rent", permanent: true },
      /*
       * `/trips` AND `/inspections`, FOLDED INTO PLANS (V-76).
       *
       * Three lists (`/bookings`, `/trips`, `/inspections`) whose empty
       * states were signposts to each other are one page at `/bookings`,
       * titled Plans. The two old addresses land on the half they held, and
       * their own query rides along: `/inspections?changed=<id>` still opens
       * the inspection a thread just answered, and `/trips?justBooked=<id>`
       * still marks the stay checkout confirmed.
       */
      { source: "/trips", destination: "/bookings?side=stays&from=stays", permanent: true },
      { source: "/inspections", destination: "/bookings?kind=inspection&from=property", permanent: true },
      /*
       * THE CONSOLE'S THREE MODERATION DESKS ARE LANES OF THE QUEUE (V-88).
       * Reports, message flags and held content were three destinations for
       * one noun; the unified queue renders each as a lane with every control
       * the desk had. The query rides along, so a filtered link still filters.
       */
      { source: "/admin/reports", destination: "/admin/queue?tab=reports", permanent: true },
      { source: "/admin/flags", destination: "/admin/queue?tab=flags", permanent: true },
      { source: "/admin/moderation", destination: "/admin/queue?tab=held", permanent: true },
      /*
       * Track A, 25 September 2026: custody is retired. There is no wallet,
       * no escrow and no held payment, so every old link lands where money
       * now lives: the agreements that gate a payment, and the admin queue
       * that approves them. Not permanent, so a browser never caches a
       * redirect a later route might want back.
       *
       * 7 October 2026 (ADR 0003): `/wallet` was that later route. It is the
       * member balance the escrow partner holds, so its redirect is gone.
       */
      { source: "/escrow", destination: "/agreements", permanent: false },
      { source: "/escrow/:path*", destination: "/agreements", permanent: false },
      { source: "/admin/escrow", destination: "/admin/agreements", permanent: false },
      { source: "/admin/escrow/:path*", destination: "/admin/agreements", permanent: false },
      /*
       * Retired docs chapters (the docs track, 13 October 2026). Each lands on
       * the closest current chapter; `docs-links.dom.test.tsx` holds every retired
       * slug to a redirect and every redirect to a live chapter. "Money and
       * the guarantee" named the retired Vallo Guarantee, and "Booking and
       * paying" mixed stays with tables and money; both were split into
       * one-topic chapters.
       */
      { source: "/docs/your-wallet", destination: "/docs/paying-on-vallo", permanent: false },
      { source: "/docs/money-and-the-guarantee", destination: "/docs/paying-on-vallo", permanent: false },
      { source: "/docs/booking-and-paying", destination: "/docs/booking-a-stay", permanent: false },
    ];
  },

  // Security headers. Applied at the edge for every route.
  async headers() {
    return [
      /*
       * The self-hosted faces. Everything under /public is served with
       * `max-age=0` by default, which for a font means a revalidation request
       * on every navigation for bytes that will never change. These seven files
       * are immutable by construction: the name IS the version, and replacing
       * one means giving it a new name. See public/fonts/README.md.
       */
      {
        source: "/fonts/:file*.woff2",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      /*
       * V-78: the brand artwork answered `max-age=0, must-revalidate`, a
       * revalidation round trip per image per page on a 3G phone. Thirty days,
       * not `immutable`: unlike the fonts these files are not versioned by
       * name, so a replaced logo must still reach people within the month.
       */
      {
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      },
      /*
       * The Apple app site association file, which is the iOS half of the deep
       * link contract and the one piece of it that a correct file on disk is
       * not enough for.
       *
       * Apple requires the file to be served with no extension, at exactly
       * `/.well-known/apple-app-site-association`, AND as `application/json`.
       * A file with no extension has nothing for a MIME lookup to work from, so
       * the static handler falls back to `application/octet-stream`, Apple's
       * CDN discards it, and Universal Links fail with no error anywhere: the
       * link simply keeps opening in the browser. The sibling file
       * `assetlinks.json` needs none of this, because its extension answers the
       * question by itself.
       *
       * This also has to be a real header rather than a guess, because the
       * catch-all block below sends `X-Content-Type-Options: nosniff` on every
       * response, so nothing downstream is permitted to correct a wrong type.
       *
       * Both files are static under `public/` and `src/middleware.ts` lets
       * `/.well-known` through untouched, which is what the fetchers need:
       * Apple and Google both read these anonymously, over https, with no
       * redirect allowed.
       */
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            /*
             * VC1: camera and microphone are allowed for OUR OWN ORIGIN, and
             * still for no other one (no embedded frame can ask). `camera=()`
             * used to switch getUserMedia off for the whole site, which was
             * right while nothing asked for it and would fail every call
             * silently now: the browser rejects the request without ever
             * showing the person a prompt. A permission is still only asked
             * for when a person starts or answers a call.
             */
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
