/*
 * Vallo service worker. Hand written, no library, deliberately small.
 *
 * The audience is Nigerian and frequently on a mid-range Android over 3G with
 * a metered data bundle, so this worker has four jobs and no others:
 *
 *   1. OPEN WHAT YOU ALREADY SAW, WITH OR WITHOUT SIGNAL (the founder, 8
 *      October 2026: an app that shows a full-screen "no connection" card
 *      instead of the screen you were just on is not how Instagram, WhatsApp
 *      or Airbnb behave). Every page a member opens is kept on this phone,
 *      for that member only. Since 13 October 2026 (the startup track: "open
 *      instantly, show the last screen while it refreshes") a kept page
 *      answers AT ONCE, and the network refreshes it behind the screen; it
 *      also answers when the network is down or too slow. See THE PAGES and
 *      NAVIGATIONS below.
 *   2. Keep a tiny offline shell so a page that was never opened here, asked
 *      for with no network, shows one calm Vallo screen instead of the
 *      browser's dinosaur. The shell refreshes itself in the background
 *      (stale while revalidate, at most every SHELL_REFRESH_MS).
 *   3. Stop the phone paying twice for bytes that never change. The hashed
 *      Next build output and the versioned fonts are cache first: once on
 *      the phone they are never asked for again. The brand artwork and icons
 *      are stale while revalidate, and the listing photographs the optimiser
 *      has already sized for this phone are cache first.
 *   4. Turn a push into a notification, and a tap on that notification into
 *      the right screen. See THE PUSH HALF at the foot of this file.
 *
 * THE PUSH HANDLERS LIVE HERE AND NOT IN A SECOND WORKER, and that is a
 * correctness decision rather than a tidiness one. TWO REGISTRATIONS AT THE
 * SAME SCOPE ARE NOT TWO WORKERS, THEY ARE ONE WORKER REPLACING THE OTHER, so
 * a push worker registered at `/` would have silently uninstalled the offline
 * shell above. The previous arrangement dodged that by serving a second
 * worker from `/api/push/sw` at the narrower scope `/api/push/`, where it
 * could not displace anything. It cost one thing and the cost was the whole
 * point of a notification: `clients.matchAll()` only returns pages inside the
 * scope, so a tap could not see an already-open Vallo tab and opened a second
 * one. One worker at `/` sees every tab, so a tap lands in the tab the person
 * already has.
 *
 * WHAT IT MUST NEVER DO:
 *
 *   - Answer one person with another person's page. Pages are kept per
 *     VIEWER, and the viewer is not something a page claims: the server
 *     stamps every document it renders with `x-vallo-viewer` (`proxy.ts`), an
 *     opaque digest of the signed-in account, or `anon`, on the response and
 *     again in the head (`app/layout.tsx`, the copy the Android app can read;
 *     `lib/offline/viewer-stamp.ts` says why). A page is kept only
 *     under the viewer its own response names, the moment a response names a
 *     different viewer every page kept for the previous one is deleted, and
 *     signing out deletes them all from the page as well
 *     (`lib/offline/page-cache.ts`). A response with no stamp (an auth outage,
 *     a redirect, a refreshed session cookie) is never kept.
 *   - Keep money, identity or a live call. The never-kept list below covers
 *     the API, every route that moves or shows money (wallet, checkout, pay,
 *     payments, payouts, refunds, receipts, rent), sign-in and its kin,
 *     security settings, admin and the supply workspaces. A stale balance is
 *     worse than none, so those routes go to the network or to the offline
 *     screen, never to an old copy.
 *   - Write anything that is not a plain same-origin GET. Server actions,
 *     every POST, every webhook and every API response go straight out,
 *     untouched.
 *   - Answer an asset from a response that says it is personal: anything
 *     carrying Authorization, Set-Cookie, Vary: Cookie, or a no-store /
 *     private directive is passed through untouched.
 *
 * Save-Data is respected: when the hint is present the background refresh of
 * the asset cache and the warming of visited pages are skipped, because
 * fetching a second copy is itself paid-for traffic the person has asked us
 * to economise on. A response that was already fetched is still kept, which
 * costs nothing.
 *
 * Bump CACHE_VERSION on any change to this file. The activate step deletes
 * every cache that is not in the current set, so a deploy can never leave a
 * person on last week's shell.
 */

/* Bumped to v2 when the push handlers moved in from `/api/push/sw`.
   Bumped to v3 (V-35, V-78) when the offline page began carrying the gate
   code and its script chunks were precached, and when the asset cache key
   stopped including the deployment id. v4 (V-53) when notifications gained
   buttons. v5 (8 October 2026) when visited pages began opening offline, per
   viewer, and listing photographs and fonts joined the kept assets. v6 (13
   October 2026) when a kept page began answering at once, carrying the
   `data-vallo-kept` mark and a note of whether its assets are all on the
   phone, and the hashed build output went cache first. */
const CACHE_VERSION = "v7";
const SHELL_CACHE = `vallo-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `vallo-assets-${CACHE_VERSION}`;
const IMAGE_CACHE = `vallo-images-${CACHE_VERSION}`;
const META_CACHE = `vallo-meta-${CACHE_VERSION}`;
/* One page cache per viewer: `vallo-pages-v5-<viewer>`. */
const PAGE_CACHE_PREFIX = `vallo-pages-${CACHE_VERSION}-`;
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE, META_CACHE];

const OFFLINE_URL = "/offline";

/*
 * The whole offline shell, roughly 40 kB: the offline document, Vallo's real
 * mark it draws, the app icon a notification uses, and the manifest so an
 * installed app still knows its own name and colours with no network.
 */
const SHELL_ASSETS = [OFFLINE_URL, "/brand/vallo-mark.svg", "/pwa/icon-192.png", "/manifest.webmanifest"];

/* First path segment is enough to name a surface whose ASSETS must never be
   cached (the asset allowlist below is the primary rule; this is the floor). */
const NEVER_CACHE_SEGMENTS = new Set([
  "api",
  "admin",
  "agent",
  "wallet",
  "messages",
  "notifications",
  "auth",
]);

/*
 * PAGES THAT ARE NEVER KEPT, by first path segment. Money, identity, sign-in,
 * the supply workspaces, live calls, token links, and the worker's own
 * routes. Everything else a member opens is kept for that member.
 */
const NEVER_KEEP_PAGE_SEGMENTS = new Set([
  "api",
  "_next",
  "admin",
  "agent",
  "host",
  "auth",
  "wallet",
  "checkout",
  "pay",
  "payments",
  "payouts",
  "refunds",
  "receipts",
  "rent",
  "verification",
  "calls",
  "settings",
  "sign-in",
  "sign-up",
  "forgot-password",
  "reset-password",
  "start",
  "open",
  "offline",
  "first-run",
  "home-or-landing",
  "join",
  "email",
  "s",
  "safe",
  "landlord",
  "r",
  "preview",
  "dev",
]);

/* Prefixes whose bytes are immutable or effectively so, and therefore worth keeping. */
const CACHEABLE_ASSET_PREFIXES = ["/_next/static/", "/brand/", "/icons/", "/pwa/", "/fonts/"];

/*
 * THE BYTES THAT CAN NEVER CHANGE AT THEIR ADDRESS, answered cache first with
 * no second download. Every `/_next/static/` file name carries a hash of its
 * content (or the build id), and Next serves them `immutable` for a year; the
 * fonts are versioned by name (`next.config.ts` serves `/fonts/*.woff2`
 * `immutable` too, and `public/fonts/README.md` says why). Stale while
 * revalidate used to fetch every chunk again in the background on every use:
 * on a 3G link that is the whole JavaScript bundle downloaded twice, the
 * second time competing with the page being drawn.
 */
