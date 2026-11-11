import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * WHAT THE SERVICE WORKER KEEPS, AND WHAT IT NEVER KEEPS (8 October 2026).
 *
 * The founder: an app that shows a full-screen "no connection" card where the
 * page he had just been on should be is not how an industry app behaves. So
 * `public/sw.js` now keeps the pages a member opens, per member, and answers
 * from them when the network is down or too slow to wait for. This file runs
 * the SHIPPED worker (no copy of it) against an in-memory Cache Storage and a
 * scripted network, and pins the rules both ways:
 *
 *   kept      a stamped 200 HTML page on a keepable path, under the viewer the
 *             server named (header, or the head's stamp on Android)
 *   not kept  no stamp; a redirect; a non-200; not HTML; money, identity,
 *             sign-in, admin and API paths; a page rendered for another path;
 *             a header and a head that disagree
 *   served    offline, the kept copy, marked; slow, the kept copy after the
 *             timeout, the fresh one kept behind it and the page told; never
 *             another viewer's copy; a page never opened, the offline screen
 *   instant   (13 October 2026) a whole, recent copy answers at once and the
 *             network refreshes it behind; never on a reload, under
 *             Save-Data, for an old or partial copy, or right after another
 *             instant answer; the shell's start redirects to the kept page
 *   left alone POSTs, API GETs and other origins: no respondWith at all
 *   forgotten a different viewer on any document; `vallo:forget` on sign-out
 */

const SW_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "public", "sw.js");
const SOURCE = readFileSync(SW_PATH, "utf8");
/* The cache names carry the worker's own version, read from the worker rather
   than repeated here: a bump used to mean editing thirty string literals, and
   missing one failed the suite for no reason the failure named. */
const V = /const CACHE_VERSION = "([^"]+)"/.exec(SOURCE)?.[1] ?? "";
const ORIGIN = "https://www.vallospaces.com";
const ALICE = "a1a1a1a1a1a1a1a1";
const BOB = "b2b2b2b2b2b2b2b2";

/* ------------------------------------------------------------ the harness */

class FakeCache {
  entries = new Map<string, Response>();
  private key(input: unknown): string {
    const raw = typeof input === "string" ? input : (input as { url: string }).url;
    return new URL(raw, ORIGIN).href;
  }
  async match(input: unknown) {
    const hit = this.entries.get(this.key(input));
    return hit ? hit.clone() : undefined;
  }
  async put(input: unknown, response: Response) {
    /* The real Cache reads the body to the end before resolving. */
    const body = await response.arrayBuffer();
    this.entries.set(this.key(input), new Response(body, { status: response.status, headers: response.headers }));
  }
  async delete(input: unknown) {
    return this.entries.delete(this.key(input));
  }
  async keys() {
    return [...this.entries.keys()];
  }
  async addAll(urls: string[]) {
    for (const url of urls) this.entries.set(this.key(url), new Response(`shell ${url}`, { headers: { "content-type": "text/html" } }));
  }
}

class FakeCacheStorage {
  stores = new Map<string, FakeCache>();
  async open(name: string) {
    let cache = this.stores.get(name);
    if (!cache) {
      cache = new FakeCache();
      this.stores.set(name, cache);
    }
    return cache;
  }
  async keys() {
    return [...this.stores.keys()];
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
  async has(name: string) {
    return this.stores.has(name);
  }
  async match(input: unknown) {
    for (const cache of this.stores.values()) {
      const hit = await cache.match(input);
      if (hit) return hit;
    }
    return undefined;
  }
}

type Net = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

/* The two hashed files every "whole" test page draws with. */
const ASSETS = ["/_next/static/chunks/app-a1.js", "/_next/static/css/app-b2.css"];

function html(
  viewer: string | null,
  options: { body?: string; status?: number; type?: string; meta?: { viewer: string; path: string }; assets?: readonly string[] } = {},
) {
  const headers: Record<string, string> = { "content-type": options.type ?? "text/html; charset=utf-8", "content-security-policy": "script-src 'nonce-abc'" };
  if (viewer) headers["x-vallo-viewer"] = viewer;
  const meta = options.meta ? `<meta name="x-vallo-viewer" content="${options.meta.viewer}" data-path="${options.meta.path}"/>` : "";
  const links = (options.assets ?? [])
    .map((path) => (path.endsWith(".css") ? `<link rel="stylesheet" href="${path}"/>` : `<script src="${path}" async></script>`))
    .join("");
  return new Response(`<!doctype html><html lang="en"><head>${meta}${links}</head><body>${options.body ?? "page"}</body></html>`, {
    status: options.status ?? 200,
    headers,
  });
}

/* A network that answers hashed files as the build output and every other address with `page()`. */
function withAssets(page: () => Response): (url: string) => Promise<Response> {
  return async (url) =>
    url.includes("/_next/static/")
      ? new Response("bytes", { headers: { "content-type": url.endsWith(".css") ? "text/css" : "application/javascript" } })
      : page();
}

function load(options: { saveData?: boolean; cookies?: Map<string, string> } = {}) {
  const caches = new FakeCacheStorage();
  const listeners = new Map<string, (event: unknown) => void>();
  const posted: Array<{ to: string; message: unknown }> = [];
  const fetched: Array<{ url: string; headers?: Record<string, string> }> = [];
  let network: Net = async () => {
    throw new TypeError("offline");
  };
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => listeners.set(type, fn),
    skipWaiting: async () => undefined,
    location: { origin: ORIGIN },
    navigator: { connection: options.saveData ? { saveData: true } : {} },
    registration: {},
    /* The Cookie Store API, where a test gives the worker one. */
    ...(options.cookies
      ? { cookieStore: { get: async (name: string) => (options.cookies!.has(name) ? { name, value: options.cookies!.get(name) } : null) } }
      : {}),
    clients: {
      claim: async () => undefined,
      matchAll: async () => [{ url: `${ORIGIN}/home`, postMessage: (message: unknown) => posted.push({ to: "/home", message }) }],
    },
  };
  const fetchStub = (input: unknown, init?: { headers?: Record<string, string> }) => {
    const url = typeof input === "string" ? input : (input as { url: string }).url;
    fetched.push({ url, headers: init?.headers });
    return network(url, init);
  };
  new Function("self", "caches", "fetch", SOURCE)(self, caches, fetchStub);

