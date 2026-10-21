import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  AUTH_CALLBACK_REFUSED,
  HARNESS_CLOSED_PATH,
  isApiPath,
  isAuthCallbackRefusal,
  isHarnessPath,
  isPublicPath,
  proxy,
} from "./proxy";
import { NONCE_HEADER } from "@/lib/security/csp";

/**
 * The nonce contract, which nothing held.
 *
 * `lib/security/security.test.ts` proves the SHAPE of the policy string. This
 * file proves the other half, which is the half that kills a deployment: that
 * the nonce the proxy names in `script-src` is the same nonce it forwards to
 * the app on `x-nonce`.
 *
 * Why that is the whole product rather than a detail. Under `'strict-dynamic'`
 * a browser stops honouring `'self'` and every host in the directive and runs a
 * script only if it carries this request's nonce. Next reads the policy off the
 * request it is handed and stamps that nonce onto every script it emits: the
 * bootstrap, the chunk preinits, the streaming payload. The root layout reads
 * `x-nonce` and stamps its own three before-paint scripts by hand. If those two
 * values ever disagree, or if either goes missing, EVERY script on EVERY route
 * is refused, nothing hydrates, and the pages still render perfectly in a
 * screenshot because the server markup is already on screen. That is the exact
 * failure this platform has now paid for twice in development clothes.
 *
 * Measured on a production server on 19 September before this file was written:
 * the nonce in the response policy, the nonce on the layout's theme script and
 * the nonce on Next's bootstrap script were one value on every route walked, so
 * the contract held. Nothing was asserting it.
 *
 * These run against the pass-through exit, which is the one a request takes
 * when Supabase is not configured, because that needs no credentials. The
 * policy is stamped by `withSecurityPolicy` on all three exits, so what is
 * proved here is the stamp itself.
 */

/** The nonce the response's own policy names. */
function policyNonce(policy: string): string | null {
  const directive = policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("script-src "));
  const match = directive?.match(/'nonce-([^']+)'/);
  return match?.[1] ?? null;
}

/**
 * The nonce the app will actually receive.
 *
 * `NextResponse.next({ request })` does not hand the modified request back
 * directly. It encodes the overridden names in `x-middleware-override-headers`
 * and each value in `x-middleware-request-<name>`, and Next applies them to the
 * request before the render. Reading them here is reading what the layout will
 * read, rather than reading the variable the proxy happened to use.
 */
function forwardedNonce(response: Response): string | null {
  const overridden = (response.headers.get("x-middleware-override-headers") ?? "")
    .split(",")
    .map((name) => name.trim());
  if (!overridden.includes(NONCE_HEADER)) return null;
  return response.headers.get(`x-middleware-request-${NONCE_HEADER}`);
}

/*
 * Every route family the product renders, including the two boundaries.
 *
 * The boundaries are named because they are where a policy like this one
 * historically breaks: `not-found` and `error` render through a different
 * branch of Next's tree than an ordinary page, so a nonce that is wired up in
 * a layout can be absent there while every normal route looks fine. They go
 * through this proxy exactly like anything else, and this is the assertion
 * that says so.
 */
const ROUTES = [
  "/",
  "/home",
  "/search",
  "/wallet",
  "/messages",
  "/definitely-not-a-route",
  "/preview/f1/chrome",
  // The matcher hole that SEC-4 closed: an asset suffix inside a parameter.
  "/listing/abc.png",
];