function isImmutableAssetPath(pathname) {
  if (pathname.startsWith("/_next/static/")) return true;
  return pathname.startsWith("/fonts/") && pathname.endsWith(".woff2");
}

/* A single pathological entry must not swallow the origin's storage quota. */
const MAX_CACHEABLE_BYTES = 5 * 1024 * 1024;

/*
 * HOW LONG A NAVIGATION WAITS FOR THE NETWORK BEFORE THE KEPT COPY ANSWERS,
 * on the paths that still wait (see NAVIGATIONS: a reload, Save-Data, a copy
 * that is too old or not whole, a second load moments after an instant one).
 * Only when there IS a kept copy: with nothing to show instead, the page waits
 * for the network as long as the browser does. The network keeps going in the
 * background and the fresh copy replaces the kept one (the page is told, and
 * refreshes itself quietly; `ConnectionLine`).
 */
const NAVIGATION_TIMEOUT_MS = 1200;
/* It was 3000. On a weak connection that was the three seconds the founder
   timed at every open: the kept page was on the phone and waited for a
   network that was not going to answer. 1200 is long enough for a healthy
   connection to win and short enough that a poor one never feels stuck. */

/*
 * THE INSTANT ANSWER'S LIMITS. A kept page answers at once only while it is
 * younger than this. Older than that, the network is asked first, as above.
 * Seven days covers "I opened it last week" (the copy refreshes itself in
 * place as soon as the page runs, so an old copy is on screen for a moment). The founder may move it.
 */
const INSTANT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/*
 * A SECOND DOCUMENT LOAD SOON AFTER AN INSTANT ANSWER GOES TO THE NETWORK.
 * Inside the app a tap is a data fetch, not a document load, so two document
 * loads within seconds mean a reload, or the router asking for a full load
 * because the kept page came from an older build. Answering that from the same
 * copy again could loop; the network answers it instead.
 */
const INSTANT_COOLDOWN_MS = 15 * 1000;

/* The offline shell is fetched again in the background at most this often. */
const SHELL_REFRESH_MS = 6 * 60 * 60 * 1000;

/*
 * THE MARK A KEPT DOCUMENT CARRIES ON ITS ROOT ELEMENT, written into the copy
 * when it is kept. The page reads it before any script that could ask the
 * network (`lib/offline/page-cache.ts`), and the stylesheet uses it to keep a
 * member's page under the passcode out of sight until the passcode guard has
 * decided (`app/css/passcode.css`). The root layout's `<html>` carries
 * `suppressHydrationWarning`, so an extra attribute there is not a mismatch.
 */
const KEPT_MARK_ATTRIBUTE = "data-vallo-kept";

/* Whether every script and stylesheet a kept page draws with was on the phone
   when it was kept: only such a page may answer at once. */
const WHOLE_HEADER = "x-vallo-whole";

/*
 * PAGES THE SERVER DRAWS TWO WAYS BY A COOKIE, and the cookie that decides.
 * `/welcome` shows the slides, or only the sign-in and sign-up choice for a
 * device that saw them in the last half hour (`vallo_first_run`, written by
 * the page itself, so not httpOnly). A copy kept one way must not answer at
 * once when the cookie now says the other, or the screen would open on the
 * slides and jump to the choice. The worker reads the cookie with the Cookie
 * Store API; where that is missing, such a page never answers at once.
 */
const COOKIE_VARIANT_PAGES = { "/welcome": "vallo_first_run" };
const VARIANT_HEADER = "x-vallo-variant";

/*
 * The variant of a page right now: "" for a page drawn one way only, the
 * cookie's value ("-" when absent) for a variant page, or null when the cookie
 * cannot be read here.
 */
async function pageVariant(pathname) {
  const name = Object.prototype.hasOwnProperty.call(COOKIE_VARIANT_PAGES, pathname) ? COOKIE_VARIANT_PAGES[pathname] : null;
  if (!name) return "";
  try {
    const store = self.cookieStore;
    if (!store || typeof store.get !== "function") return null;
    const cookie = await store.get(name);
    return cookie && typeof cookie.value === "string" && cookie.value ? cookie.value : "-";
  } catch {
    return null;
  }
}

/* How many pages and photographs one phone keeps, oldest out first. */
const MAX_PAGES_PER_VIEWER = 60;
const MAX_IMAGES = 200;

/* A page warmed in the background is not warmed again inside this window. */
const WARM_INTERVAL_MS = 5 * 60 * 1000;

/* The stamp `proxy.ts` puts on a document: a digest, or `anon`. */
const VIEWER_HEADER = "x-vallo-viewer";
const VIEWER_PATTERN = /^(anon|[a-f0-9]{16,64})$/;

/* What a page served from this phone says about itself, for `ConnectionLine`
   (read through `performance.getEntriesByType("navigation")[0].serverTiming`).
   "kept" is the slow or offline answer, which the line names; "instant" is
   the answer given at once while the network refreshes it, which the line
   keeps quiet about unless the refresh is slow. */
const FROM_CACHE_TIMING = 'vallo-kept;desc="kept"';
const INSTANT_TIMING = 'vallo-kept;desc="instant"';
/* An instant answer on Save-Data or a 2G link (item 2 of the fast-start plan,
   2 November 2026): shown at once like any other, but the page does not ask
   for a second render straight away; it refreshes once, when the copy the
   network is already fetching has been kept. */
const INSTANT_LIGHT_TIMING = 'vallo-kept;desc="instant-light"';

/* Where the shell's own start (`/open`, and `/` for the shell) lands offline,
   in order: the first of these this viewer has kept. */
const START_FALLBACKS = ["/home", "/search", "/stays", "/welcome"];

/* ------------------------------------------------------------------ helpers */

function firstSegment(pathname) {
  const parts = pathname.split("/");
  return parts.length > 1 ? parts[1] : "";
}

function isForbiddenPath(pathname) {
  return NEVER_CACHE_SEGMENTS.has(firstSegment(pathname));
}

