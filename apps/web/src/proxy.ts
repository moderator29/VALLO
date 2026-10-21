import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  contentSecurityPolicy,
  createNonce,
  cspHeaderName,
  NONCE_HEADER,
  REPORTING_ENDPOINTS,
} from "@/lib/security/csp";
import { safeReturnPath } from "@/lib/security/return-path";
import { isShellUserAgent, SHELL_START } from "@/lib/native/shell";
import { forwardedAgentHeaders } from "./lib/supabase/agent";
import { serverCookiesSecure, withAuthCookiePolicy } from "./lib/supabase/cookie-policy";
import { consume, ipFromHeaders, subjectForIp } from "@/lib/security/rate-limit";
import {
  ANON_CATALOGUE_LIMIT,
  ANON_CATALOGUE_WINDOW_SECONDS,
  isPublicCataloguePath,
  PUBLIC_CATALOGUE_API_PATHS,
  publicCatalogueEnabled,
} from "@/lib/catalogue/public-access";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./lib/supabase/env";
import { deadlineFetch, PROXY_CUT_PATHS, PROXY_DEADLINE_MS } from "./lib/supabase/deadline-fetch";
import { previewHarnessIsOpen } from "@/lib/preview-harness";
import { isKnownRoute } from "@/lib/routing/known-routes";
import { detailIsMissing, type ListingCounter } from "@/lib/routing/listing-exists";
import {
  hreflangLinkHeader,
  isLocalizablePath,
  localizedPath,
  preferredLocale,
  splitLocalePrefix,
  URL_LOCALE_HEADER,
  URL_PATH_HEADER,
} from "@/lib/i18n/public-locale";
import { LOCALE_COOKIE } from "@/lib/locale.constants";
import { FIRST_RUN_COOKIE, FIRST_RUN_MAX_AGE, FIRST_RUN_SHOWN, isFirstRunSeen } from "@/components/app/welcome/first-run-seen";
import { doorFirstRunRedirect } from "@/app/(auth)/sign-in/first-run-gate";
import { ANON_VIEWER, VIEWER_HEADER, VIEWER_PATH_HEADER, viewerStamp, wantsViewerStamp } from "@/lib/offline/viewer-stamp";
import {
  finishSetupGateApplies,
  finishSetupHref,
  mayOweSetup,
  REQUIRED_DOCUMENTS,
  setupRecordComplete,
} from "@/lib/auth/finish-setup";

/**
 * Refresh the Supabase auth session on every request, and hold the door on the
 * product.
 *
 * Supabase access tokens are short-lived; without a refresh on navigation a
 * signed-in user would silently fall back to anonymous. This reads the user,
 * which rotates the token when needed, and writes the refreshed cookies onto the
 * response. When Supabase is not yet configured the middleware is a pass-through,
 * so the app runs before any credentials are in place.
 *
 * The guard below is the second job, and it is here rather than on the pages
 * because a link is not a lock. The marketing site used to point straight at
 * `/search`, and removing those links would have stopped the clicks while
 * leaving every one of these routes open to anybody who typed the address,
 * followed an old link, or read the sitemap. One check, before any page runs.
 *
 * It is not the ONLY check, and it must never be treated as one. Every server
 * action resolves its own session and every read is behind RLS, because a
 * server action is posted to a page's path and a caller can choose a path this
 * gate leaves open. The middleware decides who gets a screen. The action and
 * the policy decide who gets a row.
 */

/**
 * WHAT CHANGED ON 23 SEPTEMBER, AND WHY THE LIST IS THE OTHER WAY UP NOW.
 *
 * The founder's instruction, in his own words: "Remove look around. You must
 * sign in. Nothing inside the platform is visible without signing up or
 * signing in."
 *
 * This file used to hold the closed list: a set of product first segments,
 * with everything else open. That shape answers the wrong question. A route
 * added to the app was PUBLIC until somebody remembered to classify it, and
 * "we forgot" is how a product quietly reopens. The same lesson was paid for
 * one layer down this morning, where a rule that lived in prose rather than in
 * a check took the whole catalogue off the air for eleven and a half hours
 * (ledger section 67): the knowledge was in the repository in three places and
 * the migration shipped anyway.
 *
 * So the list is inverted. PUBLIC is now the enumerated set and everything
 * else needs a session, which makes a new route BORN LOCKED, the same rule
 * rule 21 puts on a database function. Getting this list wrong in the closing
 * direction is a compliance problem rather than a bug, which is why every
 * entry below carries the reason it is there and why
 * `apps/web/tests/gate.spec.mjs` walks all of them with a real browser.
 *
 * WHAT IS DELIBERATELY ACCEPTED WITH IT, so nobody files either as a defect.
 * No listing will be indexed by any search engine, so the landing page is our
 * only public surface: `app/sitemap.ts` therefore publishes no listing URL.
 * And both app stores need reviewer credentials, which makes the seeded demo
 * account a hard requirement rather than a convenience. Both are written up in
 * `docs/STORE_SUBMISSION_NOTES.md`.
 */