describe("first run is remembered from the server", () => {
  /* The founder, 16 October 2026: the last slide's Sign in sent him back to
     slide one. The doors read `vallo_first_run` off the request, and only a
     script write on the click that left the slides set it, which a WKWebView
     navigation can outrun. Serving the slides now sets it, so no door can
     bounce the slides' own exit. */
  it("marks the device as shown for one sitting as /welcome is served", async () => {
    const response = await proxy(new NextRequest("http://localhost/welcome?next=%2Fsign-in"));
    const cookie = response.cookies.get("vallo_first_run");
    /* `shown`, never `seen`: the welcome page reads this very request's cookie
       back, and `seen` there would skip the slides on the first visit. */
    expect(cookie?.value).toBe("shown");
    expect(cookie?.maxAge).toBe(60 * 30);
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("lax");
  });

  it("does not set it again when the request already carries seen or shown", async () => {
    for (const value of ["seen", "shown"]) {
      const response = await proxy(
        new NextRequest("http://localhost/welcome", { headers: { cookie: `vallo_first_run=${value}` } }),
      );
      expect(response.cookies.get("vallo_first_run"), value).toBeUndefined();
    }
  });

  it("sets it nowhere else: the doors and the landing page leave the cookie alone", async () => {
    for (const route of ["/", "/sign-in", "/sign-up", "/help"]) {
      const response = await proxy(new NextRequest(`http://localhost${route}`));
      expect(response.cookies.get("vallo_first_run"), route).toBeUndefined();
    }
  });
});

describe("a door's first run is a 307 on a page load (17 October 2026)", () => {
  /* The pages' own redirect() ran after their loading.tsx started the stream:
     a 200, a skeleton, the door's scripts, then a client navigation. */
  it("sends a page load of either door to the slides, with its whole address, policy stamped", async () => {
    for (const door of ["/sign-in", "/sign-up"]) {
      const response = await proxy(new NextRequest(`http://localhost${door}?next=%2Fsaved&notice=sign-in-required`));
      expect(response.status, door).toBe(307);
      const target = new URL(response.headers.get("location")!);
      expect(target.pathname, door).toBe("/welcome");
      expect(target.searchParams.get("next"), door).toBe(`${door}?next=%2Fsaved&notice=sign-in-required`);
      expect(response.headers.get("content-security-policy"), door).toContain("nonce-");
    }
  });

  it("opens the door straight when the decision says so, exactly as the page does", async () => {
    const seen = await proxy(new NextRequest("http://localhost/sign-in", { headers: { cookie: "vallo_first_run=seen" } }));
    expect(seen.status).not.toBe(307);
    const shown = await proxy(new NextRequest("http://localhost/sign-up", { headers: { cookie: "vallo_first_run=shown" } }));
    expect(shown.status).not.toBe(307);
    const passed = await proxy(new NextRequest("http://localhost/sign-in?welcomed=1"));
    expect(passed.status).not.toBe(307);
    const notice = await proxy(new NextRequest("http://localhost/sign-in?notice=signed-out"));
    expect(notice.status).not.toBe(307);
  });

  it("leaves a router navigation, a prefetch and a server action to the page", async () => {
    const rsc = await proxy(new NextRequest("http://localhost/sign-in", { headers: { rsc: "1" } }));
    expect(rsc.status).not.toBe(307);
    const prefetch = await proxy(new NextRequest("http://localhost/sign-in", { headers: { "next-router-prefetch": "1" } }));
    expect(prefetch.status).not.toBe(307);
    const action = await proxy(new NextRequest("http://localhost/sign-in", { method: "POST", headers: { "next-action": "a" } }));
    expect(action.status).not.toBe(307);
  });

  it("touches no other address", async () => {
    for (const route of ["/sign-in/email", "/sign-up/email", "/welcome", "/"]) {
      const response = await proxy(new NextRequest(`http://localhost${route}`));
      expect(response.headers.get("location") ?? "", route).not.toContain("/welcome?next=");
    }
  });
});