function isCacheableAssetPath(pathname) {
  if (isForbiddenPath(pathname)) return false;
  return CACHEABLE_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/* Whether a page at this path may be kept on the phone at all. */
function isKeepablePagePath(pathname) {
  if (typeof pathname !== "string" || pathname.charAt(0) !== "/") return false;
  if (pathname.endsWith(".js") || pathname.endsWith(".webmanifest") || pathname.endsWith(".txt")) return false;
  const segment = firstSegment(pathname);
  if (segment.startsWith("(") || segment.startsWith("_")) return false;
  return !NEVER_KEEP_PAGE_SEGMENTS.has(segment);
}

/* The shell's start addresses, which only ever redirect. */
function isStartPath(pathname) {
  return pathname === "/open" || pathname === "/open/";
}

/*
 * The Save-Data hint. The header is checked first because that is the literal
 * signal on the request; navigator.connection is the fallback because a
 * browser-added header is not always visible to a worker.
 */
function saveDataRequested(request) {
  try {
    if (request && request.headers.get("save-data")) return true;
  } catch {
    /* Header access can throw on an opaque request. Fall through. */
  }
  const connection = self.navigator && self.navigator.connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === "2g" || connection.effectiveType === "slow-2g";
}

/*
 * Whether an ASSET response may be written to disk. Deliberately
 * conservative: any hint that this body was personalised, or that the server
 * asked for it not to be stored, is a refusal.
 */
function isStorableResponse(response) {
  if (!response || !response.ok || response.status !== 200) return false;
  if (response.type !== "basic" && response.type !== "default") return false;

  const headers = response.headers;
  // Set-Cookie is normally filtered out of a Response's headers, so this is a
  // belt-and-braces check rather than the primary defence. Vary: Cookie is the
  // signal that actually survives, and it means the body is per-session.
  if (headers.get("set-cookie")) return false;
  if (headers.get("authorization")) return false;
  const vary = (headers.get("vary") || "").toLowerCase();
  if (vary.includes("cookie") || vary === "*") return false;
  const control = (headers.get("cache-control") || "").toLowerCase();
  if (control.includes("no-store") || control.includes("private")) return false;

  const length = Number(headers.get("content-length") || "0");
  if (length > MAX_CACHEABLE_BYTES) return false;

  return true;
}

/*
 * Whether a document response is the shape a kept page may take: a plain 200
 * HTML answer from our own origin, not a redirect, not too large. Pages are
 * personal by nature (`Cache-Control: private, no-store` is what every
 * dynamic page carries, and that directive is about shared HTTP caches), so
 * the rule for a page is not the asset rule: it is this shape plus the
 * server's own stamp (`keepPage`).
 */
function isKeepableDocument(response) {
  if (!response || response.status !== 200 || !response.ok) return false;
  if (response.type !== "basic" && response.type !== "default") return false;
  if (response.redirected) return false;
  const headers = response.headers;
  if (headers.get("set-cookie")) return false;
  const type = (headers.get("content-type") || "").toLowerCase();
  if (!type.startsWith("text/html")) return false;
  const length = Number(headers.get("content-length") || "0");
  return length <= MAX_CACHEABLE_BYTES;
}

/*
 * The stamp in the document head (`app/layout.tsx`): the viewer and the path
 * the server rendered. It is the copy the Android app can read, because
 * Capacitor fetches every document itself to put its bridge in and hands the
 * page its own default headers, following any redirect out of sight. Only the
 * head is searched.
 */
function metaStamp(html) {
  if (typeof html !== "string") return null;
  const head = html.slice(0, 64 * 1024);
  const tag = /<meta\b[^>]*\bname="x-vallo-viewer"[^>]*>/i.exec(head);
  if (!tag) return null;
  const content = /\bcontent="([^"]*)"/i.exec(tag[0]);
  const path = /\bdata-path="([^"]*)"/i.exec(tag[0]);
  const viewer = content ? content[1].trim().toLowerCase() : "";
  if (!VIEWER_PATTERN.test(viewer) || !path) return null;
  return { viewer, path: path[1].replace(/&amp;/g, "&") };
}

/*
 * The copy's root element, marked as kept (KEPT_MARK_ATTRIBUTE). Only the
 * first `<html` tag is touched, and a copy that already carries the mark is
 * left as it is.
 */
function withKeptMark(html) {
  if (typeof html !== "string") return html;
  const at = html.search(/<html[\s>]/i);
  if (at < 0) return html;
  const tagEnd = html.indexOf(">", at);
  const tag = tagEnd < 0 ? html.slice(at) : html.slice(at, tagEnd);
  if (tag.indexOf(KEPT_MARK_ATTRIBUTE) !== -1) return html;
  return `${html.slice(0, at + 5)} ${KEPT_MARK_ATTRIBUTE}=""${html.slice(at + 5)}`;
}

/* The viewer a response NAMES, kept or not: enough to notice a change of account. */
function namedViewer(response) {
  try {
    const viewer = ((response && response.headers.get(VIEWER_HEADER)) || "").trim().toLowerCase();
    return VIEWER_PATTERN.test(viewer) ? viewer : null;
  } catch {
    return null;
  }
}

function carriesCredentials(request) {
  try {
    return Boolean(request.headers.get("authorization"));
  } catch {
    return false;
  }
}

/*
 * THE ASSET CACHE KEY, WITHOUT THE DEPLOYMENT ID. V-78.
 *
 * On Vercel every `/_next/static/` URL carries `?dpl=<deployment id>` for
 * skew protection. The fetch handler used to cache only URLs with an empty
 * query string, so on production it cached NOTHING: every chunk carries the
 * query. And had it cached them with the query, each deploy would change every
 * key, and a returning person would re-download about 450 KB of JavaScript
 * whose bytes had not changed (fifty deploys reached main on 23 September).
 *
 * The chunk's file name is a hash of its content, so the query adds nothing
 * to identity: the key is the path, with `dpl` dropped. Any OTHER query
 * parameter still refuses the cache, because an unknown parameter might
 * change the bytes.
 */
function assetCacheKey(url) {
  const params = new URLSearchParams(url.search);
  params.delete("dpl");
  if (Array.from(params.keys()).length > 0) return null;
  return url.origin + url.pathname;
}

/*
 * A page's key: the address as asked for, with the router's own cache-busting
 * parameter and the fragment dropped. The search stays, because `/search?q=`
 * with two different questions is two different pages.
 */
function pageCacheKey(url) {
  const params = new URLSearchParams(url.search);
  params.delete("_rsc");
  const search = params.toString();
  return url.origin + url.pathname + (search ? `?${search}` : "");
}

/*
 * A listing photograph the optimiser has already sized for this phone
 * (`/_next/image?url=...&w=...&q=...`). The query IS the identity here (the
 * source, the width and the quality), so the key is the whole address. The
 * `Accept` header picks AVIF or WebP, and one phone always sends the same one.
 */
function imageCacheKey(url) {
  if (url.pathname !== "/_next/image") return null;
  const params = new URLSearchParams(url.search);
  if (!params.get("url") || !params.get("w")) return null;
  params.delete("dpl");
  return `${url.origin}${url.pathname}?${params.toString()}`;
}

/* The page cache's name for a viewer. */
function pageCacheName(viewer) {
  return PAGE_CACHE_PREFIX + viewer;
}

/*
 * The offline document's stylesheet and scripts are hashed Next chunks whose
 * names this file cannot know, so they are discovered by reading the
 * precached HTML once at install time. Without the stylesheet the offline page
 * renders as unstyled markup; without the scripts (V-35) the gate code on it
 * cannot run, and the gate is exactly where there is no signal.
 *
 * A KNOWN LIMIT. The precached page carries the server-action ids of the
 * deploy that installed this worker. After a later deploy those ids are stale,
 * so the offline page never calls a server action: it only reads IndexedDB,
 * and queued check-ins are handed over from live pages (`GateHandshake`
 * with `live`), which always carry current ids.
 */