/**
 * Open to anybody, matched on the FIRST path segment.
 *
 * Matched on the segment rather than by prefix string, so `/terms` is public
 * and a future `/termsheet` is not public by accident.
 *
 * THE LANDING PAGE AND WHAT SURROUNDS IT. `/` is the founder's named public
 * surface. `about`, `careers`, `contact`, `help` and `docs` are the company
 * and support pages that hang off its footer: they are not inside the
 * platform, and a support page behind a login is a support page the one person
 * who most needs it cannot reach. `/help` additionally mounts the support chat
 * that `/api/support` answers, which is why that endpoint is open below.
 *
 * THE LEGAL AND POLICY PAGES. `terms`, `privacy`, `eula`, `cancellations`,
 * `standards`, `safety`. A privacy notice nobody can read without an account
 * is not a privacy notice. A regulator, an app store reviewer and a person who
 * has lost access to their account must all be able to reach every one of
 * these without signing in.
 *
 * `delete-account` IS NOT OPTIONAL AND IT IS NOT MARKETING. Google Play
 * requires a publicly reachable URL explaining how to request account deletion
 * that works without installing anything and without signing in. It also
 * carries the restore form, which is the one step a person CANNOT perform
 * signed in, because their account is banned for the length of the grace
 * window. Closing this page would lock somebody out of undoing their own
 * deletion.
 *
 * THE DOORS. `sign-in`, `sign-up`, `forgot-password`, `reset-password`, `auth`
 * (which is where every confirmation link lands, and a session is the thing it
 * is about to create) and `start` (the old intro address, a 307). A lock with
 * no door is a wall.
 *
 * `welcome` IS THE FRONT DOOR. First run is the first thing a stranger meets,
 * from the stores and from Sign up or Sign in, so it must answer signed out.
 * It has moved from the closed list to this one and it means the same thing.
 *
 * `offline` is served when there is no network at all, so it cannot depend on
 * an auth call, and `home-or-landing` resolves the word "home" by reading the
 * caller's own cookies and answers `/` for a stranger, which is the honest
 * answer and would become a redirect loop if it were gated.
 *
 * `preview` and `gallery` STAY OUT OF THE GATE ON PURPOSE. They carry their
 * own guard, `previewHarnessIsOpen`, which answers not-found on Vercel
 * unconditionally and off Vercel unless `VALLO_PREVIEW_HARNESS=1`. Gating them
 * as well would break every proof walk in `scripts/design/`, which runs signed
 * out by necessity, and would buy nothing in production where they do not
 * exist.
 */
const PUBLIC_SEGMENTS = new Set([
  // The company and support surfaces around the landing page.
  "about",
  // V-82: the public area price pages. Aggregates only (what an area is
  // asking, the count and the dates), never a listing, a photograph, an agent
  // or an address; a statement about a market, like the landing page. An area
  // without the Price Check minimum of REAL listings is a 404, so today every
  // address under it is one.
  "areas",
  "careers",
  "contact",
  "docs",
  "help",
  // Legal and policy. Never close one of these.
  "cancellations",
  // The disclaimer is a legal page like the other four and was gated by
  // omission: a stranger following a footer link got a sign-in wall.
  "disclaimer",
  "eula",
  // The Host Agreement is read by a host before they have a host account, and
  // the Terms link to it, so it is as open as the Terms (13 October 2026).
  "host-agreement",
  "privacy",
  "safety",
  "standards",
  "terms",
  // Compliance: the Play Store deletion URL and the only route back from a
  // deletion already started.
  "delete-account",
  // The doors.
  // `r` is V-55's receipt check: a code a tenant hands to an employer, an
  // embassy or a new landlord, none of whom are members. It answers
  // area-level facts about a genuine payment and nothing else, the same page
  // to every visitor.
  "r",
  "auth",
  "forgot-password",
  "reset-password",
  "sign-in",
  "sign-up",
  "start",
  "welcome",
  // THE SHARE DOOR (V-07). `/s/<token>` is a door in exactly the sense the
  // five above are: a public page whose only purpose is to lead somebody
  // inside with a `next`. It shows ONE card (area only, never an address, no
  // sharer) and one button, "Sign in to open it on Vallo". It exists because
  // every Share on the platform otherwise unfurls as "Sign in | Vallo". The
  // card is read through `public.share_door`, whose row type cannot carry an
  // address, and the same card goes to a person and to an unfurler: nothing
  // here or in the page reads the user agent.
  "s",
  // V-31 and V-32: the landlord's reply page. The landlord has no account and
  // needs none; the single-use token in the link is the authorisation, checked
  // against its sha256 inside the database. The page shows the area and never
  // the address, and nothing else inside the platform is reachable from it.
  "landlord",
  // V-61: "Is this a Vallo agent?" A renter holding a flyer has no account;
  // the lookup behind it is rate limited and answers yes with a public name or
  // one plain no. V-62: the page a renter's trusted contact opens, by a token,
  // showing the area and never the address.
  "check",
  "safe",
  // Recommendations A (30 September 2026). A9: the supply front doors, which
  // say what listing costs and how payouts arrive, for people who have no
  // account yet. A8: the move-in calculator, which reads nothing but what the
  // visitor types. A14: the guides, plain articles. A12: the sign-in-free
  // email preferences, authorised by the signed token in the link and by
  // nothing else. A5: the invite door, which shows a first name at most.
  "for-agents",
  "for-hosts",
  "for-landlords",
  "move-in-cost",
  "guides",
  "email",
  "join",
  // Serving with no network, and resolving which home the caller means.
  // `open` is where the native app starts (STORE-04): it answers /home for a
  // session and /welcome or the open catalogue for anybody else.
  "home-or-landing",
  "open",
  "offline",
  // Development harnesses, closed by their own guard in production.
  "gallery",
  "preview",
]);

/**
 * Open, matched on the EXACT path, because these are files rather than trees.
 *
 * `/` is the landing page. `/robots.txt` and `/sitemap.xml` are read by
 * crawlers that have no session and never will, and a sitemap behind a login
 * is a sitemap nothing can fetch. `/opengraph-image.jpg` is what an unfurler
 * fetches when somebody pastes our address into a chat, so it is public for
 * the same reason.
 *
 * Everything else a browser fetches without a session already leaves the
 * middleware alone through the matcher at the foot of this file: the static
 * chunks, the brand and icon directories, the fonts, the PWA assets,
 * `/.well-known/`, `/sw.js` and `/manifest.webmanifest`.
 */
const PUBLIC_PATHS = new Set(["/", "/robots.txt", "/sitemap.xml", "/opengraph-image.jpg"]);