  /** Dispatch a fetch event; resolves with what was answered (or null when the worker left it alone) and waits for the background work. */
  async function request(
    path: string,
    init: { mode?: string; method?: string; headers?: Record<string, string>; cache?: string; preload?: () => Response } = {},
  ) {
    const url = new URL(path, ORIGIN).href;
    let answered: Promise<Response> | null = null;
    const waits: Promise<unknown>[] = [];
    listeners.get("fetch")!({
      request: { url, method: init.method ?? "GET", mode: init.mode ?? "navigate", cache: init.cache ?? "default", headers: new Headers(init.headers ?? {}) },
      /* Navigation preload: what the browser fetched while the worker woke, or nothing. */
      preloadResponse: init.preload ? Promise.resolve(init.preload()) : undefined,
      respondWith: (p: Promise<Response>) => {
        answered = Promise.resolve(p);
      },
      waitUntil: (p: Promise<unknown>) => waits.push(Promise.resolve(p)),
    });
    /* Assigned inside the listener, which the compiler cannot see through. */
    const pending = answered as Promise<Response> | null;
    const response: Response | null = pending ? await pending : null;
    return { response, settled: () => Promise.all(waits) };
  }

  async function message(data: unknown) {
    const waits: Promise<unknown>[] = [];
    listeners.get("message")!({ data, origin: ORIGIN, waitUntil: (p: Promise<unknown>) => waits.push(Promise.resolve(p)) });
    await Promise.all(waits);
  }

  const pages = (viewer: string) => caches.stores.get(`vallo-pages-${V}-${viewer}`);
  const keptPaths = (viewer: string) => [...(pages(viewer)?.entries.keys() ?? [])].map((k) => new URL(k).pathname + new URL(k).search);

  return {
    caches,
    posted,
    fetched,
    request,
    message,
    keptPaths,
    setNetwork: (fn: Net) => {
      network = fn;
    },
    /** Visit a page online, answered by `respond`, and wait for the copy to be written. */
    async visit(path: string, respond: () => Response) {
      network = async () => respond();
      const { response, settled } = await this.request(path);
      await response?.text();
      await settled();
      return response;
    },
  };
}

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/* ---------------------------------------------------------------- the list */

describe("which pages may be kept at all", () => {
  type Pure = { isKeepablePagePath: (p: string) => boolean; CACHE_VERSION: string };
  const pure = new Function("self", "caches", "fetch", `${SOURCE}\nreturn { isKeepablePagePath, CACHE_VERSION };`)(
    { addEventListener: () => undefined, location: { origin: ORIGIN }, navigator: {} },
    new FakeCacheStorage(),
    async () => undefined,
  ) as Pure;

  it.each(["/home", "/search", "/search?q=lekki", "/listing/abc", "/stays", "/messages", "/messages/abc", "/notifications", "/profile", "/u/amara", "/saved", "/bookings/1", "/", "/welcome"])(
    "keeps %s",
    (path) => expect(pure.isKeepablePagePath(path.split("?")[0]!)).toBe(true),
  );

  it.each([
    "/api/push/register",
    "/api/webhooks/paystack",
    "/wallet",
    "/wallet/withdraw",
    "/checkout/b1",
    "/pay/crypto/r1",
    "/payments",
    "/payouts",
    "/refunds",
    "/receipts",
    "/rent/pay/1",
    "/admin",
    "/agent/dashboard",
    "/host/earnings",
    "/auth/callback",
    "/sign-in",
    "/sign-up/email",
    "/forgot-password",
    "/reset-password",
    "/settings/passcode",
    "/settings/devices",
    "/verification",
    "/calls/abc",
    "/open",
    "/offline",
    "/s/token",
    "/_next/static/chunks/a.js",
  ])("never keeps %s", (path) => expect(pure.isKeepablePagePath(path)).toBe(false));

  it("was bumped, so the activate step clears caches the old worker wrote", () => {
    expect(pure.CACHE_VERSION).toBe("v12");
  });
});

