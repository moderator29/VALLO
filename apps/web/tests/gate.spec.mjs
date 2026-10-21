/**
 * NOBODY SEES INSIDE THE PLATFORM WITHOUT AN ACCOUNT, WATCHED RATHER THAN READ.
 *
 * ===========================================================================
 * WHAT THIS PROVES AND WHAT IT DELIBERATELY DOES NOT
 * ===========================================================================
 *
 * `src/proxy.test.ts` asserts the DECISION: that `isPublicPath` classifies
 * every route on disk the way the founder's item 8 says it should. It runs in
 * milliseconds and it cannot see whether the middleware runs at all.
 *
 * This file asserts the BEHAVIOUR. It drives a real browser at a real server
 * with the guard armed and writes down where each request landed and what it
 * answered. The two are not substitutes: a green unit test over a middleware
 * that was never invoked is the exact shape of a blind green light.
 *
 * Run it against a server started WITH Supabase configured, because the
 * middleware is a deliberate pass-through when it is not, and that is the trap
 * this spec exists to stop anybody falling into. Every other browser spec on
 * this platform runs in a sandbox that cannot reach Supabase, so every product
 * route renders signed-out there and the lock is invisible.
 *
 * The key does not have to be a real one. The middleware needs two things: the
 * public config present, so it arms itself, and `getUser()` to come back
 * without a user, which is exactly what an anonymous visitor produces.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=anything \
 *   NEXT_DIST_DIR=.next-gate npx next start -p 3211
 *   BASE_URL=http://localhost:3211 node apps/web/tests/gate.spec.mjs
 *
 * ===========================================================================
 * THE TWO TRAPS THIS REPOSITORY HAS ALREADY BEEN BITTEN BY
 * ===========================================================================
 *
 * Both guards were learned by the old browser walk of every back control,
 * which paid for them, rather than invented again here.
 *
 *   A 200 IS NOT A PAGE. A Next.js layout calling `notFound()` answers HTTP
 *   200 with the not-found body. `/crypto` and `/gallery` both do exactly
 *   this. So every public route is checked for the `[data-nf-not-found]`
 *   marker and for a body that rendered essentially nothing, and a route that
 *   carries either is REFUSED rather than counted as open.
 *
 *   WHERE THE BROWSER SETTLED IS READ AFTER THE REDIRECT SETTLES. Several
 *   routes on this platform redirect CLIENT side, so `page.url()` still reads
 *   the address that was asked for at the moment `load` fires and is somewhere
 *   else a second later. The public walk therefore reads the landing address
 *   after a settle, and reads the page TWICE, refusing a page whose two reads
 *   disagree instead of printing one of its two answers.
 *
 * The product walk needs neither, because a gated route never renders: it is
 * checked at the request level, where a 307 and its Location header are the
 * whole answer and a rendered body would itself be the failure.
 *
 * ===========================================================================
 * THE LISTS
 * ===========================================================================
 *
 * They are written out here rather than imported from `proxy.ts` ON PURPOSE.
 * A walk that reads the rule it is testing can agree with itself while
 * disagreeing with the product. These are the product decision stated a second
 * time, by hand, and the run is what makes the two meet.
 *
 * ===========================================================================
 * THE CONTROL, WHICH IS NOT OPTIONAL
 * ===========================================================================
 *
 * A GATE THAT REFUSES EVERYBODY PASSES A TEST THAT ONLY CHECKS REFUSALS.
 * Every check above is satisfied by a middleware that redirects every request
 * on the platform to `/sign-in`, which would be a catastrophe reported as a
 * clean run. So the same list is walked a second time WITH a session, and
 * every route that bounced must now not bounce.
 *
 *   GATE_SESSION_COOKIE="sb-...-auth-token=..." \
 *   BASE_URL=http://127.0.0.1:3493 node apps/web/tests/gate.spec.mjs
 *
 * With that variable set the spec runs the control pass INSTEAD of the
 * signed-out pass, because the two need servers built against different
 * addresses. `tests/gate-stub-session.mjs` mints the cookie and explains what
 * a stand-in session can and cannot prove.
 */

import { chromium } from "playwright-core";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3211";
const EXECUTABLE_PATH = process.env.PROOF_CHROMIUM ?? "/opt/pw-browsers/chromium";
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "../src/app");