/**
 * The API routes that answer WITHOUT a session, by exact path, and why each
 * one has to.
 *
 * A GATE THAT ONLY REDIRECTS PAGE REQUESTS WHILE THE DATA ROUTES STILL ANSWER
 * IS NOT A GATE, IT IS A CURTAIN. `/api/map/listings` served the whole
 * catalogue inside a bounding box to anybody who asked, and the map on
 * `/search` is the only thing that calls it.
 *
 * ENUMERATED AS THE OPEN SET, NOT THE CLOSED ONE, for the same reason as the
 * page list: a new endpoint is then born closed. Every entry here carries its
 * own guard, and none of them is a session:
 *
 *   webhooks           a signature over the body, from Paystack, Yellow Card,
 *                      LiveKit (`/api/calls/webhook`, VC1) and Supabase's own
 *                      auth hook. The sender has no cookie and never will.
 *   cron               a bearer secret through `lib/cron/run.ts`, including
 *                      `/api/push/drain`, which pg_net calls every five
 *                      minutes, and `/api/paystack/reconcile`.
 *   browser telemetry  `/api/csp-report` is named in the Reporting-Endpoints
 *                      header this middleware stamps on EVERY response,
 *                      including the sign-in page's, and `/api/client-error`
 *                      is posted by the error boundaries. Closing either one
 *                      would mean the only reports we ever received came from
 *                      people who were already signed in.
 *   the service worker `/api/push/sw` is fetched as a script by the browser's
 *                      service worker registration.
 *   support            `/api/support` answers the chat mounted on the PUBLIC
 *                      `/help` page. Somebody locked out is exactly who needs
 *                      it.
 *
 *   the VAPID key  `/api/push/key` answers the PUBLIC half of the key pair,
 *                      and a browser cannot call `pushManager.subscribe`
 *                      without it. Gating it was a real defect: on 23
 *                      September the founder tried to register the first
 *                      device this platform has ever had and got
 *                      `{"error":"Sign in to use this."}` from inside a home
 *                      screen web app, which keeps its own cookie store and so
 *                      had no session. The route's own header said all along
 *                      that "publishing it is the intended use, not a leak",
 *                      and its variable is literally named `NEXT_PUBLIC_`.
 *                      Two parts of this codebase disagreed about one route
 *                      and the wall won. It is open now and the three that
 *                      matter stay shut.
 *
 * Closed by absence, and checked: `/api/assistant`, `/api/crypto/*`,
 * `/api/documents/[id]`, `/api/map/listings`, `/api/push/register`,
 * `/api/push/revoke` and `/api/push/self-test`. Those three write or send;
 * the key only tells a browser who to bind a subscription to. So is
 * `/api/passcode/touch`, the passcode unlock's heartbeat (docs/PASSCODE.md),
 * which has nothing to say to a caller with no session.
 */
const PUBLIC_API_PATHS = new Set([
  "/api/auth/email-hook",
  /* A2: Supabase's Send SMS hook, behind the Standard Webhooks signature and
     off unless PHONE_SIGNIN_ENABLED is true. */
  "/api/auth/sms-hook",
  /* C2: a room's calendar for Airbnb or Booking.com to subscribe to. The
     64-character token in the query is the whole key; it returns dates only. */
  "/api/calendar/feed",
  "/api/client-error",
  "/api/calls/webhook",
  "/api/cron/account-purge",
  "/api/cron/calls-sweep",
  "/api/cron/canary",
  /* C2: calendar sync, behind the cron bearer and CALENDAR_SYNC_ENABLED. */
  "/api/cron/calendar-sync",
  "/api/cron/complete-stays",
  /* Crypto payments read back from the provider, behind the cron bearer. */
  "/api/cron/crypto-reconcile",
  /* Escrow arrangements read back from the payment partner, behind the cron bearer. */
  "/api/cron/arrangements-reconcile",
  "/api/cron/email-outbox",
  "/api/cron/hold-sweep",
  "/api/cron/rent-share-refunds",
  "/api/cron/reservation-deposit-refunds",
  "/api/cron/inventory-drift",
  "/api/cron/landlord-line",
  "/api/cron/pg-cron-watch",
  /* C8: the nightly duplicate-photo hash backfill, behind the cron bearer. */
  "/api/cron/photo-hash-backfill",
  /* SCUML item 15: the daily risk classification, behind the cron bearer. */
  "/api/cron/risk-classes",
  "/api/cron/saved-search-alerts",
  "/api/cron/store-readiness",
  "/api/cron/new-match-alerts",
  /* SCUML items 8 and 9, behind RECONCILE_CRON_SECRET like every job. */
  "/api/cron/sanctions-lists",
  "/api/cron/sanctions-screen",
  "/api/csp-report",
  /* A12: RFC 8058 one-click unsubscribe. A mailbox provider POSTs it with no
     cookie; the HMAC-signed token in the query is the whole authorisation. */
  "/api/email/unsubscribe",
  /* A6: the first-party funnel beacon. It records a step name, a surface and
     a random visit id, never a person, and is rate limited per address. */
  "/api/funnel",
  "/api/health/catalogue",
  "/api/landlord/inbound",
  "/api/push/key",
  "/api/paystack/reconcile",
  "/api/paystack/webhook",
  /* Part B phase 15: Payluk webhooks, behind the HMAC-SHA512 signature. */
  "/api/payluk/webhook",
  /* V-98: the home-screen widget, behind its device-bound token. */
  "/api/plans/next",
  "/api/push/drain",
  "/api/push/sw",
  "/api/support",
  /* V-96: Meta's WhatsApp webhook, behind the app-secret signature. */
  "/api/whatsapp/inbound",
  "/api/yellowcard/webhook",
]);

/**
 * May a caller with no session have this path at all?
 *
 * Exported so `proxy.test.ts` can put every route on this platform through the
 * same function the running middleware uses, rather than through a second copy
 * of the rule that can agree with itself while disagreeing with the product.
 */
export function isPublicPath(
  path: string,
  options: { publicCatalogue?: boolean } = {},
): boolean {
  /* A10: a language address is public exactly when its bare page is public
     and has a language address at all (the proxy sends the rest to the bare
     address before this is asked). */
  const addressed = splitLocalePrefix(path);
  if (addressed.locale) {
    return isLocalizablePath(addressed.path) && isPublicPath(addressed.path, options);
  }
  if (PUBLIC_PATHS.has(path)) return true;
  /* STORE-P2-04: the founder's switch, VALLO_PUBLIC_CATALOGUE. It can only
     ADD the six read-only catalogue segments; it cannot open an account
     surface, and of the API only the map's pins, which the search page calls
     and which carry their own per-address limit
     (`lib/catalogue/public-access.ts`). */
  if (options.publicCatalogue && isPublicCataloguePath(path)) return true;
  if (options.publicCatalogue && PUBLIC_CATALOGUE_API_PATHS.has(path)) return true;
  /* An API path is decided by its WHOLE path and never by its first segment,
     because `api` is not a public tree: only the endpoints enumerated above
     answer a caller with no session and the rest do not. */
  if (isApiPath(path)) return PUBLIC_API_PATHS.has(path);
  const [, first = ""] = path.split("/");
  return PUBLIC_SEGMENTS.has(first);
}