function offlineAssetUrls(html) {
  const found = new Set();
  const pattern = /(?:href|src)="(\/_next\/static\/[^"]+\.(?:css|js)(?:\?[^"]*)?)"/g;
  let match = pattern.exec(html);
  while (match !== null) {
    found.add(match[1].replace(/&amp;/g, "&"));
    match = pattern.exec(html);
  }
  return Array.from(found);
}

/* Keep the assets a document needs, so it can be drawn again offline. Under
   Save-Data only the ones already on the phone count (`frugal`), because a
   second download is the thing being saved. */
async function keepDocumentAssets(html, frugal) {
  if (frugal) return;
  const assets = await caches.open(ASSET_CACHE);
  await Promise.all(
    offlineAssetUrls(html).map(async (path) => {
      try {
        const url = new URL(path, self.location.origin);
        const key = assetCacheKey(url);
        if (!key) return;
        if (await assets.match(key)) return;
        const fetched = await fetch(url.href);
        if (isStorableResponse(fetched)) await assets.put(key, fetched);
      } catch {
        /* One missing chunk costs that chunk, never the install. */
      }
    }),
  );
}

/* Whether every one of these assets is on the phone. */
async function assetsAllKept(paths) {
  try {
    const assets = await caches.open(ASSET_CACHE);
    for (const path of paths) {
      const key = assetCacheKey(new URL(path, self.location.origin));
      if (!key) return false;
      if (!(await assets.match(key))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function precacheOfflineAssets(shell) {
  try {
    const response = await shell.match(OFFLINE_URL);
    if (!response) return;
    await keepDocumentAssets(await response.clone().text());
  } catch {
    /* A missing stylesheet costs styling, never correctness. */
  }
}

/*
 * WHEN THE SHELL WAS LAST FETCHED AGAIN. In memory while this worker lives,
 * and in the META cache across restarts. The install writes it, so the clock
 * starts with the copy the install fetched.
 */
const SHELL_STAMP_KEY = "/__vallo/shell-refreshed";
let shellRefreshedAt;

async function readShellStamp() {
  if (shellRefreshedAt !== undefined) return shellRefreshedAt;
  try {
    const meta = await caches.open(META_CACHE);
    const stored = await meta.match(SHELL_STAMP_KEY);
    shellRefreshedAt = stored ? Number(await stored.text()) || 0 : 0;
  } catch {
    shellRefreshedAt = 0;
  }
  return shellRefreshedAt;
}

async function writeShellStamp(at) {
  shellRefreshedAt = at;
  try {
    const meta = await caches.open(META_CACHE);
    await meta.put(SHELL_STAMP_KEY, new Response(String(at)));
  } catch {
    /* Unrecorded: the next navigation simply checks again. */
  }
}

/*
 * THE SHELL, STALE WHILE REVALIDATE. The offline screen answers from the phone
 * as always; once the network has just answered a navigation, and at most
 * every SHELL_REFRESH_MS, the shell is fetched again behind it, with the
 * chunks it draws with. So the offline screen follows the deploys (its styles
 * and its gate code) instead of staying the copy this worker installed. Never
 * under Save-Data, and a failed fetch keeps the copy there was.
 */
async function refreshShellIfDue(frugal) {
  if (frugal) return;
  const now = Date.now();
  const last = await readShellStamp();
  if (!last) {
    /* No record yet (a worker installed before this rule): start the clock. */
    await writeShellStamp(now);
    return;
  }
  if (now - last < SHELL_REFRESH_MS) return;
  await writeShellStamp(now);
  try {
    const shell = await caches.open(SHELL_CACHE);
    await Promise.all(
      SHELL_ASSETS.map(async (path) => {
        try {
          const response = await fetch(path, { cache: "no-cache" });
          if (response && response.ok && response.status === 200 && !response.redirected) await shell.put(path, response);
        } catch {
          /* This one keeps its old copy. */
        }
      }),
    );
    await precacheOfflineAssets(shell);
  } catch {
    /* The old shell stays. */
  }
}

/* Oldest out first, so one cache never grows past its share. */
async function trim(cache, max) {
  try {
    const keys = await cache.keys();
    const excess = keys.length - max;
    for (let i = 0; i < excess; i += 1) await cache.delete(keys[i]);
  } catch {
    /* A cache that cannot be listed is left as it is. */
  }
}

/* ------------------------------------------------------------- the viewer */

/*
 * WHO THE KEPT PAGES BELONG TO. Remembered in its own small cache so it
 * survives the worker being stopped and started, which a browser does all the
 * time. Read and written only here.
 */
const VIEWER_KEY = "/__vallo/viewer";

/* The record, held in memory while this worker lives, so a navigation does
   not open a cache to learn it; `undefined` means not read yet. */
let viewerMemo;

async function readViewer() {
  if (viewerMemo !== undefined) return viewerMemo;
  try {
    const meta = await caches.open(META_CACHE);
    const stored = await meta.match(VIEWER_KEY);
    const viewer = stored ? (await stored.text()).trim() : "";
    viewerMemo = VIEWER_PATTERN.test(viewer) ? viewer : null;
  } catch {
    return null;
  }
  return viewerMemo;
}

async function writeViewer(viewer) {
  viewerMemo = viewer || null;
  try {
    const meta = await caches.open(META_CACHE);
    if (viewer) await meta.put(VIEWER_KEY, new Response(viewer));
    else await meta.delete(VIEWER_KEY);
  } catch {
    /* Without a record nothing is served from a page cache, which is safe. */
  }
}

/* Delete every kept page that does not belong to `keep` (all of them for null). */
async function forgetPagesExcept(keep) {
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith("vallo-pages-") && (!keep || name !== pageCacheName(keep)))
        .map((name) => caches.delete(name)),
    );
  } catch {
    /* Nothing listed, nothing to forget. */
  }
}

/*
 * A response named a viewer: if it is a different one, the previous viewer's
 * pages go before anything else happens.
 */
async function noteViewer(viewer) {
  if (!viewer) return;
  const current = await readViewer();
  if (current === viewer) return;
  await forgetPagesExcept(viewer);
  await writeViewer(viewer);
}

/*
 * The headers a kept page carries: the server's own (its Content Security
 * Policy above all, whose nonce the kept markup still carries), minus the ones
 * that describe the wire rather than the page. The body is kept decoded, so a
 * Content-Encoding would make the browser try to decode it twice.
 */
const DROPPED_ON_KEEP = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "set-cookie",
  "cache-control",
  "etag",
  "last-modified",
  "vary",
  "age",
  "date",
]);

function keptHeaders(source, viewer) {
  const headers = new Headers();
  source.forEach((value, name) => {
    if (!DROPPED_ON_KEEP.has(name.toLowerCase())) headers.set(name, value);
  });
  if (!headers.get("content-type")) headers.set("content-type", "text/html; charset=utf-8");
  headers.set(VIEWER_HEADER, viewer);
  headers.set("x-vallo-kept-at", String(Date.now()));
  return headers;
}

/*
 * Keep one document for the viewer the SERVER names, and notice a change of
 * account on any document at all. The header is read first; the head's stamp
 * is read from the body. When both are there they must agree, and when the
 * head says the server rendered a different address (a redirect followed out
 * of sight, as Capacitor's Android proxy does) nothing is kept.
 */