/* -------------------------------------------------------------- keeping */

describe("keeping a page", () => {
  it("keeps a stamped page under the viewer the server named, with its policy and without its encoding", async () => {
    const sw = load();
    const response = await sw.visit("/home", () => {
      const r = html(ALICE, { body: "alice home" });
      r.headers.set("content-encoding", "br");
      return r;
    });
    expect(response?.status).toBe(200);
    expect(sw.keptPaths(ALICE)).toEqual(["/home"]);
    const kept = await sw.caches.stores.get(`vallo-pages-${V}-${ALICE}`)!.match(`${ORIGIN}/home`);
    expect(await kept!.text()).toContain("alice home");
    expect(kept!.headers.get("content-security-policy")).toBe("script-src 'nonce-abc'");
    expect(kept!.headers.get("content-encoding")).toBeNull();
  });

  it("keeps nothing without the server's stamp", async () => {
    const sw = load();
    await sw.visit("/home", () => html(null));
    expect([...sw.caches.stores.keys()].filter((n) => n.startsWith("vallo-pages-"))).toEqual([]);
  });

  it("keeps nothing that is not a plain 200 HTML page", async () => {
    const sw = load();
    await sw.visit("/home", () => html(ALICE, { status: 404 }));
    await sw.visit("/search", () => html(ALICE, { status: 500 }));
    await sw.visit("/profile", () => html(ALICE, { type: "application/json" }));
    expect(sw.keptPaths(ALICE)).toEqual([]);
  });

  it("never keeps a money, identity or sign-in page, even stamped", async () => {
    const sw = load();
    for (const path of ["/wallet", "/checkout/b1", "/payments", "/sign-in", "/settings/passcode", "/admin", "/api/me"]) {
      await sw.visit(path, () => html(ALICE));
    }
    expect(sw.keptPaths(ALICE)).toEqual([]);
  });

  it("keeps a page the Android shell fetched, from the head's stamp, when the path matches", async () => {
    const sw = load();
    await sw.visit("/home", () => html(null, { meta: { viewer: ALICE, path: "/home" } }));
    expect(sw.keptPaths(ALICE)).toEqual(["/home"]);
  });

  it("refuses a page rendered for another address (a redirect followed out of sight)", async () => {
    const sw = load();
    await sw.visit("/listing/abc", () => html(null, { meta: { viewer: ALICE, path: "/sign-in" } }));
    expect(sw.keptPaths(ALICE)).toEqual([]);
  });

  it("refuses a page whose header and head disagree about whose it is", async () => {
    const sw = load();
    await sw.visit("/home", () => html(ALICE, { meta: { viewer: BOB, path: "/home" } }));
    expect(sw.keptPaths(ALICE)).toEqual([]);
    expect(sw.keptPaths(BOB)).toEqual([]);
  });

  it("marks the copy's root element as kept, once, so the page can tell before any script asks the network", async () => {
    const sw = load();
    await sw.visit("/home", () => html(ALICE, { body: "alice home" }));
    const kept = await sw.caches.stores.get(`vallo-pages-${V}-${ALICE}`)!.match(`${ORIGIN}/home`);
    const text = await kept!.text();
    expect(text).toContain('<html data-vallo-kept="" lang="en">');
    expect(text.match(/data-vallo-kept/g)).toHaveLength(1);
  });

  it("notes whether every script and stylesheet the page draws with is on the phone", async () => {
    const sw = load();
    sw.setNetwork(withAssets(() => html(ALICE, { assets: ASSETS })));
    const whole = await sw.request("/home");
    await whole.response!.text();
    await whole.settled();
    const keptWhole = await sw.caches.stores.get(`vallo-pages-${V}-${ALICE}`)!.match(`${ORIGIN}/home`);
    expect(keptWhole!.headers.get("x-vallo-whole")).toBe("1");
    expect(await sw.caches.stores.get(`vallo-assets-${V}`)!.match(`${ORIGIN}${ASSETS[0]}`)).toBeTruthy();

    /* A chunk the network refuses leaves the copy partial. */
    sw.setNetwork(async (url) => (url.includes("/_next/static/") ? new Response("gone", { status: 404 }) : html(ALICE, { assets: ["/_next/static/chunks/missing-c3.js"] })));
    const partial = await sw.request("/search");
    await partial.response!.text();
    await partial.settled();
    const keptPartial = await sw.caches.stores.get(`vallo-pages-${V}-${ALICE}`)!.match(`${ORIGIN}/search`);
    expect(keptPartial!.headers.get("x-vallo-whole")).toBeNull();
  });

  it("names the stylesheets the copy cannot be read without, so they can be checked again later", async () => {
    const sw = load();
    sw.setNetwork(withAssets(() => html(ALICE, { assets: ASSETS })));
    const visit = await sw.request("/home");
    await visit.response!.text();
    await visit.settled();
    const kept = await sw.caches.stores.get(`vallo-pages-${V}-${ALICE}`)!.match(`${ORIGIN}/home`);
    /* The stylesheet, and not the script: a missing chunk costs interactivity
       the page can fetch back, a missing stylesheet costs legibility. */
    expect(kept!.headers.get("x-vallo-css")).toBe("/_next/static/css/app-b2.css");
  });
});

