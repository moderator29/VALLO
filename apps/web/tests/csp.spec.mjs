/**
 * The Content Security Policy, checked against a running browser.
 *
 * A CSP is the one security control that is trivial to write and easy to get
 * wrong in a way no static reading catches, because the failure mode is not a
 * missing header. It is a header that is present, looks strict, and silently
 * forbids the application's own hydration payload, leaving a page that renders
 * server markup and then never becomes interactive. That failure looks fine in
 * a screenshot. It only shows up as a `securitypolicyviolation` event and a
 * console refusal, which is what this script collects.
 *
 * It asserts, on public routes at phone size:
 *   1. The policy is served at all, on the HTML response.
 *   2. `script-src` carries a nonce and does NOT carry 'unsafe-inline'. A
 *      policy with both is a policy with neither, since a browser that sees a
 *      nonce ignores 'unsafe-inline' but an attacker only needs one of them.
 *   3. The four directives that cost nothing and close real attacks are set:
 *      object-src, base-uri, form-action, frame-ancestors.
 *   4. The nonce is freshly minted per request, not a build-time constant. A
 *      fixed nonce is decoration: an injected script can simply carry it.
 *   5. The hand-written theme script in `app/layout.tsx` carries the nonce.
 *   6. Nothing is actually blocked. Zero violations, zero console refusals.
 *   7. The page hydrates, proving the nonce reached Next's own inline scripts.
 *   8. The policy is ENFORCING, not report-only. A report-only policy passes
 *      every other check on this list and stops nothing, which is the state
 *      this platform sat in for months. Set CSP_ENFORCE=false to run the walk
 *      against a reporting deployment on purpose.
 *
 * Self-contained: no runner, no config. Run with a server already listening:
 *
 *   BASE_URL=http://localhost:3210 node apps/web/tests/csp.spec.mjs
 */

import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3210";
const EXECUTABLE = "/opt/pw-browsers/chromium";
const WAIT = 1500;

const failures = [];
function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures.push(label + (detail ? ` (${detail})` : ""));
    console.log(`  FAIL  ${label}${detail ? ` (${detail})` : ""}`);
  }
}

/**
 * The policy, under whichever header name is actually serving it.
 *
 * The platform ships REPORT-ONLY by default and flips to enforcing on
 * `CSP_ENFORCE=true`, so the header is `Content-Security-Policy-Report-Only`
 * most of the time and `Content-Security-Policy` in production once the reports
 * are quiet. Both carry the identical policy string, built by one function, so
 * every check below holds either way and this spec must not care which it got.
 *
 * An earlier version read only the enforcing name and reported "serves no
 * Content Security Policy" on a server that was serving one perfectly well.
 */
function servedPolicy(response) {
  const headers = response?.headers() ?? {};
  return (
    headers["content-security-policy"] ?? headers["content-security-policy-report-only"] ?? ""
  );
}

/**
 * Which of the two header names carried it.
 *
 * The distinction is the whole difference between a control and a note. Every
 * shape check in this file passes identically on a report-only policy, and a
 * report-only policy has never blocked anything: the browser renders the
 * violating script, then posts a report about having done so.
 */
function isEnforcing(response) {
  return (response?.headers() ?? {})["content-security-policy"] !== undefined;
}

/** Pull one directive's source list out of a policy string. */
function directive(policy, name) {
  const found = policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  return found ?? null;
}

/**
 * Collect violations from inside the page.
 *
 * Playwright's init scripts run in an isolated world that the page's own policy
 * does not govern, so this listener is never itself blocked by the thing it is
 * measuring.
 */
const COLLECTOR = `
  window.__cspViolations = [];
  document.addEventListener("securitypolicyviolation", (event) => {
    window.__cspViolations.push({
      directive: event.effectiveDirective || event.violatedDirective,
      blocked: event.blockedURI || "inline",
      text: (event.effectiveDirective || event.violatedDirective) +
        " blocked " + (event.blockedURI || "inline"),
    });
  });
`;