let failures = 0;
function check(name, condition, detail) {
  if (condition) {
    console.log(`  ok      ${name}`);
  } else {
    failures += 1;
    console.log(`  FAILED  ${name}`);
    if (detail) for (const line of [].concat(detail).slice(0, 30)) console.log(`            ${line}`);
  }
}

/**
 * Open to anybody, and each one has a reason.
 *
 * The landing page, because the founder named it as our only public surface.
 * The company and support pages around it, because a support page behind a
 * login is a support page the person who most needs it cannot reach. The auth
 * screens, because a lock with no door is a wall. Privacy, terms and the rest
 * of the policy set, because a privacy notice nobody can read without an
 * account is not a privacy notice. `/delete-account`, because Google Play
 * requires it to be reachable without signing in and because it carries the
 * only control that undoes a deletion already started. The offline shell,
 * because it is served when there is no network at all. `robots.txt` and
 * `sitemap.xml`, because the things that read them have no session and never
 * will.
 */
const PUBLIC = [
  "/",
  "/about",
  "/careers",
  "/contact",
  "/help",
  "/docs",
  "/docs/what-vallo-is",
  "/cancellations",
  "/eula",
  "/privacy",
  "/safety",
  "/standards",
  "/terms",
  "/delete-account",
  "/offline",
  "/sign-in",
  "/sign-in/email",
  "/sign-up",
  "/sign-up/email",
  "/sign-up/verify",
  "/auth/callback",
  "/forgot-password",
  "/reset-password",
  "/welcome",
  "/start",
  /* Added since: the disclaimer is a legal page like the other four; `/check`
     is "Is this a Vallo agent?" for a renter holding a flyer (V-61); `/r` is
     the receipt check a tenant hands to an employer or an embassy (V-55). */
  "/disclaimer",
  "/check",
  "/r",
];

/**
 * Public doors that only exist with something after them: a share card
 * (`/s/<token>`), the landlord's reply page and a trusted contact's page (a
 * token each), the area price pages (`/areas/<state>/<area>`, a 404 below the
 * Price Check minimum), and `/open`, which sends a stranger to `/welcome`.
 * The gate must not take any of them; an unknown token is entitled to its own
 * not-found. Each is in PUBLIC_SEGMENTS in `src/proxy.ts` with its reason.
 */
const PUBLIC_DOORS = [
  "/s/not-a-real-token",
  "/landlord/not-a-real-token",
  "/safe/not-a-real-token",
  "/areas/lagos/lekki",
  "/open",
];

/**
 * Retired or renamed addresses, answered by `next.config.ts` before the gate,
 * and where each must land. The wallet and escrow were retired with custody
 * (every old link lands on agreements); `/inspections` and `/rent` are the
 * short names for two views of pages already in PRODUCT.
 */
const REDIRECTS = [
  ["/wallet", "/agreements"],
  ["/escrow", "/agreements"],
  ["/inspections", "/bookings?kind=inspection&from=property"],
  ["/rent", "/search?market=rent"],
];

/** Public, but not pages: fetched by machines that will never have a cookie. */
const PUBLIC_FILES = ["/robots.txt", "/sitemap.xml"];

/**
 * Inside. Every one of these must bounce an anonymous visitor to sign-in.
 *
 * THE BROWSING SURFACES ARE IN THIS LIST NOW, and that is the whole of the
 * founder's item 8. `/search`, `/listing/*`, `/around`, `/stays`, `/stay/*`,
 * `/restaurants`, `/restaurant/*`, `/search?market=rent` (what `/rent` redirects to), `/price`, `/u/*` and `/post/*`
 * were open by a deliberate decision until 23 September.
 */
const PRODUCT = [
  "/home",
  "/search",
  "/search?view=map",
  "/listing/anything",
  "/around",
  "/around/yaba-unilag",
  "/stays",
  "/stays/search",
  "/stay/anything",
  "/restaurants",
  "/restaurant/anything",
  "/search?market=rent",
  "/price",
  "/price/area/anything",
  "/u",
  "/u/somebody",
  "/post/anything",
  "/saved",
  "/messages",
  "/notifications",
  "/profile",
  "/settings",
  "/agreements",
  "/bookings",
  "/checkout/anything",
  "/bookings?side=stays",
  "/host",
  "/bookings?kind=inspection",
  "/verification",
  "/assistant",
  "/stories",
  /* The crypto checkout moved under /pay (it was /crypto). */
  "/pay/crypto/anything",
  "/record",
  "/support",
  "/tenancy",
  "/legal/privacy",
  "/legal/terms",
  "/admin",
  "/admin/support",
  "/agent/dashboard",
  "/agent/listings",
  "/agent/bookings",
  "/styleguide",
];