async function keepPage(url, response) {
  const headerViewer = namedViewer(response);
  if (!isKeepableDocument(response)) {
    await noteViewer(headerViewer);
    return false;
  }
  let body;
  try {
    body = await response.text();
  } catch {
    await noteViewer(headerViewer);
    return false;
  }
  const meta = metaStamp(body);
  if (headerViewer && meta && meta.viewer !== headerViewer) return false;
  const viewer = headerViewer || (meta ? meta.viewer : null);
  await noteViewer(viewer);
  if (!viewer || !isKeepablePagePath(url.pathname)) return false;
  if (meta && meta.path !== url.pathname) return false;
  try {
    /* The chunks this page draws with, so it can be drawn again offline,
       kept BEFORE the page so the copy can say whether it is whole: only a
       whole copy may answer at once (`mayAnswerInstantly`). */
    const assetPaths = offlineAssetUrls(body);
    await keepDocumentAssets(body, saveDataRequested(null));
    const whole = assetPaths.length > 0 && (await assetsAllKept(assetPaths));
    const headers = keptHeaders(response.headers, viewer);
    if (whole) headers.set(WHOLE_HEADER, "1");
    /* Which way a two-way page was drawn; unknown leaves it unable to answer at once. */
    const variant = await pageVariant(url.pathname);
    if (variant) headers.set(VARIANT_HEADER, variant);
    const cache = await caches.open(pageCacheName(viewer));
    const key = pageCacheKey(url);
    /* Delete first so a re-kept page moves to the back of the queue. */
    await cache.delete(key);
    await cache.put(key, new Response(withKeptMark(body), { status: 200, headers }));
    await trim(cache, MAX_PAGES_PER_VIEWER);
    return true;
  } catch {
    return false;
  }
}

/* The kept copy of a page for the current viewer, with the key it was kept
   under (a start path is answered by another page's copy), or undefined. */
async function keptPage(url) {
  if (!isKeepablePagePath(url.pathname) && !isStartPath(url.pathname) && url.pathname !== "/") return undefined;
  const viewer = await readViewer();
  if (!viewer) return undefined;
  try {
    const cache = await caches.open(pageCacheName(viewer));
    /* The shell's start only ever redirects, so it is answered by where it
       would have gone; the front door, by itself first. */
    const fallbacks = START_FALLBACKS.map((path) => url.origin + path);
    const candidates = isStartPath(url.pathname)
      ? fallbacks
      : url.pathname === "/"
        ? [pageCacheKey(url), ...fallbacks]
        : [pageCacheKey(url)];
    for (const key of candidates) {
      const hit = await cache.match(key, { ignoreVary: true, ignoreSearch: false });
      if (hit) return { response: hit, key };
    }
  } catch {
    /* Fall through to the network or the offline screen. */
  }
  return undefined;
}

/* A kept page, marked so the page can tell it is showing what was seen last,
   and which way it came: `timing` is FROM_CACHE_TIMING or INSTANT_TIMING. */
function markKept(response, timing) {
  const headers = new Headers(response.headers);
  headers.set("server-timing", timing || FROM_CACHE_TIMING);
  headers.set("cache-control", "no-store");
  headers.delete(WHOLE_HEADER);
  headers.delete(VARIANT_HEADER);
  return new Response(response.body, { status: 200, statusText: "OK", headers });
}

/* Tell every open Vallo tab on this address that a fresh copy has landed. */
async function announceFresh(url) {
  try {
    const list = await self.clients.matchAll({ type: "window" });
    for (const client of list) {
      try {
        const at = new URL(client.url);
        if (at.pathname === url.pathname) client.postMessage({ type: "vallo:page-fresh", path: url.pathname });
      } catch {
        /* A client with no readable address is skipped. */
      }
    }
  } catch {
    /* No clients to tell. */
  }
}

/* ------------------------------------------------------------------ install */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(SHELL_CACHE);
        await cache.addAll(SHELL_ASSETS);
        await precacheOfflineAssets(cache);
        /* The shell's refresh clock starts with this copy. */
        await writeShellStamp(Date.now());
      } catch {
        /*
         * A failed precache must not wedge the install. The worker simply has
         * no offline shell this time round and will try again on the next
         * version.
         */
      }
      await self.skipWaiting();
    })(),
  );
});

/* ----------------------------------------------------------------- activate */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("vallo-") &&
              !CURRENT_CACHES.includes(name) &&
              !name.startsWith(PAGE_CACHE_PREFIX),
          )
          .map((name) => caches.delete(name)),
      );
      /*
       * NAVIGATION PRELOAD. A browser stops an idle worker after about thirty
       * seconds, so on nearly every open the worker has to start before it
       * can answer, and without preload the request for the page waited for
       * that start. With it, the browser sends the request while the worker
       * wakes (`networkAnswer`). Feature detected: a browser without it is
       * unchanged.
       */
      try {
        if (self.registration && self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }
      } catch {
        /* Not offered here: the worker fetches the page itself. */
      }
      await self.clients.claim();
    })(),
  );
});

/* -------------------------------------------------------------------- fetch */