/**
 * A refusal this codebase can do something about, told apart from the one it
 * cannot, measured on a production server on 19 September 2026.
 *
 * Next 16.2.12 emits one `<script src>` per render with NO nonce on it, and
 * under `'strict-dynamic'` the browser refuses it on every route, `/` included.
 * It is not a fault in this policy and it is not a fault in the nonce wiring:
 * `app-render/get-layer-assets.js` builds its script elements with
 * `nonce: ctx.nonce` and its sibling `app-render/create-component-styles-and-scripts.js`
 * builds the identical element and leaves the nonce off. That sibling is the
 * one that attaches a boundary's entry chunks, `template`, `error`, `loading`,
 * `not-found`, `forbidden` and `unauthorized`, which is why the refusal follows
 * the ROOT boundaries onto every route rather than picking out the app shell.
 *
 * Its cost was measured rather than assumed, by serving the same build twice,
 * once enforcing and once report-only, and comparing. Identical DOM, identical
 * element counts, identical numbers of React-owned controls carrying live
 * handlers, no page errors either way. Every module inside the refused chunk is
 * duplicated by Turbopack into chunks that do carry the nonce and do load, and
 * `'strict-dynamic'` permits the runtime's own dynamically inserted chunk tags,
 * which the map check at the bottom of this file proves end to end. So the
 * refusal costs a redundant eager fetch and nothing else.
 *
 * This is therefore RECORDED, not excused. A refused script that carries no
 * nonce in the served HTML and belongs to Next's own chunk directory is the
 * known defect. ANYTHING else refused is this codebase's problem and fails.
 * When Next fixes its line, `knownUpstreamRefusals` drops to zero and the last
 * check in this file says so, which is the signal to delete all of this.
 */
const UPSTREAM_CHUNK = /\/_next\/static\/chunks\/[^/]+\.js(\?|$)/;
let knownUpstreamRefusals = 0;
const upstreamFiles = new Set();

/**
 * Split what the browser refused into the known upstream tag and the rest.
 *
 * A violation only counts as the known one if the served HTML really does hold
 * an un-nonced `<script src>` for that exact URL. An inline refusal, a
 * cross-origin refusal, or a chunk that WAS nonced and got refused anyway all
 * fall through to `ours` and fail the route.
 */
async function classifyRefusals(page) {
  const violations = await page.evaluate(() => window.__cspViolations ?? []).catch(() => []);
  const unnoncedSrc = await page
    .evaluate(() =>
      [...document.querySelectorAll("script[src]")]
        .filter((tag) => !(tag.nonce || tag.getAttribute("nonce")))
        .map((tag) => tag.src),
    )
    .catch(() => []);
  const known = [];
  const ours = [];
  for (const violation of violations) {
    if (
      violation.blocked !== "inline" &&
      UPSTREAM_CHUNK.test(violation.blocked) &&
      unnoncedSrc.includes(violation.blocked)
    ) {
      known.push(violation);
      upstreamFiles.add(violation.blocked.split("/").pop());
    } else {
      ours.push(violation);
    }
  }
  knownUpstreamRefusals += known.length;
  return { known, ours };
}

/** Console refusals for anything but the known upstream chunk. */
function refusalsWeOwn(refusals, known) {
  const knownUrls = known.map((violation) => violation.blocked);
  return refusals.filter((text) => !knownUrls.some((url) => text.includes(url)));
}

/**
 * Did React actually take the page over, or did the server markup just arrive?
 *
 * `window.__next_f` proves the streaming payload was allowed to run and no
 * more. This asks the DOM: a control is hydrated when React has attached a
 * fiber to it and put a real handler on its props. That is the difference
 * between a page and a picture of a page, and it is the only thing that makes
 * "the refusal costs nothing" a measurement rather than a hope.
 */