/**
 * The data routes. A gate that only redirects page requests while these still
 * answer is not a gate, it is a curtain.
 *
 * They must be REFUSED rather than redirected: a 307 to an HTML sign-in page
 * is not something a `fetch` can read, so the middleware answers 401 JSON.
 */
const API_CLOSED = [
  "/api/map/listings?west=3&south=6&east=4&north=7",
  "/api/crypto/markets",
  "/api/crypto/pairs",
  "/api/crypto/coins/bitcoin",
  "/api/assistant",
  "/api/documents/anything",
  "/api/push/register",
  "/api/push/revoke",
  "/api/push/self-test",
];

/**
 * The API routes that must keep answering without a session, because the
 * caller has no cookie and never will.
 *
 * What is asserted is only that the GATE did not take them: each one then
 * applies its own guard and is fully entitled to answer 401 for a bad
 * signature, 400 for a bad body or 503 for a missing key. What would be a
 * failure is the middleware's own refusal, which is identifiable by its code.
 */
const API_OPEN = [
  /* The PUBLIC half of the VAPID pair, opened on purpose on 23 September so a
     home-screen web app (its own cookie store, no session) can subscribe; see
     the note beside it in src/proxy.ts. */
  "/api/push/key",
  "/api/csp-report",
  "/api/client-error",
  "/api/support",
  "/api/push/sw",
  "/api/push/drain",
  "/api/cron/email-outbox",
  "/api/paystack/webhook",
  "/api/paystack/reconcile",
  "/api/yellowcard/webhook",
  "/api/auth/email-hook",
];

const browser = await chromium.launch({
  executablePath: EXECUTABLE_PATH,
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

/** Set when this run is the control: the same walk, carrying a session. */
const SESSION_COOKIE = process.env.GATE_SESSION_COOKIE ?? "";
if (SESSION_COOKIE) {
  const { hostname } = new URL(BASE_URL);
  await context.addCookies(
    SESSION_COOKIE.split(";")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const at = pair.indexOf("=");
        return {
          name: pair.slice(0, at),
          value: pair.slice(at + 1),
          domain: hostname,
          path: "/",
        };
      }),
  );
}

/** Everything knowable about a loaded page without pressing anything. */
async function inspect(page) {
  return page.evaluate(() => {
    const notFound = document.querySelectorAll("[data-nf-not-found]").length > 0;
    /* The body with the scripts taken out, on a clone, because `textContent`
       counts the RSC flight payload (a hundred kilobytes on every route, so a
       page that rendered nothing reads as full) and `innerText` needs layout
       (so a page whose content is below the fold reads as blank). */
    const clone = document.body.cloneNode(true);
    for (const node of clone.querySelectorAll("script, style, template, noscript")) node.remove();
    const text = (clone.textContent ?? "").trim();
    const elements = clone.querySelectorAll("*").length;
    return { notFound, blank: text.length < 40 && elements < 15, textLength: text.length, elements };
  });
}

const pathOf = (u) => {
  const p = new URL(u).pathname.replace(/\/+$/, "");
  return p === "" ? "/" : p;
};

/**
 * THE CONTROL PASS. The same list, carrying a session, and nothing may bounce.
 *
 * It asserts about the GATE and deliberately not about the pages. A page past
 * the middleware reads data, and on a stand-in session there is no data to
 * read, so a data-backed screen renders its empty or not-found state for
 * reasons that have nothing to do with who is asking. Claiming those rows as
 * rendered pages would be the same lie in the other direction.
 */