/**
 * A top-level page load, as opposed to Next's RSC navigation fetches and the
 * intent prefetches a listing card fires on hover or touch. Only these count
 * against a stranger's catalogue allowance: a person scrolling a list would
 * otherwise spend several counts per page they never opened, and a refusal
 * sent to an RSC fetch surfaces as a broken navigation, not a sentence.
 */
export function isDocumentRequest(request: { headers: Headers }): boolean {
  const headers = request.headers;
  if (headers.get("rsc") === "1" || headers.has("next-router-prefetch")) return false;
  const purpose = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch")) return false;
  const dest = headers.get("sec-fetch-dest");
  return dest === null || dest === "document";
}

/** The query as the pages' `searchParams` see it: one value, or several. */
function searchParamsRecord(search: URLSearchParams): Record<string, string | string[]> {
  const record: Record<string, string | string[]> = {};
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    record[key] = values.length === 1 ? values[0]! : values;
  }
  return record;
}

/**
 * The form pages a signed-out server action may reach. Each one checks the
 * session in the page itself, so a render caused by an action shows nobody
 * anything gated: the three supply registration pages call
 * `requireSignedInPage`, and /host/apply and /agent/list draw their own
 * signed-out state. A page is added here only with that check and a test of it
 * (proxy-server-action.test.ts).
 */
export const SELF_GUARDING_FORM_PATHS: ReadonlySet<string> = new Set([
  "/profile/setup/owner",
  "/profile/setup/agent",
  "/profile/setup/professional",
  "/host/apply",
  "/agent/list",
]);

/**
 * A server action call: a POST carrying the `next-action` header that Next's
 * client sets on every action it invokes. Signed out, it reaches the action
 * only on `SELF_GUARDING_FORM_PATHS`; see the signed-out branch of `proxy`.
 */
export function isServerActionRequest(request: { method: string; headers: Headers }): boolean {
  return request.method === "POST" && request.headers.has("next-action");
}

/** An `/api` path, which is answered rather than redirected. See `refuse`. */
export function isApiPath(path: string): boolean {
  return path === "/api" || path.startsWith("/api/");
}

/**
 * Stamp the policy on a response, whichever response it turned out to be.
 *
 * This middleware has three exits: the early one when Supabase is not
 * configured, the redirect that sends a signed-out visitor to sign in, and the
 * ordinary pass-through. A CSP applied to only the last of those is a CSP with
 * holes in it exactly where a visitor is least authenticated, so every exit
 * goes through here instead of setting the header itself.
 */
/** The visitor's own User-Agent, capped, or nothing at all. See the call site. */
function forwardedAgent(request: NextRequest): Record<string, string> {
  return forwardedAgentHeaders(request.headers.get("user-agent"));
}

function withSecurityPolicy(response: NextResponse, nonce: string): NextResponse {
  response.headers.set(cspHeaderName(), contentSecurityPolicy(nonce));
  response.headers.set("Reporting-Endpoints", REPORTING_ENDPOINTS);
  return response;
}

/** An address no route matches: a closed harness request, or an unknown one, is rewritten here to get the site's 404. */
export const HARNESS_CLOSED_PATH = "/_harness-closed";

/** The development harness trees, `/preview` and `/gallery`. */
export function isHarnessPath(pathname: string): boolean {
  return /^\/(preview|gallery)(\/|$)/.test(pathname);
}

/** Where a refused auth link lands: the sign-in screen, with the sentence. */
export const AUTH_CALLBACK_REFUSED = "/sign-in?notice=link-expired";

/** `/auth/callback` carrying Supabase's own refusal in the query. */
export function isAuthCallbackRefusal(url: URL): boolean {
  if (url.pathname.replace(/\/+$/, "") !== "/auth/callback") return false;
  return Boolean(url.searchParams.get("error") || url.searchParams.get("error_code"));
}