describe("the proxy's Content Security Policy", () => {
  it("stamps a policy on every route, boundaries included", async () => {
    for (const route of ROUTES) {
      const response = await proxy(new NextRequest(`http://localhost${route}`));
      const policy = response.headers.get("content-security-policy");
      expect(policy, `${route} served no enforcing policy`).toBeTruthy();
      expect(policy).toContain("'strict-dynamic'");
    }
  });

  it("names, in the policy, the same nonce it forwards to the app", async () => {
    for (const route of ROUTES) {
      const response = await proxy(new NextRequest(`http://localhost${route}`));
      const named = policyNonce(response.headers.get("content-security-policy") ?? "");
      const forwarded = forwardedNonce(response);
      expect(named, `${route} named no nonce in script-src`).toBeTruthy();
      expect(forwarded, `${route} forwarded no ${NONCE_HEADER}`).toBeTruthy();
      expect(named, `${route} would have served a policy the app cannot satisfy`).toBe(forwarded);
    }
  });

  it("mints a fresh nonce per request rather than one per build", async () => {
    const first = await proxy(new NextRequest("http://localhost/"));
    const second = await proxy(new NextRequest("http://localhost/"));
    const a = policyNonce(first.headers.get("content-security-policy") ?? "");
    const b = policyNonce(second.headers.get("content-security-policy") ?? "");
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it("serves the boundaries the identical policy it serves an ordinary page", async () => {
    /* One function builds the string, so the only difference between any two
       responses must be the nonce. A boundary that quietly got a different
       policy is the shape of fault R1 reported, and this is the cheap check
       that would have settled it without a browser. */
    const strip = (policy: string) => policy.replace(/'nonce-[^']+'/, "'nonce-X'");
    const page = await proxy(new NextRequest("http://localhost/"));
    for (const route of ["/definitely-not-a-route", "/home", "/preview/f1/chrome"]) {
      const boundary = await proxy(new NextRequest(`http://localhost${route}`));
      expect(strip(boundary.headers.get("content-security-policy") ?? ""), route).toBe(
        strip(page.headers.get("content-security-policy") ?? ""),
      );
    }
  });

  it("carries the reporting endpoint the policy points at", async () => {
    const response = await proxy(new NextRequest("http://localhost/"));
    expect(response.headers.get("Reporting-Endpoints")).toBe('csp="/api/csp-report"');
  });
});

/* ==========================================================================
 * THE GATE ITSELF, WHICH NOTHING IN THIS FILE USED TO TOUCH.
 * ==========================================================================
 *
 * Every test above runs through the pass-through exit, the one a request takes
 * when Supabase is not configured, because that needs no credentials. That is
 * correct for the nonce contract and it means THE GUARD HAD NO TEST AT ALL:
 * the branch that decides whether a stranger sees the platform was never
 * entered by this suite.
 *
 * It cannot be entered here either. Arming the guard needs `getUser()` to
 * answer, which is a network call to a project this container's egress proxy
 * refuses. So the split is deliberate and is stated rather than papered over:
 *
 *   here             the DECISION, `isPublicPath`, against every route that
 *                    exists, read off the filesystem rather than restated.
 *   gate.spec.mjs    the BEHAVIOUR, a real browser against a real server with
 *                    the guard armed, watching requests bounce.
 *
 * Neither half is the other. A green run here proves the rule is right about
 * the routes we have; it proves nothing about whether the middleware runs.
 *
 * WHAT THIS WOULD REPORT ON AN EMPTY LIST, asked before the assertions were
 * written: "every route is classified" is trivially true of no routes, and
 * "nothing public leaked" is trivially true of nothing. So the list's SIZE and
 * a handful of routes known to exist are checked first, and the file refuses
 * rather than passes if the walk came back thin.
 */

/** Every URL path the app serves, read off the route files. */
function routePaths(): string[] {
  const appDir = join(__dirname, "app");
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      /* A route group in brackets is not a URL segment. */
      const next = entry.startsWith("(") ? prefix : `${prefix}/${entry}`;
      const inside = readdirSync(full);
      if (inside.includes("page.tsx") || inside.includes("route.ts")) out.push(next || "/");
      walk(full, next);
    }
  };
  walk(appDir, "");
  /* The root page and the two file conventions that answer at a URL. */
  out.push("/", "/robots.txt", "/sitemap.xml", "/opengraph-image.jpg");
  return [...new Set(out)].sort();
}