/* The screen for a page this phone has never kept, asked for with no network. */
async function offlineFallback() {
  const cached = await caches.match(OFFLINE_URL);
  if (cached) return cached;
  return new Response("You are offline. Reconnect and try again.", {
    status: 503,
    statusText: "Offline",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/*
 * THE NETWORK'S ANSWER TO A NAVIGATION. With navigation preload on (see the
 * activate step), the browser sent the request while this worker was waking,
 * so the answer never waits for the worker to start. Without it, or when the
 * preload was refused, the worker asks itself.
 */
function networkAnswer(event) {
  return (async () => {
    try {
      const preloaded = await event.preloadResponse;
      if (preloaded) return preloaded;
    } catch {
      /* A refused preload: ask once more below. */
    }
    return fetch(event.request);
  })();
}

/* A redirect the browser would follow: the page refreshing itself follows it too. */
function isRedirectAnswer(response) {
  if (!response) return false;
  if (response.type === "opaqueredirect") return true;
  return response.status >= 300 && response.status < 400;
}

/* Whether the person asked for the network outright (a reload). */
function askedForNetwork(request) {
  try {
    const mode = request.cache;
    return mode === "reload" || mode === "no-cache" || mode === "no-store";
  } catch {
    return false;
  }
}

/* When this worker last answered a navigation at once (INSTANT_COOLDOWN_MS). */
let lastInstantAt = 0;

/*
 * Whether a kept copy may answer before the network does. Only a whole copy
 * (every script and stylesheet it needs is on the phone, so it draws and
 * becomes interactive with no signal), younger than INSTANT_MAX_AGE_MS, not
 * on a reload, and not moments after the last instant answer.
 *
 * SAVE-DATA AND 2G ARE ALLOWED (2 November 2026). They used to be refused, on
 * the grounds that the refresh behind an instant answer is a second download,
 * so the people on the weakest links were the ones made to wait up to
 * NAVIGATION_TIMEOUT_MS for the copy they would have been shown anyway. Now
 * they get it at once, marked INSTANT_LIGHT_TIMING, and the page skips the
 * immediate refresh (`ConnectionLine`): one refresh, when the network's copy
 * has been kept, which is the same spending as the slow path, without the wait.
 */
async function mayAnswerInstantly(request, kept, now, pathname) {
  if (askedForNetwork(request)) return false;
  if (now - lastInstantAt < INSTANT_COOLDOWN_MS) return false;
  const headers = kept.headers;
  if (headers.get(WHOLE_HEADER) !== "1") return false;
  const keptAt = Number(headers.get("x-vallo-kept-at") || "0");
  if (!keptAt || keptAt > now + 60 * 1000) return false;
  if (now - keptAt > INSTANT_MAX_AGE_MS) return false;
  /* A two-way page answers at once only when it was kept the way it would be drawn now. */
  const variant = await pageVariant(pathname);
  if (variant === null) return false;
  return variant === "" || headers.get(VARIANT_HEADER) === variant;
}

/*
 * NAVIGATIONS: THE PHONE'S COPY AT ONCE WHERE IT MAY, THE NETWORK BEHIND IT.
 *
 *   - The network always starts at once (preload), and whatever it answers
 *     is kept for next time.
 *   - The shell's start (`/open`, which only ever redirects) with a page kept
 *     for this viewer: a redirect to that page at once, so the address and the
 *     page agree and the start costs no round trip.
 *   - A kept copy that `mayAnswerInstantly`: shown at once, marked "instant".
 *     The page refreshes itself in place as soon as it is running
 *     (`ConnectionLine`), and is told again when the fresh copy is kept.
 *   - Any other kept copy: the network has NAVIGATION_TIMEOUT_MS. If it
 *     answers, that answer is shown and kept. If it fails or is slower, the
 *     kept copy is shown, marked "kept", and the network carries on; when it
 *     lands, the fresh copy is kept and the page is told (`vallo:page-fresh`),
 *     and it refreshes itself in place.
 *   - With no kept copy: the network as long as it takes, and the offline
 *     screen only if it fails outright.
 */
function handleNavigation(event) {
  const request = event.request;
  const url = new URL(request.url);
  const key = pageCacheKey(url);

  /* Which answer the page got, so a fresh copy that lands after the kept one
     was shown can tell the page to refresh itself. */
  let settled = "pending";

  /* This document is already on its way, so the page's own announcement of
     the visit (`vallo:visited`) need not fetch it a second time. */
  lastWarmed.set(key, Date.now());

  /* The network starts at once, beside the cache read, and the copy is kept
     in the background: the page gets its answer as it streams, never after
     the whole document has been read for keeping. */
  /*
   * The page on screen is the phone's copy, so it hears that the network has
   * answered. A redirect counts (the session ended, say: the refresh follows
   * it); an error page does not, and the copy stays on screen. Asked from both
   * sides, because either can finish first: the network may have answered
   * and been kept before the decision to show the copy was taken.
   */
  let worthTelling = false;
  let told = false;
  const tell = async () => {
    if (told || !worthTelling || (settled !== "kept" && settled !== "instant")) return;
    told = true;
    await announceFresh(url);
  };

  /* The network's answer once it is in, untouched (the copy kept below is a clone). */
  let reply = null;
  const network = networkAnswer(event);
  const keeping = network
    .then(async (response) => {
      reply = response;
      const fresh = await keepPage(url, response.clone());
      /* Just kept: the page's own announcement need not fetch it again. */
      if (fresh) lastWarmed.set(key, Date.now());
      worthTelling = fresh || response.ok || isRedirectAnswer(response);
      await tell();
      if (response.ok) await refreshShellIfDue(saveDataRequested(request));
    })
    .catch(() => undefined);
  event.waitUntil(keeping);

  return (async () => {
    const kept = await keptPage(url);

    if (!kept) {
      try {
        const response = await network;
        settled = "network";
        return response;
      } catch {
        settled = "offline";
        return offlineFallback();
      }
    }

    if (kept.key !== key && isStartPath(url.pathname)) {
      settled = "redirected";
      return Response.redirect(kept.key, 302);
    }

    const now = Date.now();
    if (kept.key === key && (await mayAnswerInstantly(request, kept.response, now, url.pathname))) {
      /* The network was quicker than the cache after all: show the fresh page. */
      if (reply && reply.ok && !reply.redirected) {
        settled = "network";
        return reply;
      }
      settled = "instant";
      lastInstantAt = now;
      event.waitUntil(tell());
      return markKept(kept.response, saveDataRequested(request) ? INSTANT_LIGHT_TIMING : INSTANT_TIMING);
    }

    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve("timeout"), NAVIGATION_TIMEOUT_MS);
    });
    const outcome = await Promise.race([network.then((r) => r, () => "failed"), timeout]);
    clearTimeout(timer);

    if (outcome !== "timeout" && outcome !== "failed") {
      settled = "network";
      return outcome;
    }
    settled = "kept";
    event.waitUntil(tell());
    return markKept(kept.response, FROM_CACHE_TIMING);
  })();
}

/*
 * The hashed build output and the versioned fonts (`isImmutableAssetPath`):
 * cache first, and never fetched again once on the phone. A miss is fetched,
 * kept, and answered.
 */
async function handleImmutable(event, key) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(key);
  if (cached) return cached;
  try {
    const response = await fetch(event.request);
    if (isStorableResponse(response)) {
      const stored = cache.put(key, response.clone()).catch(() => {
        /* Quota or a rejected key. The asset is still answered. */
      });
      if (typeof event.waitUntil === "function") event.waitUntil(stored);
    }
    return response;
  } catch {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

/*
 * The other kept assets (brand artwork, icons): stale while revalidate. The
 * cached copy answers immediately, a background fetch refreshes it for next
 * time. Under Save-Data the cached copy answers with no background fetch at
 * all.
 */
async function handleAsset(request, key) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(key);

  if (cached && saveDataRequested(request)) return cached;

  const network = fetch(request)
    .then((response) => {
      if (isStorableResponse(response)) {
        cache.put(key, response.clone()).catch(() => {
          /* Quota or a rejected key. Not worth failing the request over. */
        });
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) return cached;

  const fresh = await network;
  if (fresh) return fresh;
  return new Response("", { status: 504, statusText: "Offline" });
}

/*
 * Photographs: cache first. An optimised image at a given address never
 * changes (the source, the width and the quality are all in the address), so
 * once this phone has paid for it, it never pays again, and a listing it has
 * seen still has its pictures with no signal.
 */
async function handleImage(request, key) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(key);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isStorableResponse(response)) {
      cache
        .put(key, response.clone())
        .then(() => trim(cache, MAX_IMAGES))
        .catch(() => {
          /* Quota. The photograph still shows. */
        });
    }
    return response;
  } catch {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only plain GETs are ours. Anything that mutates state goes straight out.
  if (request.method !== "GET") return;
  if (carriesCredentials(request)) return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Same origin only. Third-party bytes are not ours to store.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  const imageKey = imageCacheKey(url);
  if (imageKey) {
    event.respondWith(handleImage(request, imageKey));
    return;
  }

  if (isCacheableAssetPath(url.pathname)) {
    const key = assetCacheKey(url);
    if (key) {
      event.respondWith(isImmutableAssetPath(url.pathname) ? handleImmutable(event, key) : handleAsset(request, key));
      return;
    }
  }

  // Everything else, including every API and authenticated data response, is
  // left entirely alone: no interception, no cache, no stale answer.
});

/* ---------------------------------------------------------------- messages */

/*
 * WHAT A PAGE MAY ASK OF THIS WORKER, and nothing else:
 *
 *   `vallo:visited`   a page the router opened without a document load (a
 *                     tap inside the app is a data fetch, not a page load, so
 *                     this worker never saw it). The worker fetches that one
 *                     address as a document, in the background, once per
 *                     WARM_INTERVAL_MS, and keeps it under the viewer the
 *                     server names. Never under Save-Data or on 2g.
 *   `vallo:forget`    sign-out: every kept page is deleted and the viewer
 *                     forgotten. The page deletes them itself too
 *                     (`lib/offline/page-cache.ts`); this is the second hand.
 *
 * A message only ever narrows what is kept or asks for a same-origin page the
 * server will stamp for itself; no message can choose whose page is kept.
 */