export async function proxy(request: NextRequest) {
  /*
   * One nonce per request, minted before anything else so that every exit below
   * shares it. It travels two ways at once and needs to: forward on the REQUEST
   * headers, where the root layout reads it to mark its two before-paint
   * scripts as ours, and back on the RESPONSE headers inside the policy itself.
   * If those two ever disagreed, the theme and data-saver scripts would be
   * blocked and every first paint would flash the wrong theme.
   */
  const nonce = createNonce();
  request.headers.set(NONCE_HEADER, nonce);
  /* The offline stamp is the server's to set, never the client's. */
  request.headers.delete(VIEWER_HEADER);
  request.headers.delete(VIEWER_PATH_HEADER);

  /*
   * A10: LANGUAGES YOU CAN LINK TO. `/ha/about` is the Hausa `/about`: the
   * prefix is taken off here and the rest of this function sees the bare
   * address, so the gate, the harness guard and the 404 checks decide exactly
   * as they do for English. The page is served by a rewrite, with the locale
   * on a request header `getLocale()` reads first. A client cannot choose that
   * header for itself: any copy it sent is deleted before anything reads it.
   * Only public pages have a language address; `/ha/home` goes to `/home`,
   * where the member's own Settings choice applies as before.
   */
  request.headers.delete(URL_LOCALE_HEADER);
  request.headers.delete(URL_PATH_HEADER);
  const addressed = splitLocalePrefix(request.nextUrl.pathname);
  const urlLocale = addressed.locale;
  const pathname = addressed.path;
  if (urlLocale && !isLocalizablePath(pathname)) {
    const bare = request.nextUrl.clone();
    bare.pathname = pathname;
    return withSecurityPolicy(NextResponse.redirect(bare, 307), nonce);
  }
  if (urlLocale) request.headers.set(URL_LOCALE_HEADER, urlLocale);
  /* The address as typed, for the page's canonical and hreflang metadata:
     under a rewrite the page itself only sees the bare path. */
  if (isLocalizablePath(pathname)) request.headers.set(URL_PATH_HEADER, request.nextUrl.pathname);
  const routed = request.nextUrl.clone();
  routed.pathname = pathname;
  /* The pass-through: a rewrite to the bare page for a language address, the
     plain next() otherwise. */
  const forward = () =>
    urlLocale ? NextResponse.rewrite(routed, { request }) : NextResponse.next({ request });

  /*
   * A public page asked for with no prefix, by somebody who reads Hausa,
   * Yoruba or Igbo (their stored choice, or their browser on a first visit),
   * is sent to its language address, so the address they share is the one
   * they read. Page loads only, never the store shell, and English stays at
   * the bare address for everybody else, crawlers included.
   */
  if (
    !urlLocale &&
    request.method === "GET" &&
    isDocumentRequest(request) &&
    isLocalizablePath(pathname) &&
    !isShellUserAgent(request.headers.get("user-agent"))
  ) {
    const wanted = preferredLocale(
      request.cookies.get(LOCALE_COOKIE)?.value,
      request.headers.get("accept-language"),
    );
    if (wanted !== "en") {
      const target = request.nextUrl.clone();
      target.pathname = localizedPath(pathname, wanted);
      const redirected = NextResponse.redirect(target, 307);
      redirected.headers.set("vary", "cookie, accept-language");
      redirected.headers.set("cache-control", "no-store");
      return withSecurityPolicy(redirected, nonce);
    }
  }

  /*
   * WHOSE PAGE THIS IS, for the service worker that keeps visited pages for
   * offline (`lib/offline/viewer-stamp.ts`). Set once the session has been
   * read, below; left null when it could not be, and never put on a response
   * that sets a cookie, so neither is ever kept.
   */
  let viewer: string | null = null;

  /*
   * The stamp goes on the response header (in `finish`) and into the render,
   * for the head's meta tag, which is the copy the Android app's worker can
   * read. Into the render means onto the forwarded request, so the
   * pass-through is rebuilt with it; only when nothing has set a cookie on the
   * response yet, so nothing is lost by rebuilding it, and only when this
   * response will not set the language cookie either.
   */
  const stampRender = (current: NextResponse): NextResponse => {
    const setsLocale = Boolean(urlLocale && !request.cookies.get(LOCALE_COOKIE));
    if (!viewer || setsLocale || current.headers.get("set-cookie")) {
      viewer = null;
      return current;
    }
    request.headers.set(VIEWER_HEADER, viewer);
    request.headers.set(VIEWER_PATH_HEADER, request.nextUrl.pathname);
    return forward();
  };

  /*
   * What every page response on a language-bearing address also carries: the
   * hreflang set (so a search engine finds all four languages from any one),
   * and, for a first-time visitor who arrived through a language address with
   * no stored choice yet, that language as their choice, so the next page
   * they open is in it too. A member who already chose keeps their choice.
   */
  const finish = (response: NextResponse): NextResponse => {
    if (request.method === "GET" && isLocalizablePath(pathname)) {
      const link = hreflangLinkHeader(request.nextUrl.origin, pathname);
      if (link) response.headers.set("link", link);
    }
    if (urlLocale && !request.cookies.get(LOCALE_COOKIE)) {
      response.cookies.set(LOCALE_COOKIE, urlLocale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
    /* THE SLIDES MARK THE SITTING FROM THE SERVER (the founder, 16 October
       2026: the last slide's Sign in sent him back to slide one, again and
       again). The doors read `vallo_first_run` off the request, and only the
       click that left the slides wrote it, from script. A navigation that
       fired before that write reached the request layer (WKWebView hands
       script-set cookies to its request store a moment late) arrived at the
       door without it and was sent back here. So the cookie is set as the
       slides are served: every request after this one carries it, whatever
       the browser does with script-set cookies. The client write stays, for
       the storage-blocked `welcomed=1` fallback (`first-run-seen.ts`).

       THE VALUE IS `shown`, NOT `seen`. Next hands a cookie set here to the
       very request that set it, so `/welcome` would read `seen` and skip the
       slides on the first visit. `shown` opens the doors and leaves the
       slides to the welcome page's own `seen` (`isFirstRunLeft`). */
    if (
      request.method === "GET" &&
      (pathname.replace(/\/+$/, "") || "/") === "/welcome" &&
      !isFirstRunSeen(request.cookies.get(FIRST_RUN_COOKIE)?.value)
    ) {
      response.cookies.set(FIRST_RUN_COOKIE, FIRST_RUN_SHOWN, {
        path: "/",
        maxAge: FIRST_RUN_MAX_AGE,
        sameSite: "lax",
        secure: serverCookiesSecure(request.nextUrl.protocol),
      });
    }
    if (viewer && !response.headers.get("set-cookie")) response.headers.set(VIEWER_HEADER, viewer);
    return withSecurityPolicy(response, nonce);
  };

  /*
   * STORE-17: A CLOSED HARNESS IS A REAL 404, DECIDED BEFORE ANY RENDER.
   *
   * The harness layout's own `notFound()` runs after the root `loading.tsx`
   * has started the stream, so the status was already 200 and the page
   * beside it had streamed its list of preview decks into the payload. The
   * rewrite goes to an address no route matches, so Next answers with the
   * site's not-found page and a 404 status, and nothing of the harness is
   * rendered at all.
   */
  if (isHarnessPath(pathname) && !previewHarnessIsOpen(process.env)) {
    const closed = request.nextUrl.clone();
    closed.pathname = HARNESS_CLOSED_PATH;
    closed.search = "";
    return withSecurityPolicy(NextResponse.rewrite(closed, { request }), nonce);
  }

  /*
   * V-11: THE STORE SHELL NEVER GETS THE LANDING PAGE. The shell appends
   * `VALLO-NATIVE` to its user agent (`capacitor.config.ts`), and its first
   * request is for `/`. It is sent to its own start before anything renders,
   * here rather than in the page, because the root `loading.tsx` streams and
   * a page-level redirect would arrive as a refresh after a skeleton. A
   * browser is untouched. See `lib/native/shell.ts` for why `server.url` is
   * not used for this.
   */
  if (request.nextUrl.pathname === "/" && isShellUserAgent(request.headers.get("user-agent"))) {
    return withSecurityPolicy(NextResponse.redirect(new URL(SHELL_START, request.url), 307), nonce);
  }

  /*
   * L-4: A REFUSED AUTH LINK IS A 307, NOT A ONE-SECOND FRAME. When Supabase
   * comes back with `?error=` (a spent or refused link), `auth/callback/page`
   * redirected, but only after the root `loading.tsx` had started the stream,
   * so the browser got a streamed meta refresh and a blank "verifying" second.
   * Answered here instead, before anything renders. Safe because the target is
   * fixed: nothing from the query is carried, and only a page load is turned
   * away (a server action posting to the callback still reaches the page).
   */
  if (request.method === "GET" && isAuthCallbackRefusal(request.nextUrl)) {
    return withSecurityPolicy(NextResponse.redirect(new URL(AUTH_CALLBACK_REFUSED, request.url), 307), nonce);
  }

  /*
   * THE DOORS' FIRST RUN IS A 307 ON A PAGE LOAD, NOT A SECOND PAGE LOAD.
   * `/sign-in` and `/sign-up` send a device that has not met the onboarding
   * this sitting to `/welcome` first (`first-run-gate.ts`, the founder, 7 and
   * 8 October 2026). The pages decide it with `redirect()`, but only after
   * their `loading.tsx` has started the stream, so the browser got a 200, a
   * skeleton, the door's scripts and then a client navigation (or the
   * one-second meta refresh) to the slides: Lighthouse on a phone read
   * first paint at 3.5 s and the slides' largest paint at 6.4 to 7.4 s,
   * two page loads deep. The same pure decision is made here, before
   * anything renders, for a page load only; a router navigation or a
   * prefetch still reaches the page, whose own `redirect()` stays as it was.
   */
  if (request.method === "GET" && (pathname === "/sign-in" || pathname === "/sign-up") && isDocumentRequest(request)) {
    const firstRun = doorFirstRunRedirect({
      door: pathname,
      cookie: request.cookies.get(FIRST_RUN_COOKIE)?.value,
      params: searchParamsRecord(request.nextUrl.searchParams),
    });
    if (firstRun) return finish(NextResponse.redirect(new URL(firstRun, request.url), 307));
  }

  let response = forward();

  const stamped = wantsViewerStamp(request);

  if (!isSupabaseConfigured()) {
    if (stamped) viewer = ANON_VIEWER;
    return finish(stampRender(response));
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    /*
     * WHOSE DEVICE THIS IS, PASSED ON RATHER THAN OVERWRITTEN. SEC-5.
     *
     * GoTrue stamps `auth.sessions.user_agent` from the User-Agent header of
     * whichever request last touched the session. That request is this one, so
     * every row in the table read `Vercel Edge Functions`: the runtime's own
     * fetch agent, describing our server. `/settings/devices` asks somebody
     * "do you recognise this device", and until this line the only honest
     * answer it could give was that the device was not recorded.
     *
     * Forwarding the browser's own header fixes it at the source rather than
     * building a second session store beside the real one. The value is
     * attacker controlled, as every request header is, and it is never
     * rendered: `lib/security/device.ts` maps it onto a fixed list of browser
     * and platform names and returns nothing else, so the worst a crafted
     * header achieves is a row reading "Unrecognised device".
     *
     * Capped, because the header goes into a column and a database is not the
     * place to discover somebody sent a megabyte. Absent on a request with no
     * User-Agent, in which case nothing is set and GoTrue records what it
     * always did.
     *
     * The IP is deliberately NOT forwarded. Supabase's own proxy decides what
     * `auth.sessions.ip` holds and an X-Forwarded-For from us is a claim it may
     * or may not honour, which is the difference between a fact and a guess.
     * That is why `my_sessions()` does not return the column and why the screen
     * shows no location at all.
     */
    /* PERF-SWEEP 6: the guard's table reads fail open, so a stalled one is
       cut after PROXY_DEADLINE_MS rather than holding the navigation. Auth
       keeps its own deadline below. */
    global: {
      headers: forwardedAgent(request),
      fetch: deadlineFetch({ ms: PROXY_DEADLINE_MS, paths: PROXY_CUT_PATHS }),
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = forward();
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, withAuthCookiePolicy(options, serverCookiesSecure(request.nextUrl.protocol)));
        }
      },
    },
  });

  /*
   * Rotates the token when needed. Do not remove: this call is the refresh.
   *
   * SPEED-1: `getClaims()`, not `getUser()`. This function does NOT run beside
   * the database: Vercel runs it at the edge PoP nearest the visitor, so
   * `getUser()` was an HTTPS round trip from Cape Town or Ashburn to GoTrue in
   * eu-west-1 on EVERY request, including each client navigation and each
   * prefetch. Supabase's own edge logs for 28-29 Sep 2026 show 1,358
   * `/auth/v1/user` calls from IAD and 474 from CPT against 703 from DUB, the
   * guard's calls being the ones that crossed an ocean before render began.
   *
   * `getClaims()` reads the session from the cookie, refreshes it through
   * GoTrue exactly as before when it is due (that is the refresh this line
   * exists for), then verifies the access token's ES256 signature and expiry
   * locally against the project's JWKS, cached per instance for ten minutes.
   * A symmetric (HS) token or a runtime without WebCrypto makes it fall back to
   * `getUser()` itself, so nothing is trusted unverified.
   *
   * WHAT THIS GATE STILL KNOWS AND WHAT IT NO LONGER ASKS. A session revoked
   * on another device keeps a signed, unexpired token for at most the token's
   * lifetime (one hour). That is already true of every data read, because
   * PostgREST authorises on the same signature and RLS sits behind it, and
   * every page or action that needs the full user still calls
   * `resolveSession()`, whose `getUser()` runs in dub1 next to GoTrue. So a
   * revoked reader passing this redirect sees the page's own signed-out state,
   * never someone's data.
   */
  /* The verified claims are kept for the finish-setup gate below, which reads
     the account's sign-in methods off them without another round trip. */
  let verifiedClaims: Parameters<typeof mayOweSetup>[0] = null;
  const reader = await readSessionUser(async () => {
    const answer = await supabase.auth.getClaims();
    if (!answer.error) verifiedClaims = (answer.data?.claims ?? null) as typeof verifiedClaims;
    return answer;
  }, carriesSessionCookie(request));

  /* OPS-05. A request that carries a session while auth cannot answer (a
     5xx, a network failure, no answer in time) is let through: the page's
     own reads decide, and fail visibly, instead of every member being sent
     to sign-in at once. */
  if (reader === "unknown") return finish(response);
  const user = reader;
  if (stamped) viewer = await viewerStamp(user);

  /* SPEED-4: the 404 check for a detail page, when it is already known to be
     needed, starts beside the stranger's rate-limit read instead of after it.
     Each is a round trip from the edge to eu-west-1, so doing them one after
     the other cost a signed-out listing page an extra crossing before the
     first byte. It starts only where the read below is also made (a stranger,
     the open catalogue, a GET document). The one cost: a request the limiter
     then turns away has made this read too, and its answer is dropped. It
     never reaches the response (the refusal is the same redirect either way
     and does not wait on it), so it is load, not an oracle. */
  let earlyDetailCheck: Promise<boolean> | null = null;

  if (!user) {
    const path = pathname.replace(/\/+$/, "") || "/";
    const publicCatalogue = publicCatalogueEnabled();

    /* A stranger reading the open catalogue is counted per address, so the
       switch cannot be used to walk every listing at machine speed. Only the
       pages are counted; a person reads a few a minute. */
    if (publicCatalogue && isPublicCataloguePath(path) && isDocumentRequest(request)) {
      if (request.method === "GET") {
        earlyDetailCheck = detailIsMissing(path, supabase as unknown as ListingCounter);
      }
      const verdict = await consume({
        bucket: "anon_catalogue",
        subject: subjectForIp(ipFromHeaders(request.headers)),
        limit: ANON_CATALOGUE_LIMIT,
        windowSeconds: ANON_CATALOGUE_WINDOW_SECONDS,
      });
      if (!verdict.allowed) {
        /* A page, so a page answers: the sign-in screen with the reason, and
           the address they wanted kept. Sign in and browsing carries on. */
        const target = request.nextUrl.clone();
        target.pathname = "/sign-in";
        target.search = "";
        const back = safeReturnPath(pathname, request.nextUrl.search);
        if (back) target.searchParams.set("next", back);
        target.searchParams.set("notice", "catalogue-paced");
        const response = NextResponse.redirect(target);
        response.headers.set("retry-after", String(verdict.retryAfterSeconds));
        response.headers.set("cache-control", "no-store");
        return withSecurityPolicy(response, nonce);
      }
    }

    if (!isPublicPath(path, { publicCatalogue })) {
      /*
       * AN API ROUTE IS ANSWERED, NEVER REDIRECTED.
       *
       * A 307 to an HTML sign-in page is not something a `fetch` can do
       * anything with: it follows the redirect, receives a page, and the
       * caller then tries to read JSON out of it. The refusal has to be
       * readable by the thing that made the request, so it is a 401 with the
       * reason in it and `no-store` so nothing caches a refusal.
       */
      if (isApiPath(path)) {
        return withSecurityPolicy(
          NextResponse.json(
            { error: "Sign in to use this.", code: "sign-in-required" },
            { status: 401, headers: { "cache-control": "no-store" } },
          ),
          nonce,
        );
      }

      /*
       * ON A FORM PAGE, A SERVER ACTION ANSWERS FOR ITSELF, NOT BY REDIRECT.
       *
       * An action is a POST the page's own code makes with `fetch`. A 307 to
       * the sign-in page is followed, returns HTML, and React throws "An
       * unexpected response was received from the server": the route error
       * boundary replaces the form and everything typed into it is gone. On
       * the form pages below, the action reads the session itself and refuses
       * in its own envelope ("Sign in to continue."), which the form shows
       * with its answers still in place.
       *
       * ONLY THOSE PAGES. When an action revalidates, Next renders the page
       * at the posted address into the response, so a signed-out action POST
       * to any other gated address (a listing, /home) would come back with
       * that page drawn for nobody. Each page listed here checks the session
       * itself (`requireSignedInPage`, or its own signed-out state), and
       * everything else keeps the redirect.
       */
      if (isServerActionRequest(request) && SELF_GUARDING_FORM_PATHS.has(path)) {
        return finish(response);
      }

      /* OPS-17: an address this app does not answer at is a 404 for a
         stranger too, not a trip to the sign-in screen. */
      if (!isKnownRoute(path)) {
        const missing = request.nextUrl.clone();
        missing.pathname = HARNESS_CLOSED_PATH;
        missing.search = "";
        return withSecurityPolicy(NextResponse.rewrite(missing, { request }), nonce);
      }

      const target = request.nextUrl.clone();
      target.pathname = "/sign-in";
      target.search = "";
      /* Sign-up would be the friendlier guess, but somebody who typed a
         product address is far more likely to already have an account than
         not, and the sign-in screen offers the way to create one.

         THE DEEP LINK IS THE WHOLE POINT OF THIS PARAMETER. Every listing
         address anybody shares now lands here first, so a `next` that is
         dropped turns every shared link on the platform into a dead end. It
         rides through `/sign-in` and `/auth/callback`
         already; `safeReturnPath` is what keeps it a path and not somebody
         else's host. */
      const back = safeReturnPath(request.nextUrl.pathname, request.nextUrl.search);
      if (back) target.searchParams.set("next", back);
      target.searchParams.set("notice", "sign-in-required");
      return withSecurityPolicy(NextResponse.redirect(target), nonce);
    }
  }

  /*
   * B-2: A GOOGLE OR APPLE ACCOUNT FINISHES SETTING UP BEFORE IT GOES IN.
   *
   * Such an account never passed the sign-up form, so it holds no terms
   * receipt and no 18-or-over statement until `/sign-up/finish` records
   * them. Here rather than in the `(app)` layout because a layout does not
   * re-render on a client navigation, so a gate there could be walked past
   * from any exempt page; this runs on every request, prefetch and RSC
   * fetch included.
   *
   * Cheap for everybody else: an account with an email identity, or one
   * whose token carries the done flag, is decided from the verified token
   * with no read (`mayOweSetup`). Only a social-only account without the
   * flag reads its own rows, under RLS. A read that fails lets the request
   * through, the same posture as OPS-05 above: an outage must not lock
   * members out, and the step is also asked for straight after the
   * callback. The step, the legal pages, the API, every public address and
   * every server action (signing out included) are never held
   * (`finishSetupGateApplies`), so this cannot loop.
   */
  if (user) {
    const path = pathname.replace(/\/+$/, "") || "/";
    if (
      finishSetupGateApplies({
        path,
        method: request.method,
        isPublic: isPublicPath(path, { publicCatalogue: false }),
        isServerAction: isServerActionRequest(request),
      }) &&
      mayOweSetup(verifiedClaims) &&
      (await owesSetup(supabase as unknown as SetupReader, user))
    ) {
      const back = safeReturnPath(request.nextUrl.pathname, request.nextUrl.search);
      const redirected = NextResponse.redirect(new URL(finishSetupHref(back), request.url));
      for (const cookie of response.cookies.getAll()) redirected.cookies.set(cookie);
      redirected.headers.set("cache-control", "no-store");
      return withSecurityPolicy(redirected, nonce);
    }
  }

  /* OPS-17 / UI-16: a listing, stay or restaurant page for something that is
     not there answers 404 before the stream starts. Documents only: a prefetch or an RSC fetch goes on to
     the page, which renders the not-found state itself. The refreshed session
     cookies on `response` are carried over. */
  if (request.method === "GET" && isDocumentRequest(request)) {
    const path = pathname.replace(/\/+$/, "") || "/";
    if (await (earlyDetailCheck ?? detailIsMissing(path, supabase as unknown as ListingCounter))) {
      const missing = request.nextUrl.clone();
      missing.pathname = HARNESS_CLOSED_PATH;
      missing.search = "";
      const rewritten = NextResponse.rewrite(missing, { request });
      for (const cookie of response.cookies.getAll()) rewritten.cookies.set(cookie);
      return withSecurityPolicy(rewritten, nonce);
    }
  }

  return finish(stampRender(response));
}