/**
 * THE PUBLIC SET, WRITTEN OUT, AND IT IS THE POINT OF THE FILE.
 *
 * This is not a convenience list. It is the founder's decision of 23 September
 * in the form a check can read, and it is exhaustive: a route that becomes
 * public without appearing here fails, and a route that appears here and stops
 * being public fails. "We forgot to classify it" cannot happen quietly in
 * either direction.
 *
 * Dynamic segments are written as they appear on disk.
 */
const EXPECTED_PUBLIC = new Set([
  /*
   * DECIDED, 23 SEPTEMBER, AFTER IT COST THE FIRST REGISTRATION EVER ATTEMPTED.
   * The public half of the VAPID pair. A browser cannot call
   * `pushManager.subscribe` without it, so gating it made push impossible
   * rather than secure. Its own route header always said publishing it was
   * the intended use, and its variable is named `NEXT_PUBLIC_`.
   */
  "/api/push/key",
  /* OPS-03 / V-01: the uptime monitor's URL (a yes or no, no rows) and the
     canary cron, which authenticates itself with the cron secret. */
  "/api/health/catalogue",
  "/api/cron/canary",
  /* C2: the calendar feed (a secret token, dates only) and its sync job. */
  "/api/calendar/feed",
  "/api/cron/calendar-sync",
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image.jpg",
  /* Company and support. */
  "/about",
  /* V-82: area price pages, aggregates only, 404 below the floor. */
  "/areas/[state]/[area]",
  "/careers",
  "/contact",
  "/docs",
  "/docs/[slug]",
  "/help",
  // V-55: the receipt check, a door for people who are not members.
  "/r",
  "/r/[code]",
  /* Legal and policy. */
  "/cancellations",
  "/disclaimer",
  "/eula",
  "/host-agreement",
  "/privacy",
  "/safety",
  "/standards",
  "/terms",
  /* Compliance. */
  "/delete-account",
  /* The doors. */
  "/auth/callback",
  "/forgot-password",
  "/forgot-password/code",
  "/reset-password",
  "/sign-in",
  "/sign-in/email",
  "/sign-up",
  "/sign-up/email",
  "/sign-up/verify",
  /* B-2: "Finish setting up". Public like every door so it can never loop;
     the page itself sends somebody signed out to sign in. */
  "/sign-up/finish",
  "/start",
  "/welcome",
  /* The share door (V-07): one card, area only, one button into sign in. */
  "/s/[token]",
  /* V-71: the same card as a 9:16 Status picture. */
  "/s/[token]/status",
  /* V-31 and V-32: the landlord's reply page, a door for somebody with no
     account, opened by a single-use token and showing the area only. */
  "/landlord/[token]",
  /* V-61: the agent check, open to a renter with no account. V-62: the page a
     renter's trusted contact opens by a token, the area only. */
  "/check",
  "/safe/[token]",
  /* Recommendations A (30 September 2026): the supply front doors (A9), the
     move-in calculator (A8) and the guides (A14), all read-only and about no
     person. */
  "/for-agents",
  "/for-hosts",
  "/for-landlords",
  "/move-in-cost",
  "/guides",
  "/guides/[slug]",
  /* A12: the sign-in-free email preferences, by signed token. A5: the
     invite door and the step that keeps its code for sign-up. */
  "/email/preferences",
  "/join/[code]",
  "/join/[code]/start",
  /* A3 and A2: code sign-in by email, and by phone behind its switch. */
  "/sign-in/code",
  "/sign-in/phone",
  /* No network, and which home. */
  "/home-or-landing",
  "/open",
  "/offline",
  /* API, each one guarded by a signature, a bearer secret, or nothing because
     it is telemetry a signed-out browser has to be able to post. */
  "/api/auth/email-hook",
  /* A2: the Send SMS hook, signed, and off by default. */
  "/api/auth/sms-hook",
  "/api/client-error",
  /* A12: RFC 8058 one-click unsubscribe, by signed token. A6: the
     first-party funnel beacon, rate limited, recording no person. */
  "/api/email/unsubscribe",
  "/api/funnel",
  /* VC1: the media provider's webhook, behind its signature over the body. */
  "/api/calls/webhook",
  "/api/cron/account-purge",
  "/api/cron/calls-sweep",
  "/api/cron/complete-stays",
  "/api/cron/email-outbox",
  "/api/cron/hold-sweep",
  "/api/cron/rent-share-refunds",
  "/api/cron/reservation-deposit-refunds",
  "/api/cron/inventory-drift",
  "/api/cron/landlord-line",
  "/api/cron/sanctions-lists",
  "/api/cron/sanctions-screen",
  "/api/cron/pg-cron-watch",
  /* C8: the nightly duplicate-photo hash backfill, behind the cron bearer. */
  "/api/cron/photo-hash-backfill",
  /* SCUML item 15: the daily risk classification, behind the cron bearer. */
  "/api/cron/risk-classes",
  /* Crypto payments read back from the provider, behind the cron bearer. */
  "/api/cron/crypto-reconcile",
  /* Escrow arrangements read back from the payment partner, behind the cron bearer. */
  "/api/cron/arrangements-reconcile",
  "/api/cron/saved-search-alerts",
  "/api/cron/store-readiness",
  "/api/cron/new-match-alerts",
  "/api/csp-report",
  /* V-31: a landlord's SMS reply from the aggregator, behind its own bearer. */
  "/api/landlord/inbound",
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
 * The development harness, which is open here and closed by its own guard.
 *
 * `previewHarnessIsOpen` answers not-found on Vercel unconditionally, so these
 * do not exist in production. They are listed apart from `EXPECTED_PUBLIC` so
 * that nobody reads the public list and concludes the preview decks ship.
 */
const HARNESS_PREFIXES = ["/preview", "/gallery"];

describe("who may see the platform with no session", () => {
  it("read a route list worth asserting about", () => {
    /* THE BLIND-LIGHT GUARD. Every assertion below is vacuously true of an
       empty list, and a walk that silently stopped finding routes would turn
       this whole describe block green while proving nothing. */
    const paths = routePaths();
    expect(paths.length, "the route walk came back thin, so nothing below means anything").toBeGreaterThan(250);
    for (const known of ["/", "/sign-in", "/home", "/search", "/listing/[id]", "/api/map/listings"]) {
      expect(paths, `${known} should have been found on disk`).toContain(known);
    }
  });

  it("classifies every route on the platform, with nothing left over", () => {
    const harness = (p: string) => HARNESS_PREFIXES.some((h) => p === h || p.startsWith(`${h}/`));
    const openedByAccident = routePaths().filter(
      (p) => isPublicPath(p) && !EXPECTED_PUBLIC.has(p) && !harness(p),
    );
    const closedByAccident = [...EXPECTED_PUBLIC].filter((p) => !isPublicPath(p));
    expect(openedByAccident, "these routes answer a stranger and nobody decided that").toEqual([]);
    expect(closedByAccident, "these routes were decided public and the gate closes them").toEqual([]);
  });

  it("never closes a page somebody locked out of their account has to reach", () => {
    /* Getting the list wrong in THIS direction is a compliance problem rather
       than a bug, which is why it is asserted separately from the sweep above:
       the sweep would pass if all of these were dropped from both sides. */
    for (const path of [
      "/privacy",
      "/terms",
      "/eula",
      "/cancellations",
      "/standards",
      "/safety",
      "/delete-account",
      "/offline",
      "/robots.txt",
      "/sitemap.xml",
    ]) {
      expect(isPublicPath(path), `${path} must stay reachable without an account`).toBe(true);
    }
  });

  it("closes the browsing surfaces, which is the founder's item 8", () => {
    /* These were open by a deliberate decision until 23 September. The whole
       of item 8 is that they are not any more, so each one is named rather
       than left to the sweep. */
    for (const path of [
      "/home",
      "/search",
      "/listing/anything",
      "/around",
      "/around/yaba-unilag",
      "/stays",
      "/stay/anything",
      "/restaurants",
      "/restaurant/anything",
      "/rent",
      "/price",
      "/post/anything",
      "/u/somebody",
      "/escrow",
      "/verification",
      "/crypto",
      "/styleguide",
    ]) {
      expect(isPublicPath(path), `${path} is inside the platform and must need a session`).toBe(false);
    }
  });

  it("shuts the data routes, because a gate that only redirects pages is a curtain", () => {
    for (const path of [
      "/api/map/listings",
      "/api/crypto/markets",
      "/api/crypto/pairs",
      "/api/crypto/coins/btc",
      "/api/assistant",
      "/api/documents/anything",
      "/api/push/register",
      "/api/push/revoke",
      "/api/push/self-test",
      "/api/passcode/touch",
    ]) {
      expect(isPublicPath(path), `${path} hands product data to a stranger`).toBe(false);
      expect(isApiPath(path), `${path} must be refused as JSON, not redirected to HTML`).toBe(true);
    }
  });

  /*
   * THE ONE THAT WAS SHUT AND SHOULD NOT HAVE BEEN.
   *
   * `/api/push/key` answers the PUBLIC half of the VAPID pair. A browser
   * cannot call `pushManager.subscribe` without it, so gating it made the
   * first device anybody ever tried to register impossible: on 23 September
   * the live site answered `{"error":"Sign in to use this."}` inside a home
   * screen web app, which keeps a cookie store separate from Safari.
   *
   * This asserts the decision in BOTH directions, because an assertion that
   * only says "open" would pass just as happily if somebody opened the three
   * beside it.
   */
  it("serves the public VAPID key to a stranger, and still shuts the three that write or send", () => {
    expect(isPublicPath("/api/push/key"), "a browser cannot subscribe without this").toBe(true);
    for (const path of ["/api/push/register", "/api/push/revoke", "/api/push/self-test"]) {
      expect(isPublicPath(path), `${path} writes or sends and must stay shut`).toBe(false);
    }
  });

  it("lets every scheduled job in vercel.json through the wall", () => {
    /* A cron path missing here is a job Vercel Cron can never reach: the
       sign-in wall answers it and the run silently never happens. */
    const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
      crons?: { path: string }[];
    };
    const paths = (config.crons ?? []).map((c) => c.path);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(isPublicPath(path), `${path} is scheduled in vercel.json and must answer the scheduler`).toBe(true);
    }
  });

  it("leaves the webhooks and the scheduler alone, which have no cookie and never will", () => {
    for (const path of [
      "/api/paystack/webhook",
      "/api/payluk/webhook",
      "/api/yellowcard/webhook",
      "/api/auth/email-hook",
      "/api/cron/email-outbox",
      "/api/push/drain",
      "/api/csp-report",
      "/api/client-error",
      "/api/support",
      "/api/push/sw",
    ]) {
      expect(isPublicPath(path), `${path} is guarded by a signature or a secret and must answer`).toBe(true);
    }
  });

  it("matches the whole first segment, so a longer name is not public by accident", () => {
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/termsheet")).toBe(false);
    expect(isPublicPath("/sign-in")).toBe(true);
    expect(isPublicPath("/sign-in-later")).toBe(false);
    expect(isPublicPath("/help")).toBe(true);
    expect(isPublicPath("/helpdesk")).toBe(false);
  });

  it("does not treat an unknown address as public", () => {
    /* A route nobody has written is inside until somebody says otherwise. The
       not-found page is still served to anybody signed in; a stranger is sent
       to the door. */
    expect(isPublicPath("/definitely-not-a-route")).toBe(false);
  });
});