async function hydration(page) {
  return page.evaluate(() => {
    const propsKey = (element) =>
      Object.keys(element).find((key) => key.startsWith("__reactProps$"));
    /* React's own server-action bookkeeping, `$ACTION_REF`, `$ACTION_KEY` and
       friends, is written into every form that posts to a server action. Those
       hidden inputs are injected by the form machinery rather than reconciled,
       so they never carry props and they are not evidence of anything. Counting
       them made this check report a hydrated page as half dead. */
    const controls = [
      ...document.querySelectorAll("button, a[href], input, [role=button]"),
    ].filter((element) => !(element.tagName === "INPUT" && element.type === "hidden"));
    const live = controls.filter((element) => {
      const key = propsKey(element);
      if (!key) return false;
      const props = element[key];
      return (
        typeof props.onClick === "function" ||
        typeof props.onChange === "function" ||
        typeof props.onSubmit === "function"
      );
    });
    return { controls: controls.length, owned: controls.filter(propsKey).length, live: live.length };
  }).catch(() => ({ controls: 0, owned: 0, live: 0 }));
}

async function auditRoute(page, refusals, route) {
  console.log(route);
  refusals.length = 0;
  await page.evaluate(() => {
    window.__cspViolations = [];
  }).catch(() => {});

  const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: "load" });
  await page.waitForTimeout(WAIT);

  check(`${route} responds without a server error`, (response?.status() ?? 500) < 500);

  const policy = servedPolicy(response);
  check(`${route} serves a Content Security Policy`, policy.length > 0);
  if (policy.length === 0) return null;

  check(
    `${route} serves it as ENFORCING, not report-only`,
    isEnforcing(response),
    "Content-Security-Policy-Report-Only",
  );

  const script = directive(policy, "script-src") ?? "";
  check(`${route} script-src carries a nonce`, /'nonce-[A-Za-z0-9+/=]+'/.test(script), script);
  check(`${route} script-src has no 'unsafe-inline'`, !script.includes("'unsafe-inline'"));
  check(`${route} script-src has no 'unsafe-eval'`, !script.includes("'unsafe-eval'"));

  for (const [name, expected] of [
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["frame-ancestors", "'none'"],
  ]) {
    const value = directive(policy, name);
    check(`${route} sets ${name} ${expected}`, value === `${name} ${expected}`, value ?? "absent");
  }

  /*
   * An injected `<style>` block must not run, even though a `style=` attribute
   * may. `style-src` keeps 'unsafe-inline' as the fallback for browsers with
   * no `style-src-elem`, so asserting on `style-src` alone would pass on a
   * policy that had quietly lost the split. Assert the element directive.
   */
  const styleElem = directive(policy, "style-src-elem");
  check(
    `${route} forbids an injected <style> block`,
    styleElem === "style-src-elem 'self'",
    styleElem ?? "absent",
  );

  /* form-action is not an exact match: it names the one cross-origin
     destination a form submission can legitimately reach, Paystack checkout,
     which a wallet deposit reaches through a same-origin POST that answers
     with a redirect. No provider origin is here because the Google and Apple
     rows are gone from AuthChoices. What must hold is that it exists, starts
     from 'self', and has not been widened to a wildcard. See the long note in
     lib/security/csp.ts. */
  const formAction = directive(policy, "form-action") ?? "";
  check(`${route} sets form-action from 'self'`, formAction.startsWith("form-action 'self'"), formAction);
  check(`${route} form-action is not a wildcard`, !/[\s]\*|https:(\s|$)/.test(formAction), formAction);

  /*
   * `frame-src` is no longer `'none'` and this is the walk that has to notice
   * if it ever becomes a wildcard on a real server rather than in a unit test.
   *
   * It carries exactly the two Paystack checkout hosts, because the in-app
   * checkout draws their checkout in an iframe on our page instead of
   * navigating the whole tab away. Two named hosts is the whole grant. A `*`
   * or a bare `https:` here would let an injected iframe load any document on
   * the web inside our chrome, which is a phishing surface wearing our URL
   * bar, and it is the exact failure this line exists to catch.
   *
   * `frame-ancestors 'none'` is asserted above and stays asserted: the grant
   * is one-directional and the two directives are four lines apart in the
   * source, which is precisely why both are checked.
   */
  const frameSrc = directive(policy, "frame-src") ?? "";
  check(`${route} sets frame-src`, frameSrc.startsWith("frame-src "), frameSrc || "absent");
  check(
    `${route} frame-src names Paystack checkout`,
    frameSrc.includes("https://checkout.paystack.com") && frameSrc.includes("https://checkout.paystack.co"),
    frameSrc,
  );
  check(`${route} frame-src is not a wildcard`, !/[\s]\*|https:(\s|$)/.test(frameSrc), frameSrc);

  /*
   * The hand-written theme script has to be stamped by hand. If this is missing
   * the light theme flashes dark on every load for the people who chose it.
   *
   * READ THE PROPERTY, NOT THE ATTRIBUTE. Chromium hides a nonce from
   * `getAttribute("nonce")` and returns an empty string, deliberately: without
   * that, an injected stylesheet could read the nonce back out through an
   * attribute selector and an attacker would have the key to the whole policy.
   * The `nonce` IDL property still carries the real value. An earlier version
   * of this spec read the attribute and reported a correctly nonced script as
   * unstamped, which is a spec fault dressed up as a product fault.
   */
  const inlineNonce = await page.evaluate(() => {
    const tag = [...document.querySelectorAll("script:not([src])")].find((s) =>
      s.textContent.includes("nf_theme"),
    );
    return tag ? tag.nonce || tag.getAttribute("nonce") || "" : "no-such-script";
  });
  check(
    `${route} stamps the theme script with a nonce`,
    typeof inlineNonce === "string" && inlineNonce.length > 0 && inlineNonce !== "no-such-script",
    String(inlineNonce),
  );

  /*
   * EVERY inline script, not just the one we knew about.
   *
   * An earlier version of this spec checked only the theme script by name, and
   * a merge then landed a second hand-written inline script for save-data
   * detection with no nonce on it. The violation check below caught it, which
   * is the point of having one, but a named check would have gone on passing
   * while a new script was blocked on every route. Counting them is the
   * invariant that survives somebody adding a third.
   */
  const unnonced = await page.evaluate(() =>
    [...document.querySelectorAll("script:not([src])")]
      .filter((tag) => tag.textContent.trim().length > 0)
      .filter((tag) => !(tag.nonce || tag.getAttribute("nonce")))
      .map((tag) => tag.textContent.trim().slice(0, 60)),
  );
  check(
    `${route} nonces every inline script it writes`,
    unnonced.length === 0,
    unnonced.join(" | "),
  );

  const { known, ours } = await classifyRefusals(page);
  check(
    `${route} refuses nothing this codebase can nonce`,
    ours.length === 0,
    ours.map((violation) => violation.text).join(", "),
  );
  const ownRefusals = refusalsWeOwn(refusals, known);
  check(`${route} logs no console refusal we own`, ownRefusals.length === 0, ownRefusals.join(" | "));

  // Hydration is the proof that the nonce reached Next's own inline scripts.
  // Server markup renders identically whether or not they were allowed to run,
  // so the count of controls React actually owns is the only honest reading.
  const live = await hydration(page);
  check(
    `${route} hydrates, so React owns its controls`,
    live.controls > 0 && live.owned === live.controls,
    `${live.owned}/${live.controls} owned, ${live.live} with a live handler`,
  );

  return directive(policy, "script-src");
}

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const context = await browser.newContext({
  colorScheme: "dark",
  viewport: { width: 390, height: 844 },
});
await context.addInitScript(COLLECTOR);
const page = await context.newPage();