/** The one read the finish-setup gate makes, narrowed to its shape. */
type SetupReader = {
  from: (table: "terms_acceptances") => {
    select: (columns: "document") => {
      eq: (column: "user_id", value: string) => {
        in: (
          column: "document",
          values: readonly string[],
        ) => PromiseLike<{ data: { document: string }[] | null; error: unknown }>;
      };
    };
  };
};

/**
 * Whether this account still owes the finish-setup step, read from its own
 * rows in `terms_acceptances` (RLS: a member reads only their own). Any
 * failure answers false, so an outage lets the request through rather than
 * locking a member out.
 */
async function owesSetup(supabase: SetupReader, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("terms_acceptances")
      .select("document")
      .eq("user_id", userId)
      .in("document", REQUIRED_DOCUMENTS);
    if (error) return false;
    return !setupRecordComplete(data);
  } catch {
    return false;
  }
}

/** OPS-05. How long the guard waits for auth before it stops waiting. */
const AUTH_ANSWER_TIMEOUT_MS = 3000;

/** Whether the request carries a Supabase session cookie at all. */
function carriesSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
}

/** What `auth.getClaims()` answers, narrowed to what the guard reads. */
type ClaimsAnswer = { data: { claims?: { sub?: unknown } | null } | null; error: unknown };