/*
 * A COPY WHOSE STYLESHEETS HAVE GONE (the founder, 11 November 2026: docs and
 * legal pages drawn with their sections painted over one another and their
 * paragraphs one word wide, on his phone, on pages that are correct in every
 * browser in this repository).
 *
 * The page cache and the asset cache are two stores with two lifetimes. Safari
 * drops Cache Storage entries one at a time under storage pressure, and a
 * deploy retires the hashed chunks an older document names, so a kept document
 * can outlive the CSS it was kept with. It used to be shown anyway, because
 * the "whole" stamp was taken once, at the moment it was kept, and never read
 * again. A document drawn with half its rules does not degrade, it breaks.
 */
describe("a kept copy whose stylesheets the phone has since dropped", () => {
  /** Keep a whole copy, then drop its stylesheet the way a phone does. */
  async function keptThenEvicted() {
    const sw = load();
    sw.setNetwork(withAssets(() => html(ALICE, { assets: ASSETS, body: "the page as it was" })));
    const visit = await sw.request("/home");
    await visit.response!.text();
    await visit.settled();
    const assets = sw.caches.stores.get(`vallo-assets-${V}`)!;
    expect(await assets.match(`${ORIGIN}${ASSETS[1]}`)).toBeTruthy();
    await assets.delete(`${ORIGIN}${ASSETS[1]}`);
    return sw;
  }

  it("is not shown at once: the network answers instead, even though the copy is whole and fresh", async () => {
    const sw = await keptThenEvicted();
    sw.setNetwork(async () => html(ALICE, { assets: ASSETS, body: "the page from the network" }));
    const again = await sw.request("/home");
    const text = await again.response!.text();
    await again.settled();
    expect(text).toContain("the page from the network");
    expect(again.response!.headers.get("server-timing") ?? "").not.toContain("instant");
  });

  it("gives way to the calm offline screen rather than draw itself half styled", async () => {
    const sw = await keptThenEvicted();
    await sw.caches.open(`vallo-shell-${V}`).then((c) => c.addAll(["/offline"]));
    sw.setNetwork(async () => {
      throw new Error("no signal");
    });
    const again = await sw.request("/home");
    const text = await again.response!.text();
    expect(text).not.toContain("the page as it was");
  });

  it("is shown as before once the stylesheet is back on the phone", async () => {
    const sw = await keptThenEvicted();
    sw.setNetwork(withAssets(() => html(ALICE, { assets: ASSETS, body: "the page as it was" })));
    /* Put the stylesheet back, the way a visit over the network does. */
    const assets = sw.caches.stores.get(`vallo-assets-${V}`)!;
    await assets.put(`${ORIGIN}${ASSETS[1]}`, new Response(".a{}"));
    sw.setNetwork(async () => {
      throw new Error("no signal");
    });
    const again = await sw.request("/home");
    expect(await again.response!.text()).toContain("the page as it was");
  });
});

/* ------------------------------------------------------------- answering */