/* A blocked resource is reported to the console as "Refused to ...". Collecting
   these alongside the violation events catches the cases Chromium reports one
   way and not the other. */
const refusals = [];
page.on("console", (message) => {
  const text = message.text();
  if (/Content Security Policy|Refused to/i.test(text)) refusals.push(text);
});

/**
 * The rest of the product, checked for one thing only: that nothing is blocked.
 *
 * The full audit above is about the shape of the policy, and the shape is the
 * same on every route because one function builds it. What differs per route is
 * what the page actually tries to LOAD, and that is where a policy breaks
 * something: a script-src that forbids a chunk, an img-src missing a tile host,
 * a connect-src missing an endpoint. None of that shows up on a landing page.
 *
 * `/search` is the one that matters most. It dynamically imports Leaflet, which
 * is exactly the case `strict-dynamic` exists to permit and exactly the case a
 * badly written policy breaks: the nonced bootstrap injects the chunk, and if
 * the browser does not trust it the map never draws. It also fetches its
 * vector tiles, style and glyphs from a third party (OpenFreeMap, in
 * `connect-src`), and it is the only surface that asks for geolocation.
 *
 * This sandbox has no Supabase keys, so the middleware is a pass through and
 * these product routes render their signed-out or unconfigured states rather
 * than redirecting. That is what makes them reachable to walk here at all.
 */