/**
 * The signed-in reader's id, null when there is none, or "unknown" when a
 * request that carries a session could not be answered: auth returned a 5xx or
 * a network failure (AuthRetryableFetchError) while refreshing the token or
 * fetching the signing keys, or did not answer in time. A refusal (an expired,
 * revoked or malformed session, a bad signature) and a request with no
 * session cookie are both null, never "unknown".
 */
async function readSessionUser(
  getClaims: () => Promise<ClaimsAnswer>,
  hasSessionCookie: boolean,
): Promise<string | null | "unknown"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), AUTH_ANSWER_TIMEOUT_MS);
  });
  try {
    const answer = await Promise.race([getClaims(), timeout]);
    if (answer === "timeout") return hasSessionCookie ? "unknown" : null;
    const sub = answer.error ? undefined : answer.data?.claims?.sub;
    if (typeof sub === "string" && sub.length > 0) return sub;
    if (hasSessionCookie && isAuthRetryableFetchError(answer.error)) return "unknown";
    return null;
  } catch (thrown) {
    /* Only an outage is "unknown". `getClaims()` THROWS (rather than
       answering an error) on a token it cannot parse or an algorithm it does
       not know, e.g. a header that is not JSON, or `alg: "PS256"` beside a
       real key id. Those are forgeries, and treating every throw as an
       outage let a hand-made cookie walk through the gate. */
    return hasSessionCookie && isAuthRetryableFetchError(thrown) ? "unknown" : null;
  } finally {
    clearTimeout(timer);
  }
}