const lastWarmed = new Map();

async function warmPage(path) {
  if (typeof path !== "string" || path.length > 2000) return;
  let url;
  try {
    url = new URL(path, self.location.origin);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin || !isKeepablePagePath(url.pathname)) return;
  if (saveDataRequested(null)) return;
  const key = pageCacheKey(url);
  const now = Date.now();
  const last = lastWarmed.get(key) || 0;
  if (now - last < WARM_INTERVAL_MS) return;
  lastWarmed.set(key, now);
  if (lastWarmed.size > 200) lastWarmed.delete(lastWarmed.keys().next().value);
  try {
    const response = await fetch(url.href, {
      credentials: "same-origin",
      redirect: "manual",
      headers: { accept: "text/html", "x-vallo-warm": "1" },
    });
    await keepPage(url, response);
  } catch {
    /* No signal: the page is warmed the next time it is opened. */
  }
}

self.addEventListener("message", (event) => {
  const data = event && event.data;
  if (!data || typeof data !== "object") return;
  if (event.origin && event.origin !== self.location.origin) return;
  if (data.type === "vallo:visited") {
    const work = warmPage(data.path);
    if (typeof event.waitUntil === "function") event.waitUntil(work);
    return;
  }
  if (data.type === "vallo:forget") {
    const work = (async () => {
      await forgetPagesExcept(null);
      await writeViewer(null);
      lastWarmed.clear();
    })();
    if (typeof event.waitUntil === "function") event.waitUntil(work);
  }
});

/* =========================================================================
 *                              THE PUSH HALF
 * =========================================================================
 *
 * WITHOUT THIS, WEB PUSH DOES NOTHING VISIBLE. A push arrives at a service
 * worker and a service worker has to CHOOSE to display it. A browser that
 * receives a push its worker does not show may put up its own "this site has
 * been updated in the background" notice instead, which is worse than a plain
 * one of ours. So every branch below ends in `showNotification`, including
 * the branches where the payload could not be read at all.
 *
 * NOTHING HERE TOUCHES THE CACHE AND NOTHING ABOVE TOUCHES A NOTIFICATION.
 * The two halves share this file and nothing else, which is what makes it
 * safe for them to share a registration.
 *
 * WHAT THE SERVER SENDS. `lib/push/transport/webpush.ts` encrypts exactly
 * this object and nothing else:
 *
 *     { title, body, href, tag, urgent }
 *
 * Every field is re-checked here. The sender already refuses an off-origin
 * href; this refuses it again, because a notification is a place a tap leaves
 * the application from and it is not a place to take a sender's word for a
 * destination. A push service cannot read the ciphertext, but a compromised
 * application server could, and the second check costs four lines.
 */

/* The only icon this file names. It is in SHELL_ASSETS above, so it is
   already on disk and a notification has an icon with no network at all. A
   notification with no icon falls back to the browser's own mark, which on
   Android is a grey circle nobody recognises.

   THERE IS DELIBERATELY NO `badge`. Android draws the badge as a flat
   monochrome silhouette in the status bar, and there is no monochrome Vallo
   mark in `public/`. Pointing at one that does not exist looks like care and
   behaves exactly like omitting it, so it is omitted and the missing asset is
   recorded in `docs/push/FIRST_NOTIFICATION.md` instead. */
const PUSH_ICON = "/pwa/icon-192.png";

/* Where a tap goes when the payload names nowhere. Always a truthful
   destination: the list holds every notification the person has. */
const PUSH_FALLBACK_HREF = "/notifications";

/*
 * ON-DEVICE COLLAPSING, WHICH IS A DIFFERENT PROBLEM FROM THE SERVER'S.
 *
 * `lib/push/policy.ts` folds a backlog at the moment one drain run sends it.
 * It cannot fold what it already sent. A person who leaves their phone on the
 * table for an hour gets one push per drain, five minutes apart, and the
 * shade fills up with rows the server thinks it has already been careful
 * about. This is the only place that can see what is actually on the screen.
 *
 * Above this many ordinary Vallo notifications, they become one that says how
 * many. Three matches COLLAPSE_THRESHOLD in the policy on purpose: two
 * different answers to "how many is too many" would be worse than either.
 */
const DEVICE_COLLAPSE_AT = 3;

/*
 * Read one push payload into the notification it should become.
 *
 * Pure: it takes a parsed value and returns a description. Every guard here
 * is a branch a test can reach without a browser, which is the reason it is a
 * function rather than a block inside the listener.
 */
function notificationFromPayload(raw) {
  const payload = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

  const title =
    typeof payload.title === "string" && payload.title.trim().length > 0
      ? payload.title
      : "Vallo";
  const body = typeof payload.body === "string" ? payload.body : "";
  const tag =
    typeof payload.tag === "string" && payload.tag.trim().length > 0 ? payload.tag : "vallo";
  const urgent = payload.urgent === true;
  const actions = pushActionsFrom(payload.actions);

  return {
    title,
    tag,
    urgent,
    options: {
      body,
      icon: PUSH_ICON,
      /* The collapse key. A second notification with the same tag REPLACES
         the first rather than stacking, which is what keeps eleven messages
         in one conversation to one row in the shade. */
      tag,
      /* RE-ALERT ONLY FOR THE URGENT, AND THIS IS NOT A DETAIL.

         The tag is per person per kind, so "your withdrawal failed" replaces
         "your wallet was credited" on the same row. Replacing silently is
         right for a conversation and wrong for money: the person would never
         learn the second thing happened. Urgent replacements buzz again.
         Ordinary ones do not, because re-alerting for a replacement is how a
         phone ends up buzzing eleven times for one conversation anyway. */
      renotify: urgent,
      /* Money and security stay on the screen until they are dealt with.
         Ignored on platforms that do not support it, which is fine: it can
         only ever make an urgent notification easier to miss, never a
         non-urgent one harder to dismiss. */
      requireInteraction: urgent,
      /* B11: an fyi (a like, a follow) never wakes the phone. Never urgent. */
      silent: payload.quiet === true && !urgent,
      /* Everything the tap handler needs, and nothing that identifies a
         device. `count` is what makes a summary countable; see below. */
      data: {
        href: safePushHref(payload.href),
        urgent,
        count: 1,
        /* V-53: where each button goes, keyed by its id. */
        actionHrefs: Object.fromEntries(actions.map((a) => [a.action, a.href])),
      },
      /* V-53: at most two buttons, each a destination inside Vallo. A
         browser that draws none simply ignores this. */
      actions: actions.map((a) => ({ action: a.action, title: a.title })),
    },
  };
}

/*
 * A destination, or the notifications list.
 *
 * Only a path on our own origin is ever carried. `//host` is a
 * protocol-relative URL and leaves the origin, and so do "/\\host" and a
 * tab or newline after the slash. This mirrors `lib/push/same-origin.ts`
 * (a test runs both over the same escapes) deliberately: the
 * sender checks and the receiver checks, and neither trusts the other.
 */