describe("the store shell never opens on the landing page (V-11)", () => {
  const SHELL =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 VALLO-NATIVE";

  it("sends the shell's request for / to its own start, with the policy still stamped", async () => {
    const response = await proxy(new NextRequest("http://localhost/", { headers: { "user-agent": SHELL } }));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/home-or-landing");
    expect(new URL(response.headers.get("location") ?? "").searchParams.get("app")).toBe("1");
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });

  it("leaves a browser, and every other path in the shell, alone", async () => {
    const browser = await proxy(new NextRequest("http://localhost/"));
    expect(browser.status).not.toBe(307);
    const privacy = await proxy(new NextRequest("http://localhost/privacy", { headers: { "user-agent": SHELL } }));
    expect(privacy.status).not.toBe(307);
  });
});

describe("L-4: a refused auth link redirects before anything renders", () => {
  it("answers /auth/callback?error=... with a 307 to the sign-in sentence, policy stamped", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/auth/callback?error=access_denied&error_code=otp_expired"),
    );
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(`${location.pathname}${location.search}`).toBe(AUTH_CALLBACK_REFUSED);
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });

  it("carries nothing from the query to the target", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/auth/callback?error_code=x&next=https://evil.example"),
    );
    expect(response.headers.get("location")).not.toContain("evil");
  });

  it("leaves a working link, and a server action, to the page", async () => {
    expect(isAuthCallbackRefusal(new URL("http://localhost/auth/callback?code=abc"))).toBe(false);
    expect(isAuthCallbackRefusal(new URL("http://localhost/auth/callback?error="))).toBe(false);
    expect(isAuthCallbackRefusal(new URL("http://localhost/sign-in?error=x"))).toBe(false);
    const working = await proxy(new NextRequest("http://localhost/auth/callback?code=abc"));
    expect(working.status).not.toBe(307);
    const action = await proxy(
      new NextRequest("http://localhost/auth/callback?error=x", { method: "POST", headers: { "next-action": "a" } }),
    );
    expect(action.headers.get("location")).toBeNull();
  });
});