describe("answering a navigation", () => {
  it("offline, opens the page this viewer already saw, marked as kept", async () => {
    const sw = load();
    await sw.visit("/messages", () => html(ALICE, { body: "the inbox as it was" }));
    sw.setNetwork(async () => {
      throw new TypeError("offline");
    });
    const { response } = await sw.request("/messages");
    expect(await response!.text()).toContain("the inbox as it was");
    expect(response!.headers.get("server-timing")).toMatch(/vallo-kept/);
  });

  it("offline, a page never opened here gets the small offline screen", async () => {
    const sw = load();
    await sw.caches.open(`vallo-shell-${V}`).then((c) => c.addAll(["/offline"]));
    await sw.visit("/home", () => html(ALICE));
    sw.setNetwork(async () => {
      throw new TypeError("offline");
    });
    const { response } = await sw.request("/listing/never-opened");
    expect(await response!.text()).toBe("shell /offline");
  });

  it("offline, a money page is never answered from a copy", async () => {
    const sw = load();
    await sw.caches.open(`vallo-shell-${V}`).then((c) => c.addAll(["/offline"]));
    await sw.visit("/wallet", () => html(ALICE, { body: "balance 5,000" }));
    sw.setNetwork(async () => {
      throw new TypeError("offline");
    });
    const { response } = await sw.request("/wallet");
    expect(await response!.text()).not.toContain("balance");
  });

  it("offline, the shell's start opens the viewer's kept home, by a redirect so the address is the page's", async () => {
    const sw = load();
    await sw.visit("/home", () => html(ALICE, { body: "alice home" }));
    sw.setNetwork(async () => {
      throw new TypeError("offline");
    });
    const start = await sw.request("/open");
    expect(start.response!.status).toBe(302);
    expect(start.response!.headers.get("location")).toBe(`${ORIGIN}/home`);
    const { response } = await sw.request("/home");
    expect(await response!.text()).toContain("alice home");
  });

  it("online, the network answers and the copy is refreshed", async () => {
    const sw = load();
    await sw.visit("/home", () => html(ALICE, { body: "old" }));
    sw.setNetwork(async () => html(ALICE, { body: "new" }));
    const { response, settled } = await sw.request("/home");
    expect(await response!.text()).toContain("new");
    expect(response!.headers.get("server-timing")).toBeNull();
    await settled();
    const kept = await sw.caches.stores.get(`vallo-pages-${V}-${ALICE}`)!.match(`${ORIGIN}/home`);
    expect(await kept!.text()).toContain("new");
  });

  it("slow, the kept copy answers after the timeout, the fresh one is kept behind it, and the page is told", async () => {
    const sw = load();
    await sw.visit("/home", () => html(ALICE, { body: "old" }));
    vi.useFakeTimers();
    let release: (r: Response) => void = () => undefined;
    sw.setNetwork(() => new Promise<Response>((resolve) => (release = resolve)));
    const pending = sw.request("/home");
    await vi.advanceTimersByTimeAsync(3_100);
    const { response, settled } = await pending;
    expect(await response!.text()).toContain("old");
    expect(response!.headers.get("server-timing")).toMatch(/vallo-kept/);
    vi.useRealTimers();
    release(html(ALICE, { body: "fresh" }));
    await settled();
    const kept = await sw.caches.stores.get(`vallo-pages-${V}-${ALICE}`)!.match(`${ORIGIN}/home`);
    expect(await kept!.text()).toContain("fresh");
    expect(sw.posted).toContainEqual({ to: "/home", message: { type: "vallo:page-fresh", path: "/home" } });
  });

  it("with nothing kept, waits for the network however slow, rather than showing the offline screen", async () => {
    const sw = load();
    vi.useFakeTimers();
    let release: (r: Response) => void = () => undefined;
    sw.setNetwork(() => new Promise<Response>((resolve) => (release = resolve)));
    const pending = sw.request("/search");
    await vi.advanceTimersByTimeAsync(10_000);
    release(html(ALICE, { body: "results" }));
    vi.useRealTimers();
    const { response } = await pending;
    expect(await response!.text()).toContain("results");
  });
});

/* ------------------------------------------------------- answering at once */