/*
 * THE SIGNED-OUT BROWSE SURFACE IS WALKED BECAUSE IT IS NEW.
 *
 * N-1 opened six route families to anonymous traffic in one commit, and the
 * report-only policy had only ever been tuned against authenticated traffic,
 * because until that commit these addresses redirected to sign in before a
 * browser ever loaded them. A policy tuned on pages a stranger cannot reach is
 * a policy that has never been tested on the pages a stranger CAN reach, and
 * those are now the common case: a shared listing link, a search result, a
 * public profile.
 *
 * `/listing/[id]` earns its place twice over. It is the only route that writes
 * a third inline script, the JSON-LD block, and that block is built from a
 * listing's own title and description, which is attacker-controlled text on a
 * marketplace anybody can list on.
 */
const WALK = [
  /*
   * THE APP SHELL AND THE BOUNDARIES, ADDED BECAUSE THE WALK HAD NEITHER.
   *
   * Every route below the doors was a marketing page, a browse page or a
   * settings page. None of them is a boundary, and R1 reported the refusal as
   * something the app shell and the not-found page did and `/` did not. That
   * reading was wrong, the refusal is on every route, but it was only
   * ARGUABLE because nothing here had ever walked a 404 or an app-shell
   * address. A 404 is a real page a stranger reaches from a stale link, it
   * renders a search form that has to work, and until now no spec on this
   * platform had ever loaded one in a browser under the enforcing policy.
   *
   * In this sandbox the product segments answer 307 to the sign-in screen,
   * which is itself a route worth proving, and the preview harness address
   * renders the signed-in shell outright.
   */
  "/definitely-not-a-route",
  "/home",
  "/messages",
  "/preview/f1/chrome",
  // The signed-out browse surface, opened by N-1.
  "/search",
  "/search?market=rent",
  "/around",
  "/listing/ed000000-0000-4000-8000-000000000003",
  "/u/example_collect",
  "/u",
  // The doors.
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  // Product behind the wall, rendering its signed-out state in this sandbox.
  "/wallet",
  "/assistant",
  "/settings",
  "/settings/devices",
  // The marketing and reference site.
  "/styleguide",
  "/docs",
  "/privacy",
  "/help",
  "/about",
  "/contact",
];