function safePushHref(href) {
  if (typeof href !== "string") return PUSH_FALLBACK_HREF;
  const trimmed = href.trim();
  if (trimmed.charAt(0) !== "/" || trimmed.length > 2000) return PUSH_FALLBACK_HREF;
  /* "/\\host" and "/\t/host" resolve off the origin just as "//host" does. */
  if (/[\\\u0000-\u001f\u007f]/.test(trimmed)) return PUSH_FALLBACK_HREF;
  let resolved;
  try {
    resolved = new URL(trimmed, "https://vallo.invalid");
  } catch (_) {
    return PUSH_FALLBACK_HREF;
  }
  if (resolved.origin !== "https://vallo.invalid") return PUSH_FALLBACK_HREF;
  return resolved.pathname + resolved.search + resolved.hash;
}

/*
 * The buttons, re-checked. The sender builds them from a fixed list
 * (`lib/push/actions.ts`); this refuses anything that is not a short id, a
 * short title and a path on our own origin, and keeps two at most.
 */
function pushActionsFrom(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (out.length >= 2) break;
    if (!item || typeof item !== "object") continue;
    const id = typeof item.id === "string" && /^[a-z-]{1,24}$/.test(item.id) ? item.id : null;
    const title = typeof item.title === "string" && item.title.length > 0 && item.title.length <= 40 ? item.title : null;
    const href = safePushHref(item.href);
    if (!id || !title || href === PUSH_FALLBACK_HREF) continue;
    out.push({ action: id, title, href });
  }
  return out;
}

/* How many real events an already-displayed notification stands for. */
function representedCount(notification) {
  const data = notification && notification.data;
  const count = data && data.count;
  return typeof count === "number" && count >= 1 ? count : 1;
}

/*
 * Decide what the shade should look like once this one arrives.
 *
 * Returns either the single notification, or a summary plus the list of
 * notifications to close first. Pure, and separated from the listener for the
 * same reason as above: the awkward cases here (a replacement must not count
 * as an arrival; an urgent row must never be folded or closed) are exactly
 * the ones that are painful to reach through a browser.
 */
function planShade(existing, incoming) {
  /* URGENT IS NEVER FOLDED AND NEVER CLOSED. A reversed transaction does not
     become "4 updates", and it does not disappear because four messages
     arrived after it. */
  if (incoming.urgent) return { close: [], show: incoming };

  const ordinary = (existing || []).filter(
    (notification) => !(notification.data && notification.data.urgent === true),
  );

  /* A notification with this tag is being REPLACED, not added to. Counting it
     as an arrival would collapse the shade after three messages in one
     conversation, which is the thing the tag exists to prevent. */
  const replacing = ordinary.some((notification) => notification.tag === incoming.tag);
  const already = ordinary.reduce(
    (total, notification) => total + representedCount(notification),
    0,
  );
  const total = replacing ? Math.max(already, 1) : already + 1;

  if (total <= DEVICE_COLLAPSE_AT) return { close: [], show: incoming };

  return {
    close: ordinary,
    show: {
      title: "Vallo",
      tag: "vallo-summary",
      urgent: false,
      options: {
        body: `${total} things happened while you were away`,
        icon: PUSH_ICON,
        tag: "vallo-summary",
        /* A summary that grows is a summary worth looking at again. */
        renotify: true,
        requireInteraction: false,
        /* THE LIST, NOT THE NEWEST ITEM. A summary that opens one of the
           things it is summarising hides the others. */
        data: { href: PUSH_FALLBACK_HREF, urgent: false, count: total },
      },
    },
  };
}

self.addEventListener("push", (event) => {
  let parsed = null;
  if (event.data) {
    try {
      parsed = event.data.json();
    } catch {
      /* Not JSON, or not decryptable. `notificationFromPayload` turns null
         into the plain Vallo notification, which still tells the person
         something is waiting and still opens the list. */
    }
  }

  const incoming = notificationFromPayload(parsed);

  event.waitUntil(
    (async () => {
      let existing = [];
      try {
        /* Not supported everywhere, and it throws rather than returning
           nothing on some older Android browsers. An empty list is the safe
           reading: it shows the individual notification, which is never
           wrong, only sometimes noisier than it could be. */
        existing = (await self.registration.getNotifications()) || [];
      } catch {
        existing = [];
      }

      const plan = planShade(existing, incoming);
      for (const notification of plan.close) {
        try {
          notification.close();
        } catch {
          /* Already dismissed by the person between the read and here. */
        }
      }
      await self.registration.showNotification(plan.show.title, plan.show.options);
    })(),
  );
});

/*
 * THE TAP.
 *
 * Three outcomes in preference order, and the order is the whole point:
 *
 *  1. A tab already open ON THAT EXACT PAGE is focused and left alone.
 *     Navigating it would throw away a half-typed reply.
 *  2. Any other Vallo tab is navigated to the destination and focused, so a
 *     person ends the day with one Vallo tab rather than nine.
 *  3. Only when there is no Vallo tab at all is a new window opened.
 *
 * At scope `/` every Vallo tab is visible here and every one of them is
 * controlled by this worker, which is what makes `navigate` legal. Under the
 * old `/api/push/` scope steps 1 and 2 could not see anything and every tap
 * fell through to step 3.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  /* V-53: a button carries its own destination; the body of the
     notification carries the default one. */
  const byAction =
    event.action && data.actionHrefs && typeof data.actionHrefs === "object"
      ? data.actionHrefs[event.action]
      : undefined;
  const href = safePushHref(byAction !== undefined ? byAction : data.href);

  event.waitUntil(
    (async () => {
      let clientList = [];
      try {
        clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      } catch {
        clientList = [];
      }

      const ours = clientList.filter((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      const target = new URL(href, self.location.origin).href;

      const exact = ours.find((client) => client.url === target);
      if (exact && typeof exact.focus === "function") {
        return exact.focus();
      }

      const anyTab = ours[0];
      if (anyTab) {
        if (typeof anyTab.navigate === "function") {
          try {
            const navigated = await anyTab.navigate(target);
            /* `navigate` resolves to null for a client it could not move.
               Focusing the original is better than opening a second tab. */
            if (navigated && typeof navigated.focus === "function") return navigated.focus();
          } catch {
            /* An uncontrolled client refuses to be navigated. Fall through
               and at least bring the person back to Vallo. */
          }
        }
        if (typeof anyTab.focus === "function") return anyTab.focus();
      }

      return self.clients.openWindow(target);
    })(),
  );
});

/*
 * THE SUBSCRIPTION THAT ROTATES UNDER YOU.
 *
 * A browser may replace a push subscription without the page being open, and
 * if nobody re-registers it the device goes silent for ever with nothing
 * anywhere saying so. The new subscription is sent straight back. The request
 * carries cookies, so it lands as the right person or it is refused; there is
 * no path here by which one person's device is recorded against another.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const old = event.oldSubscription;
        const applicationServerKey =
          (old && old.options && old.options.applicationServerKey) || null;
        const fresh =
          event.newSubscription ||
          (applicationServerKey
            ? await self.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey,
              })
            : null);
        if (!fresh) return;

        const json = fresh.toJSON();
        const keys = json.keys || {};
        await fetch("/api/push/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            platform: "web",
            token: fresh.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
          }),
        });
      } catch {
        /* Nothing useful to do and nowhere useful to say it. The device goes
           quiet until the page is next opened, which re-registers. */
      }
    })(),
  );
});