describe("answering at once from the phone (the startup track)", () => {
  /** Visit a page online with its hashed files, so the copy is whole. */
  async function keepWhole(sw: ReturnType<typeof load>, path: string, body: string) {
    sw.setNetwork(withAssets(() => html(ALICE, { body, assets: ASSETS })));
    const { response, settled } = await sw.request(path);
    await response!.text();
    await settled();
  }

  it("a whole, recent copy answers at once, marked instant, and the network refreshes it behind the screen", async () => {
    const sw = load();
    await keepWhole(sw, "/home", "old");
    let release: (r: Response) => void = () => undefined;
    sw.setNetwork(() => new Promise<Response>((resolve) => (release = resolve)));
    /* No timer is advanced: the answer does not wait for the network at all. */
    const { response, settled } = await sw.request("/home");
    expect(await response!.text()).toContain("old");
    expect((response!.headers.get("server-timing") ?? "").split(", ")[0]).toBe('vallo-kept;desc="instant"');
    expect(response!.headers.get("x-vallo-whole")).toBeNull();
    release(html(ALICE, { body: "fresh", assets: ASSETS }));
    await settled();
    const kept = await sw.caches.stores.get(`vallo-pages-${V}-${ALICE}`)!.match(`${ORIGIN}/home`);
    expect(await kept!.text()).toContain("fresh");
    expect(sw.posted).toContainEqual({ to: "/home", message: { type: "vallo:page-fresh", path: "/home" } });
  });

  it("shows the network's page when it answered before the phone's copy was even read", async () => {
    const sw = load();
    await keepWhole(sw, "/home", "old");
    sw.setNetwork(withAssets(() => html(ALICE, { body: "fresh already", assets: ASSETS })));
    const { response, settled } = await sw.request("/home");
    expect(await response!.text()).toContain("fresh already");
    expect(response!.headers.get("server-timing")).toBeNull();
    await settled();
    expect(sw.posted).toEqual([]);
  });

  it("uses the browser's navigation preload rather than fetching the page a second time", async () => {
    const sw = load();
    sw.setNetwork(async () => {
      throw new Error("the worker should not fetch a preloaded page");
    });
    const { response, settled } = await sw.request("/search", { preload: () => html(ALICE, { body: "preloaded results" }) });
    expect(await response!.text()).toContain("preloaded results");
    await settled();
    expect(sw.fetched.filter((f) => f.url.endsWith("/search"))).toEqual([]);
    expect(sw.keptPaths(ALICE)).toEqual(["/search"]);
  });

  it("tells the page when the session has ended behind an instant answer, so its refresh follows the redirect", async () => {
    const sw = load();
    await keepWhole(sw, "/home", "old");
    sw.setNetwork(async () => new Response(null, { status: 307, headers: { location: "/sign-in" } }));
    const { response, settled } = await sw.request("/home");
    expect(await response!.text()).toContain("old");
    await settled();
    expect(sw.posted).toContainEqual({ to: "/home", message: { type: "vallo:page-fresh", path: "/home" } });
  });

  it("keeps the copy on screen, untold, when the network answers an error page", async () => {
    const sw = load();
    await keepWhole(sw, "/home", "old");
    sw.setNetwork(async () => html(ALICE, { status: 502, body: "bad gateway" }));
    const { response, settled } = await sw.request("/home");
    expect(await response!.text()).toContain("old");
    await settled();
    expect(sw.posted).toEqual([]);
  });

  it("a reload asks the network first", async () => {
    const sw = load();
    await keepWhole(sw, "/home", "old");
    sw.setNetwork(withAssets(() => html(ALICE, { body: "new" })));
    const { response } = await sw.request("/home", { cache: "no-cache" });
    expect(await response!.text()).toContain("new");
  });

  it("under Save-Data or 2G, answers at once too, marked instant-light, and still keeps the network's copy", async () => {
    const sw = load();
    await keepWhole(sw, "/home", "old");
    let release: (r: Response) => void = () => undefined;
    sw.setNetwork(() => new Promise<Response>((resolve) => (release = resolve)));
    const { response, settled } = await sw.request("/home", { headers: { "save-data": "on" } });
    expect(await response!.text()).toContain("old");
    expect((response!.headers.get("server-timing") ?? "").split(", ")[0]).toBe('vallo-kept;desc="instant-light"');
    release(html(ALICE, { body: "fresh", assets: ASSETS }));
    await settled();
    const kept = await sw.caches.stores.get(`vallo-pages-${V}-${ALICE}`)!.match(`${ORIGIN}/home`);
    expect(await kept!.text()).toContain("fresh");
    /* The page refreshes once, on this message, not straight away. */
    expect(sw.posted).toContainEqual({ to: "/home", message: { type: "vallo:page-fresh", path: "/home" } });
  });

  it("a partial copy (a chunk not on the phone) asks the network first", async () => {
    const sw = load();
    await sw.visit("/home", () => html(ALICE, { body: "old" }));
    sw.setNetwork(async () => html(ALICE, { body: "new" }));
    const { response } = await sw.request("/home");
    expect(await response!.text()).toContain("new");
  });

  it("a copy older than two days asks the network first", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T08:00:00Z"));
    const sw = load();
    await keepWhole(sw, "/home", "old");
    vi.setSystemTime(new Date("2026-10-12T09:00:00Z"));
    sw.setNetwork(withAssets(() => html(ALICE, { body: "new" })));
    const { response } = await sw.request("/home");
    expect(await response!.text()).toContain("new");
  });

  it("a second document load moments after an instant answer goes to the network, so a reload cannot loop on the copy", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T08:00:00Z"));
    const sw = load();
    await keepWhole(sw, "/home", "old");
    await keepWhole(sw, "/search", "old search");
    /* A network slower than the phone, so the copy is the quicker answer. */
    let release: (r: Response) => void = () => undefined;
    sw.setNetwork(() => new Promise<Response>((resolve) => (release = resolve)));
    const first = await sw.request("/home");
    expect(await first.response!.text()).toContain("old");
    release(html(ALICE, { body: "new", assets: ASSETS }));
    await first.settled();
    vi.setSystemTime(new Date("2026-10-13T08:00:05Z"));
    sw.setNetwork(withAssets(() => html(ALICE, { body: "new", assets: ASSETS })));
    const second = await sw.request("/search");
    expect(await second.response!.text()).toContain("new");
    await second.settled();
    vi.setSystemTime(new Date("2026-10-13T08:01:00Z"));
    sw.setNetwork(() => new Promise<Response>(() => undefined));
    const later = await sw.request("/home");
    expect((later.response!.headers.get("server-timing") ?? "").split(", ")[0]).toBe('vallo-kept;desc="instant"');
  });

  it("the shell's start redirects at once to the viewer's kept home, with no round trip", async () => {
    const sw = load();
    await keepWhole(sw, "/home", "alice home");
    let release: (r: Response) => void = () => undefined;
    sw.setNetwork(() => new Promise<Response>((resolve) => (release = resolve)));
    const start = await sw.request("/open");
    expect(start.response!.status).toBe(302);
    expect(start.response!.headers.get("location")).toBe(`${ORIGIN}/home`);
    release(new Response(null, { status: 307, headers: { location: "/home" } }));
    await start.settled();
    const home = await sw.request("/home");
    expect(await home.response!.text()).toContain("alice home");
    expect((home.response!.headers.get("server-timing") ?? "").split(", ")[0]).toBe('vallo-kept;desc="instant"');
  });

  it("the welcome screen answers at once only when it was kept the way the first-run cookie draws it now", async () => {
    const cookies = new Map<string, string>();
    const sw = load({ cookies });
    await keepWhole(sw, "/welcome", "the slides");
    sw.setNetwork(() => new Promise<Response>(() => undefined));
    const same = await sw.request("/welcome");
    expect(await same.response!.text()).toContain("the slides");
    expect((same.response!.headers.get("server-timing") ?? "").split(", ")[0]).toBe('vallo-kept;desc="instant"');

    /* The device saw the slides since: the server now draws the choice, so the network answers. */
    const other = load({ cookies });
    await keepWhole(other, "/welcome", "the slides");
    cookies.set("vallo_first_run", "seen");
    other.setNetwork(withAssets(() => html(ALICE, { body: "the choice", assets: ASSETS })));
    const changed = await other.request("/welcome");
    expect(await changed.response!.text()).toContain("the choice");
    await changed.settled();
    /* Kept again, the choice way: now it answers at once while the cookie says so. */
    const third = load({ cookies });
    await keepWhole(third, "/welcome", "the choice");
    third.setNetwork(() => new Promise<Response>(() => undefined));
    const again = await third.request("/welcome");
    expect((again.response!.headers.get("server-timing") ?? "").split(", ")[0]).toBe('vallo-kept;desc="instant"');
  });

  it("the welcome screen never answers at once where the worker cannot read cookies", async () => {
    const sw = load();
    await keepWhole(sw, "/welcome", "the slides");
    sw.setNetwork(withAssets(() => html(ALICE, { body: "from the network", assets: ASSETS })));
    const { response } = await sw.request("/welcome");
    expect(await response!.text()).toContain("from the network");
  });

  it("the front door is never redirected at once: its own copy or the network", async () => {
    const sw = load();
    await keepWhole(sw, "/home", "alice home");
    sw.setNetwork(async () => html(ALICE, { body: "the landing" }));
    const { response } = await sw.request("/");
    expect(response!.status).toBe(200);
    expect(await response!.text()).toContain("the landing");
  });
});