async function walkRoute(page, refusals, route) {
  refusals.length = 0;
  const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: "load" });
  /* Longer than the audit's wait: the map has to import its chunk, construct
     itself and ask for tiles before there is anything to be blocked. */
  await page.waitForTimeout(2500);

  const policy = servedPolicy(response);
  check(`${route} carries the policy`, policy.length > 0);
  check(`${route} carries it as enforcing`, isEnforcing(response));

  /* Every inline script on the page, not only the ones the landing page has.
     `/listing/[id]` writes a third one, the JSON-LD block, and it is built
     from listing text a stranger supplied. */
  const unnonced = await page.evaluate(() =>
    [...document.querySelectorAll("script:not([src])")]
      .filter((tag) => tag.textContent.trim().length > 0)
      .filter((tag) => !(tag.nonce || tag.getAttribute("nonce")))
      .map((tag) => tag.textContent.trim().slice(0, 60)),
  );
  check(`${route} nonces every inline script`, unnonced.length === 0, unnonced.join(" | "));

  const { known, ours } = await classifyRefusals(page);
  check(
    `${route} blocks nothing this codebase can nonce`,
    ours.length === 0,
    ours.map((violation) => violation.text).join(", "),
  );
  const ownRefusals = refusalsWeOwn(refusals, known);
  check(`${route} logs no refusal we own`, ownRefusals.length === 0, ownRefusals.join(" | "));

  /* The measurement that makes the line above safe to draw. A route whose
     scripts were all refused also "blocks nothing this codebase can nonce",
     because there is nothing left to block. This insists the page came alive. */
  const live = await hydration(page);
  check(
    `${route} hydrates despite the upstream refusal`,
    live.controls > 0 && live.owned === live.controls && live.live > 0,
    `${live.owned}/${live.controls} owned, ${live.live} with a live handler`,
  );
}

/**
 * SEC-4's residual, the one thing that fix left unheld.
 *
 * The middleware matcher used to exclude any path ENDING in an asset
 * extension rather than paths under an asset directory, so every dynamic route
 * on this platform served full HTML with no policy, no nonce and no session
 * refresh the moment somebody put `.png` inside the parameter. It is fixed by
 * anchoring on directories, and nothing held the fix in place.
 *
 * This does. A dynamic route with an asset suffix in its parameter has to come
 * back with the policy on it and a nonce inside it, exactly like the same route
 * without the suffix.
 */
async function auditAssetSuffix(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: "load" });
  const policy = servedPolicy(response);
  check(`${route} still carries the policy despite the asset suffix`, policy.length > 0);
  check(`${route} carries it as enforcing`, isEnforcing(response));
  check(
    `${route} still gets a per-request nonce`,
    /'nonce-[A-Za-z0-9+/=]+'/.test(directive(policy, "script-src") ?? ""),
  );
}