async function control() {
  console.log("\nThe control: the same routes, carrying a session");

  /* The instrument proves itself first. If the cookie did not take, every
     route below would bounce and the run would report the gate as broken when
     the walk was simply signed out. */
  const armed = await context.request.get(`${BASE_URL}/home`, { maxRedirects: 0 });
  const armedLocation = armed.headers()["location"] ?? "";
  if (armedLocation.includes("/sign-in")) {
    console.log("\n  ABORTED: the session cookie was not accepted, so this walk is signed out.");
    console.log(`  /home answered ${armed.status()} ${armedLocation}`);
    console.log("  The server must be BUILT with NEXT_PUBLIC_SUPABASE_URL pointing at the");
    console.log("  same address the cookie was minted for: Next inlines that value at build");
    console.log("  time rather than reading it at runtime.");
    await context.close();
    await browser.close();
    process.exit(1);
  }

  const refused = [];
  for (const path of PRODUCT) {
    const res = await context.request.get(BASE_URL + path, { maxRedirects: 0 });
    const location = res.headers()["location"] ?? "";
    if (location.includes("/sign-in")) refused.push(`${path} was still sent to sign-in`);
  }
  check(`all ${PRODUCT.length} product routes let a session through`, refused.length === 0, refused);

  const shut = [];
  for (const path of API_CLOSED) {
    const res = await context.request.get(BASE_URL + path, { maxRedirects: 0 });
    if (res.status() !== 401) continue;
    const body = await res.text();
    /* Only OUR refusal is a failure here. An endpoint answering 401 for its
       own reasons, with a stand-in session behind it, is not the gate. */
    if (body.includes("sign-in-required")) shut.push(`${path} was refused by the gate`);
  }
  check(`all ${API_CLOSED.length} data routes answer a session`, shut.length === 0, shut);

  const closed = [];
  for (const path of PUBLIC) {
    const res = await context.request.get(BASE_URL + path, { maxRedirects: 0 });
    const location = res.headers()["location"] ?? "";
    if (location.includes("/sign-in") && !path.startsWith("/sign-in")) {
      closed.push(`${path} was sent to sign-in`);
    }
  }
  check(`all ${PUBLIC.length} public routes stay open to a session too`, closed.length === 0, closed);
}