export const config = {
  // Run on everything except static assets and image files.
  /*
   * THE EXTENSION RULE THAT USED TO BE HERE WAS A HOLE.
   *
   * It ended `|.*\.(?:svg|png|jpg|...)$`, which excluded ANY path ending in one
   * of those, not only paths under an asset directory. Every dynamic route on
   * this platform accepts such a suffix inside its own parameter, so the
   * middleware simply did not run for them. Measured against a production
   * build: `/checkout/abc.png`, `/listing/abc.png`, `/messages/abc.svg` and
   * `/u/somebody.png` all returned 200 with full HTML, no Content Security
   * Policy and no nonce.
   *
   * Three things were lost on those responses. The policy was absent entirely,
   * so an injected inline script would execute on a page where it could not on
   * the same route without the suffix. The signed-out gate below was never
   * consulted. And the Supabase token refresh, which the comment at the top of
   * this file says must not be removed, did not run.
   *
   * No data leak sat behind it: those pages call `resolveSession()` with RLS
   * behind that, so they render their signed-out state. It was a defence in
   * depth bypass rather than a breach, and it is closed by anchoring on the
   * directories that hold assets rather than on how a path happens to end.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|icons/|fonts/|pwa/|\\.well-known/|sw\\.js$|manifest\\.webmanifest$).*)",
  ],
};