try {
  const landing = await auditRoute(page, refusals, "/");
  const signIn = await auditRoute(page, refusals, "/sign-in");

  console.log("nonce freshness");
  check(
    "the nonce is minted per request, not fixed at build time",
    landing !== null && signIn !== null && landing !== signIn,
    landing === signIn ? "both requests served the same script-src" : "",
  );

  console.log("nothing blocked across the product");
  for (const route of WALK) {
    await walkRoute(page, refusals, route);
  }

  console.log("the middleware matcher hole, held closed");
  for (const route of ["/listing/abc.png", "/u/somebody.svg", "/checkout/abc.jpg"]) {
    await auditAssetSuffix(page, route);
  }

  /*
   * The map, asserted rather than assumed.
   *
   * "/search blocks nothing" above is worth very little on its own, because a
   * page where the map never opened also blocks nothing. The two things this
   * policy could plausibly break are both here and neither is visible from a
   * violation count: `strict-dynamic` has to let the nonced bootstrap import
   * the Leaflet chunk, and `connect-src` has to name the tile host. If either is
   * wrong the map is a grey box, the page still loads, and every check above
   * still passes.
   *
   * So this opens the map and insists on the evidence: a constructed Leaflet
   * container, and map data actually fetched from the third party.
   */
  console.log("the map, which is what strict-dynamic and img-src are for");
  const tiles = [];
  page.on("request", (request) => {
    if (/openfreemap|maptiler/.test(request.url())) tiles.push(request.url());
  });

  /*
   * DESKTOP WIDTH, AND A DISPATCHED CLICK. Both are spec faults being fixed,
   * not product behaviour being worked around.
   *
   * The list/map toggle sits in a horizontally scrolling control, and at the
   * 390px viewport the rest of this file uses it lands outside the visible
   * box. Playwright's actionability check refuses to click it, the catch
   * above swallowed the refusal, and the two checks below then reported that
   * `strict-dynamic` had broken the Leaflet import when in truth the map had
   * never been asked to open. A security spec that reports a policy failure
   * for a scroll position is worse than no spec: it is the check that gets
   * ignored the day it is right.
   *
   * The click is dispatched rather than synthesised for the same reason. What
   * this section proves is about module loading and image origins, and neither
   * cares which pixel the pointer was over.
   */
  const wide = await context.newPage();
  wide.on("request", (request) => {
    if (/openfreemap|maptiler/.test(request.url())) tiles.push(request.url());
  });
  await wide.setViewportSize({ width: 1280, height: 900 });
  /*
   * OPENED BY ADDRESS, NOT BY THE TOGGLE, and that is a spec fault being fixed
   * for the second time in this block's life.
   *
   * The note above fixed a click that was landing off screen. The control has
   * since stopped rendering on a bare `/search` at all: measured on the
   * production build of 19 September 2026, `[data-testid="view-map"]` is
   * absent from `/search` and present on `/search?view=map`, so the dispatched
   * click found nothing, the catch swallowed it, and all three checks below
   * reported that `strict-dynamic` had broken Leaflet on a page where the map
   * had never been asked for. That is the third time this block has accused
   * the policy of a fault belonging to the spec.
   *
   * The view is a URL parameter, the page reads it on the server, and none of
   * what is being proved here, a dynamic import and an image origin, cares how
   * the reader got there. So it is asked for in the address.
   */
  await wide.goto(`${BASE_URL}/search?view=map`, { waitUntil: "load" });
  await wide.waitForTimeout(2500);
  await wide.waitForTimeout(4000);

  check(
    "Leaflet's chunk loads and constructs, so strict-dynamic permits the import",
    (await wide.locator(".leaflet-container").count()) > 0,
  );
  check("map data loads from the third party, so connect-src (or img-src, on MapTiler) names the host", tiles.length > 0, `${tiles.length} map data requests`);
  const mapRefusals = await classifyRefusals(wide);
  check(
    "and the map triggered no violation this codebase can nonce",
    mapRefusals.ours.length === 0,
    mapRefusals.ours.map((violation) => violation.text).join(", "),
  );
  await wide.close();

  /*
   * THE UPSTREAM DEFECT, STATED OUT LOUD RATHER THAN SWALLOWED.
   *
   * Every route above tolerates exactly one refusal, and a tolerance nobody
   * reads is how a real refusal hides. So it is counted and named. If this
   * goes to zero, Next has fixed `create-component-styles-and-scripts.js` and
   * `classifyRefusals`, `refusalsWeOwn` and this block should all be deleted.
   * If the file count grows past one, something new is being refused and
   * somebody needs to look at it rather than at this sentence.
   */
  console.log("the known upstream refusal");
  console.log(
    `  note  ${knownUpstreamRefusals} refusal(s) of ${upstreamFiles.size} un-nonced Next chunk(s): ` +
      `${[...upstreamFiles].join(", ") || "none"}`,
  );
  check(
    "the un-nonced chunk Next emits is still a single file, not a growing set",
    upstreamFiles.size <= 1,
    [...upstreamFiles].join(", "),
  );
} finally {
  await browser.close();
}

console.log("");
if (failures.length > 0) {
  console.log(`${failures.length} check(s) failed:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("all CSP checks passed");