/* ------------------------------------------------------------ the shell */

describe("the offline shell, stale while revalidate", () => {
  it("is fetched again behind a good navigation once the refresh interval has passed, and not before", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T08:00:00Z"));
    const sw = load();
    await sw.caches.open(`vallo-shell-${V}`).then((c) => c.addAll(["/offline"]));
    await sw.caches.open(`vallo-meta-${V}`).then((c) => c.put("/__vallo/shell-refreshed", new Response(String(Date.now()))));
    const network = async (url: string) =>
      url.endsWith("/offline") ? new Response("the new offline screen", { headers: { "content-type": "text/html" } }) : html(ALICE);

    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
    sw.setNetwork(network);
    let visit = await sw.request("/home");
    await visit.response!.text();
    await visit.settled();
    expect(sw.fetched.some((f) => f.url.endsWith("/offline"))).toBe(false);

    vi.setSystemTime(new Date("2026-10-13T15:00:00Z"));
    visit = await sw.request("/search");
    await visit.response!.text();
    await visit.settled();
    expect(sw.fetched.filter((f) => f.url.endsWith("/offline"))).toHaveLength(1);
    const shell = await sw.caches.stores.get(`vallo-shell-${V}`)!.match(`${ORIGIN}/offline`);
    expect(await shell!.text()).toBe("the new offline screen");
  });

  it("is never fetched again under Save-Data", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T08:00:00Z"));
    const sw = load({ saveData: true });
    await sw.caches.open(`vallo-meta-${V}`).then((c) => c.put("/__vallo/shell-refreshed", new Response(String(Date.now() - 24 * 60 * 60 * 1000))));
    sw.setNetwork(async () => html(ALICE));
    const visit = await sw.request("/home");
    await visit.response!.text();
    await visit.settled();
    expect(sw.fetched.some((f) => f.url.endsWith("/offline"))).toBe(false);
  });
});

/* ------------------------------------------------------- the build output */

describe("the hashed build output and the fonts", () => {
  it("are cache first: answered from the phone with no second download", async () => {
    const sw = load();
    let hits = 0;
    sw.setNetwork(async () => {
      hits += 1;
      return new Response("chunk", { headers: { "content-type": "application/javascript" } });
    });
    for (const path of ["/_next/static/chunks/main-d4.js?dpl=dpl_1", "/_next/static/chunks/main-d4.js?dpl=dpl_2", "/fonts/v2/inter-latin.woff2"]) {
      const first = await sw.request(path, { mode: "no-cors" });
      expect(await first.response!.text()).toBeTruthy();
      await first.settled();
    }
    expect(hits).toBe(2);
    sw.setNetwork(async () => {
      throw new TypeError("offline");
    });
    const offline = await sw.request("/_next/static/chunks/main-d4.js", { mode: "no-cors" });
    expect(await offline.response!.text()).toBe("chunk");
  });

  it("while the brand artwork stays stale while revalidate", async () => {
    const sw = load();
    let hits = 0;
    sw.setNetwork(async () => {
      hits += 1;
      return new Response(`svg ${hits}`, { headers: { "content-type": "image/svg+xml" } });
    });
    const first = await sw.request("/brand/vallo-mark.svg", { mode: "no-cors" });
    expect(await first.response!.text()).toBe("svg 1");
    await new Promise((r) => setTimeout(r, 10));
    const second = await sw.request("/brand/vallo-mark.svg", { mode: "no-cors" });
    expect(await second.response!.text()).toBe("svg 1");
    await new Promise((r) => setTimeout(r, 10));
    expect(hits).toBe(2);
  });
});