describe("STORE-17: the preview harness in production", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const rewrittenTo = (response: Response) => {
    const target = response.headers.get("x-middleware-rewrite");
    return target ? new URL(target).pathname : null;
  };

  it("answers a real 404 on Vercel, before anything renders", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    for (const route of ["/preview", "/preview/f1/chrome", "/preview/session-b/signin", "/gallery"]) {
      const response = await proxy(new NextRequest(`http://localhost${route}?_rsc=abc`));
      expect(rewrittenTo(response), route).toBe(HARNESS_CLOSED_PATH);
      expect(response.headers.get("content-security-policy"), route).toBeTruthy();
    }
  });

  it("stays closed on Vercel even with the opt-in set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VALLO_PREVIEW_HARNESS", "1");
    expect(rewrittenTo(await proxy(new NextRequest("http://localhost/preview")))).toBe(HARNESS_CLOSED_PATH);
  });

  it("opens in development and on a local proof server that opted in", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(rewrittenTo(await proxy(new NextRequest("http://localhost/preview")))).toBeNull();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VALLO_PREVIEW_HARNESS", "1");
    expect(rewrittenTo(await proxy(new NextRequest("http://localhost/preview")))).toBeNull();
  });

  it("the rewrite target is no route at all, so Next serves not-found with 404", () => {
    expect(routePaths()).not.toContain(HARNESS_CLOSED_PATH);
  });

  it("matches only the harness trees", () => {
    expect(isHarnessPath("/preview")).toBe(true);
    expect(isHarnessPath("/gallery/x")).toBe(true);
    expect(isHarnessPath("/previews")).toBe(false);
    expect(isHarnessPath("/listing/preview")).toBe(false);
  });
});