try {
  if (SESSION_COOKIE) {
    await control();
    await context.close();
    await browser.close();
    console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
    process.exit(failures === 0 ? 0 : 1);
  }

  /* If the gate is not armed the whole run is meaningless, so it is the first
     thing checked and it stops rather than reporting forty false passes. */
  const probe = await context.request.get(`${BASE_URL}/home`, { maxRedirects: 0 });
  if (probe.status() !== 307 && probe.status() !== 302) {
    console.log("\n  ABORTED: /home did not redirect, so the middleware is not armed.");
    console.log("  Start the server with NEXT_PUBLIC_SUPABASE_URL and");
    console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY set. Without them the guard is a");
    console.log("  pass-through by design and this spec proves nothing.");
    await context.close();
    await browser.close();
    process.exit(1);
  }

  /* ------------------------------------------------ the product, signed out */
  console.log("\nThe product, signed out");
  const leaked = [];
  for (const path of PRODUCT) {
    const res = await context.request.get(BASE_URL + path, { maxRedirects: 0 });
    const location = res.headers()["location"] ?? "";
    const bounced = (res.status() === 307 || res.status() === 302) && location.includes("/sign-in");
    if (!bounced) leaked.push(`${path} answered ${res.status()} ${location}`);
  }
  check(`all ${PRODUCT.length} product routes bounce to sign-in`, leaked.length === 0, leaked);

  console.log("\nRetired and renamed addresses, signed out");
  const misrouted = [];
  for (const [path, want] of REDIRECTS) {
    const res = await context.request.get(BASE_URL + path, { maxRedirects: 0 });
    const location = res.headers()["location"] ?? "";
    let landed = "";
    try {
      const u = new URL(location, BASE_URL);
      landed = `${u.pathname}${u.search}`;
    } catch {
      landed = location;
    }
    if (![307, 308].includes(res.status()) || landed !== want) misrouted.push(`${path} answered ${res.status()} ${location}`);
  }
  check(`all ${REDIRECTS.length} retired addresses land where they should`, misrouted.length === 0, misrouted);
  check(
    "and every place they land is itself behind the wall",
    REDIRECTS.every(([, want]) => PRODUCT.includes(want) || PRODUCT.includes(want.split("&")[0])),
  );

  console.log("\nThe public doors that need a token, signed out");
  const doorsTaken = [];
  for (const path of PUBLIC_DOORS) {
    const res = await context.request.get(BASE_URL + path, { maxRedirects: 0 });
    const location = res.headers()["location"] ?? "";
    if (location.includes("/sign-in")) doorsTaken.push(`${path} was sent to sign-in`);
    if (res.status() >= 500) doorsTaken.push(`${path} answered ${res.status()}`);
  }
  check(`the gate takes none of the ${PUBLIC_DOORS.length} token doors`, doorsTaken.length === 0, doorsTaken);

  /* --------------------------------------------------------- the deep link */
  console.log("\nThe way back to a shared link");
  const back = await context.request.get(`${BASE_URL}/listing/lekki`, { maxRedirects: 0 });
  const target = back.headers()["location"] ?? "";
  check(
    "the address somebody wanted is carried on the redirect",
    target.includes("next=%2Flisting%2Flekki"),
    [target],
  );
  check("and the reason is stated", target.includes("notice=sign-in-required"), [target]);
  const withQuery = await context.request.get(`${BASE_URL}/search?kind=flat&bedrooms=2`, {
    maxRedirects: 0,
  });
  check(
    "a query string survives the bounce, so a shared filtered search is not lost",
    (withQuery.headers()["location"] ?? "").includes("next=%2Fsearch%3Fkind%3Dflat%26bedrooms%3D2"),
    [withQuery.headers()["location"] ?? ""],
  );
  /*
   * THE OPEN REDIRECT, CHECKED FROM THE OUTSIDE RATHER THAN TRUSTED.
   *
   * `safeReturnPath` refuses a protocol-relative path, a backslash and the
   * control characters a URL parser DELETES rather than rejects. It has unit
   * tests. What those cannot see is the server in front of it: Next normalises
   * some of these itself, with a 308, before the middleware ever runs.
   *
   * THE QUESTION IS NOT WHETHER `next` IS ABSENT. The first version of this
   * check asserted that the Location did not CONTAIN the hostile host, and it
   * went red on a perfectly safe answer: Next collapsed `//evil.example/x` to
   * the ordinary same-origin path `/evil.example/x` and redirected there, so
   * the string was present and the destination was ours. A check that reads a
   * substring of a URL is not reading a URL.
   *
   * So the question asked is the only one that matters: wherever this bounce
   * would send a browser, and wherever the `next` it carries would send one
   * afterwards, must resolve to OUR origin.
   */
  const hostile = [
    "//evil.example/listing/x",
    "/\\evil.example",
    "/%2f%2fevil.example",
    "/%09/evil.example",
  ];
  const escaped = [];
  for (const path of hostile) {
    const res = await context.request.get(BASE_URL + path, { maxRedirects: 0 });
    const location = res.headers()["location"] ?? "";
    if (location.length === 0) continue;
    const resolved = new URL(location, BASE_URL);
    if (resolved.origin !== new URL(BASE_URL).origin) {
      escaped.push(`${path} -> ${res.status()} ${location}`);
      continue;
    }
    const carried = resolved.searchParams.get("next");
    if (carried && new URL(carried, BASE_URL).origin !== new URL(BASE_URL).origin) {
      escaped.push(`${path} -> next=${carried}`);
    }
  }
  check(
    `none of the ${hostile.length} hostile addresses leaves our origin`,
    escaped.length === 0,
    escaped,
  );

  /* -------------------------------------------------------- the data routes */
  console.log("\nThe data routes, signed out");
  const answering = [];
  for (const path of API_CLOSED) {
    const res = await context.request.get(BASE_URL + path, { maxRedirects: 0 });
    if (res.status() !== 401) {
      answering.push(`${path} answered ${res.status()} ${res.headers()["location"] ?? ""}`);
      continue;
    }
    const body = await res.text();
    if (!body.includes("sign-in-required")) answering.push(`${path} answered 401 but not ours`);
  }
  check(`all ${API_CLOSED.length} data routes refuse with 401 JSON`, answering.length === 0, answering);

  const gatedByMistake = [];
  for (const path of API_OPEN) {
    const res = await context.request.get(BASE_URL + path, { maxRedirects: 0 });
    const location = res.headers()["location"] ?? "";
    if (location.includes("/sign-in")) gatedByMistake.push(`${path} was redirected to sign-in`);
    if (res.status() === 401) {
      const body = await res.text();
      /* Only OUR refusal is a failure. A webhook answering 401 for a missing
         signature is the endpoint doing its job. */
      if (body.includes("sign-in-required")) gatedByMistake.push(`${path} was refused by the gate`);
    }
  }
  check(
    `all ${API_OPEN.length} webhook, cron and telemetry routes still answer`,
    gatedByMistake.length === 0,
    gatedByMistake,
  );

  /* ------------------------------------------------- the public site, walked */
  console.log("\nThe public site, signed out, in a browser");
  const blocked = [];
  const page = await context.newPage();
  for (const path of PUBLIC) {
    let response;
    try {
      response = await page.goto(BASE_URL + path, { waitUntil: "load", timeout: 45_000 });
    } catch (error) {
      blocked.push(`${path} navigation threw: ${String(error).split("\n")[0].slice(0, 100)}`);
      continue;
    }
    const status = response?.status() ?? 0;
    if (status < 200 || status >= 400) {
      blocked.push(`${path} answered ${status}`);
      continue;
    }
    /* Read after the settle, never before: several routes here redirect
       client side and `page.url()` reads the asked-for address until they
       do. */
    await page.waitForTimeout(700);
    const landed = pathOf(page.url());
    if (landed.startsWith("/sign-in") && !path.startsWith("/sign-in")) {
      blocked.push(`${path} was sent to ${landed}`);
      continue;
    }
    /* Twice, 600ms apart. A page whose two reads disagree has no answer and
       printing one of them is choosing at random. */
    const first = await inspect(page);
    await page.waitForTimeout(600);
    const second = await inspect(page);
    if (first.notFound !== second.notFound || first.blank !== second.blank) {
      blocked.push(`${path} never settled: two reads disagreed`);
      continue;
    }
    if (second.notFound) blocked.push(`${path} served the not-found body at ${status}`);
    else if (second.blank) {
      blocked.push(`${path} rendered blank (${second.textLength} chars, ${second.elements} elements)`);
    }
  }
  await page.close();
  check(
    `all ${PUBLIC.length} public routes open and render`,
    blocked.length === 0,
    blocked,
  );

  console.log("\nThe files a crawler fetches");
  const files = [];
  for (const path of PUBLIC_FILES) {
    const res = await context.request.get(BASE_URL + path, { maxRedirects: 0 });
    if (res.status() !== 200) files.push(`${path} answered ${res.status()}`);
  }
  check(`${PUBLIC_FILES.length} crawler files answer 200`, files.length === 0, files);

  /* ------------------------------------------- nothing is left unclassified */

  /*
   * Every route in the app is in one of the lists above.
   *
   * This is the check that survives the next person. A screen added without a
   * decision about who may see it is the way a product quietly reopens, and
   * "we forgot" is how every one of those happens.
   */
  console.log("\nEvery route is classified");
  const segments = new Set();
  const walk = (dir, prefix = "") => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      /* A route group in brackets is not a URL segment. */
      const next = entry.startsWith("(") ? prefix : `${prefix}/${entry}`;
      const inside = readdirSync(full);
      if (inside.includes("page.tsx") || inside.includes("route.ts")) {
        segments.add((next.split("/")[1] ?? "").replace(/[[\]]/g, ""));
      }
      walk(full, next);
    }
  };
  walk(APP);
  segments.delete("");
  /* The two development harnesses are closed by `previewHarnessIsOpen`, not by
     the gate, so they are declared here rather than smuggled into PUBLIC. */
  const known = new Set([
    ...[...PUBLIC, ...PUBLIC_DOORS, ...REDIRECTS.map(([from]) => from), ...PRODUCT, ...API_CLOSED, ...API_OPEN].map(
      (p) => (p.split("?")[0] ?? "").split("/")[1] ?? "",
    ),
    "preview",
    "gallery",
    "home-or-landing",
  ]);
  const unclassified = [...segments].filter((s) => s.length > 0 && !known.has(s));
  check("no route segment is missing from the lists", unclassified.length === 0, unclassified);

  /* And the guard itself still exists in the shape this spec assumes. */
  const proxy = readFileSync(join(APP, "../proxy.ts"), "utf8");
  check(
    "the guard runs in the proxy, not on the pages",
    /PUBLIC_SEGMENTS/.test(proxy) &&
      /NextResponse\.redirect/.test(proxy) &&
      /isPublicPath/.test(proxy),
  );
} finally {
  await context.close();
  await browser.close();
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