/* ----------------------------------------------------------- whose pages */

describe("one viewer's pages are never another's", () => {
  it("a document naming a different viewer deletes the previous viewer's pages before anything else", async () => {
    const sw = load();
    await sw.visit("/messages", () => html(ALICE, { body: "alice's inbox" }));
    expect(sw.keptPaths(ALICE)).toEqual(["/messages"]);
    /* Bob signs in on the same phone: even a page that is never kept says whose it is. */
    await sw.visit("/sign-in", () => html(BOB));
    expect(sw.caches.stores.has(`vallo-pages-${V}-${ALICE}`)).toBe(false);
    sw.setNetwork(async () => {
      throw new TypeError("offline");
    });
    const { response } = await sw.request("/messages");
    expect(await response!.text()).not.toContain("alice");
  });

  it("signing out forgets every kept page", async () => {
    const sw = load();
    await sw.visit("/home", () => html(ALICE));
    await sw.visit("/profile", () => html(ALICE));
    await sw.message({ type: "vallo:forget" });
    expect([...sw.caches.stores.keys()].filter((n) => n.startsWith("vallo-pages-"))).toEqual([]);
  });
});

/* -------------------------------------------------------- left alone */

describe("what the worker never touches", () => {
  it("leaves POSTs, server actions and webhooks to the network", async () => {
    const sw = load();
    expect((await sw.request("/messages/abc", { method: "POST", mode: "cors", headers: { "next-action": "x" } })).response).toBeNull();
    expect((await sw.request("/api/webhooks/paystack", { method: "POST", mode: "cors" })).response).toBeNull();
  });

  it("leaves API GETs alone: no cache, no stale answer", async () => {
    const sw = load();
    expect((await sw.request("/api/me", { mode: "cors" })).response).toBeNull();
    expect((await sw.request("/api/wallet/balance", { mode: "cors" })).response).toBeNull();
  });

  it("leaves another origin alone", async () => {
    const sw = load();
    expect((await sw.request("https://images.unsplash.com/photo.jpg", { mode: "no-cors" })).response).toBeNull();
    expect((await sw.request("https://x.supabase.co/rest/v1/listings", { mode: "cors" })).response).toBeNull();
  });
});

/* ------------------------------------------------------------ photographs */

describe("listing photographs", () => {
  it("are kept the first time and answered from the phone after that, offline included", async () => {
    const sw = load();
    let hits = 0;
    sw.setNetwork(async () => {
      hits += 1;
      return new Response("avif-bytes", { headers: { "content-type": "image/avif" } });
    });
    const path = "/_next/image?url=https%3A%2F%2Fx.supabase.co%2Fp.jpg&w=384&q=60";
    const first = await sw.request(path, { mode: "no-cors" });
    expect(await first.response!.text()).toBe("avif-bytes");
    await new Promise((r) => setTimeout(r, 10));
    sw.setNetwork(async () => {
      throw new TypeError("offline");
    });
    const second = await sw.request(path, { mode: "no-cors" });
    expect(await second.response!.text()).toBe("avif-bytes");
    expect(hits).toBe(1);
  });

  it("refuses a personal image response", async () => {
    const sw = load();
    sw.setNetwork(async () => new Response("x", { headers: { "content-type": "image/png", "cache-control": "private" } }));
    const path = "/_next/image?url=%2Fa.png&w=384&q=60";
    await sw.request(path, { mode: "no-cors" });
    await new Promise((r) => setTimeout(r, 10));
    expect(sw.caches.stores.get(`vallo-images-${V}`)?.entries.size ?? 0).toBe(0);
  });
});

/* ------------------------------------------------------------- warming */

describe("pages opened inside the app", () => {
  it("are fetched once as a document, marked as a warm, and kept", async () => {
    const sw = load();
    sw.setNetwork(async () => html(ALICE, { body: "search" }));
    await sw.message({ type: "vallo:visited", path: "/search?q=lekki" });
    expect(sw.fetched.at(-1)?.headers?.["x-vallo-warm"]).toBe("1");
    expect(sw.keptPaths(ALICE)).toEqual(["/search?q=lekki"]);
    /* A second announcement inside the window does not fetch again. */
    const before = sw.fetched.length;
    await sw.message({ type: "vallo:visited", path: "/search?q=lekki" });
    expect(sw.fetched.length).toBe(before);
  });

  it("are never fetched for a never-kept path, another origin, or under Save-Data", async () => {
    const sw = load();
    sw.setNetwork(async () => html(ALICE));
    await sw.message({ type: "vallo:visited", path: "/wallet" });
    await sw.message({ type: "vallo:visited", path: "https://evil.example/home" });
    await sw.message({ type: "vallo:visited", path: "//evil.example/home" });
    expect(sw.fetched).toEqual([]);

    const frugal = load({ saveData: true });
    frugal.setNetwork(async () => html(ALICE));
    await frugal.message({ type: "vallo:visited", path: "/home" });
    expect(frugal.fetched).toEqual([]);
  });
});
