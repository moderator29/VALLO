/**
 * TRY AGAIN RE-FETCHES, AND A SLOW SERVER IS TRIED AGAIN QUIETLY (13 November
 * 2026, the founder: "all try again button don't use to work it's just like a
 * dead button it's not reloading", with a screenshot of "This screen did not
 * load").
 *
 * The cause: every boundary called `reset()`, which in Next 16.3+ only clears
 * the error and redraws from what the client already holds. A Server Component
 * that failed stayed failed, so Try again, and the boundary's own timed
 * retries, did nothing. Next passes `retry()` (a refresh of the server's answer
 * plus the reset, in one transition: next/dist/client/components/error-boundary.js),
 * and every boundary now calls `retry ?? reset`.
 *
 * Driven in Chromium, with the app's real boundary (`app/(app)/error.tsx`)
 * inside a boundary built the way Next 16.4 builds one: `reset` clears the
 * error only, `retry` asks the "server" again and then clears it. The "server"
 * is a function that fails a set number of times with a digest (what Next
 * sends for a Server Component failure) and then answers.
 *
 * Also here: the failure screen's way home is never a dead link (the founder's
 * second screenshot, 13 November 2026: "Vallo home" on /home did nothing). On
 * the same page it tries again; elsewhere it is a full load.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

beforeAll(warmBrowser);
afterAll(closeBrowser);

type Counts = { __fetches: number; __retries: number; __resets: number; __retryAt: number[]; __t0: number; __finalAt?: number };

/**
 * @param fails how many of the server's answers fail (Infinity: all of them)
 * @param kind "server": the failure carries a digest; "client": a bug in the browser, no digest
 * @param withRetry false gives the boundary `reset` only: the old wiring
 */
const entry = ({ fails, kind = "server", withRetry = true }: { fails: number; kind?: "server" | "client"; withRetry?: boolean }) => `
  import { Component, startTransition } from "react";
  import AppError from "@/app/(app)/error";
  import { mount } from "@/lib/testing/browser-root";

  Object.assign(window, { __fetches: 0, __retries: 0, __resets: 0, __retryAt: [], __t0: performance.now() });
  /* The first time the final screen (the one with a reference) is on screen. */
  new MutationObserver(() => {
    if (window.__finalAt === undefined && /Reference/.test(document.body.innerText)) window.__finalAt = performance.now();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  function askServer() {
    window.__fetches += 1;
    if (window.__fetches <= ${fails === Infinity ? "Infinity" : fails}) {
      return { error: ${
        kind === "server"
          ? `Object.assign(new Error("An error occurred in the Server Components render."), { digest: "4096" })`
          : `new TypeError("Cannot read properties of undefined (reading 'id')")`
      } };
    }
    return { ok: true };
  }
  function Segment({ answer }) {
    if (answer.error) throw answer.error;
    return <main data-testid="screen">Your homes</main>;
  }
  /* The page's first answer, asked once: React may construct a boundary that
     never committed a second time, and that must not count as a second ask. */
  const first = askServer();
  class Boundary extends Component {
    constructor(p) { super(p); this.state = { error: null, answer: first }; }
    static getDerivedStateFromError(error) { return { error }; }
    clear = () => this.setState({ error: null });
    reset = () => { window.__resets += 1; this.clear(); };
    retry = () => {
      window.__retries += 1;
      window.__retryAt.push(performance.now());
      startTransition(() => { this.setState({ answer: askServer() }); this.clear(); });
    };
    render() {
      if (this.state.error) {
        return <AppError error={this.state.error} reset={this.reset} ${withRetry ? "retry={this.retry}" : ""} />;
      }
      return <Segment answer={this.state.answer} />;
    }
  }
  mount(<Boundary />);
`;

/* The quiet tries already spent on this address, so the final screen is drawn at once. */
const SPENT = `sessionStorage.clear(); sessionStorage.setItem("nf_weak_retry", JSON.stringify({ path: location.pathname, first: Date.now(), count: 4, last: Date.now() - 5000 }));`;
const FRESH = "sessionStorage.clear();";

const read = (page: import("playwright-core").Page) =>
  page.evaluate(() => {
    const w = window as unknown as Counts;
    return { fetches: w.__fetches, retries: w.__retries, resets: w.__resets, retryAt: w.__retryAt.map((t) => t - w.__t0), finalAt: w.__finalAt === undefined ? null : w.__finalAt - w.__t0 };
  });

describe.skipIf(!hasBrowser && !process.env.CI)("Try again on a failure screen", () => {
  it(
    "calls retry, not reset, and a segment that failed once on the server is drawn again",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry({ fails: 1 }), reducedMotion: true, init: SPENT });
      try {
        await page.getByText(/Reference/).waitFor();
        await page.getByRole("button", { name: "Try again" }).click();
        await page.getByTestId("screen").waitFor({ timeout: 5000 });
        const c = await read(page);
        expect(c.retries).toBe(1);
        expect(c.resets).toBe(0);
        /* The server was asked twice: the failure, and the try that answered. */
        expect(c.fetches).toBe(2);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "the old wiring, reset alone, draws the same failure again: the dead button the founder pressed",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry({ fails: 1, withRetry: false }), reducedMotion: true, init: SPENT });
      try {
        await page.getByText(/Reference/).waitFor();
        await page.getByRole("button", { name: "Try again" }).click();
        await page.waitForFunction(() => (window as unknown as Counts).__resets >= 1);
        await page.waitForTimeout(500);
        const c = await read(page);
        /* Nothing was asked of the server, so the segment is still the failure. */
        expect(c.fetches).toBe(1);
        expect(await page.getByTestId("screen").count()).toBe(0);
        expect(await page.locator("body").innerText()).toMatch(/Reference/);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );
});

describe.skipIf(!hasBrowser && !process.env.CI)("a server failure is held and tried again by itself", () => {
  it(
    "fails once: the page's shape, then the screen by itself, with no tap and no failure screen",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry({ fails: 1 }), reducedMotion: true, init: FRESH });
      try {
        await page.getByTestId("signal-hold").waitFor();
        await page.getByTestId("screen").waitFor({ timeout: 5000 });
        const c = await read(page);
        expect(c.retries).toBeGreaterThanOrEqual(1);
        expect(c.resets).toBe(0);
        expect(c.finalAt).toBeNull();
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "fails every time: tried at each gap, and the final screen only after the last one",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry({ fails: Infinity }), reducedMotion: true, init: FRESH });
      try {
        await page.getByTestId("signal-hold").waitFor();
        /* From the second try the calm line, true whether the signal or the server is slow. */
        await page.getByTestId("signal-hold-note").waitFor({ timeout: 5000 });
        expect(await page.getByTestId("signal-hold-note").innerText()).toContain("Still loading. Trying again.");
        expect(await page.locator("body").innerText()).not.toMatch(/weak connection|Reference/i);
        await page.getByText(/Reference/).waitFor({ timeout: 40_000 });
        const c = await read(page);
        /* 0.8 s, 2.5 s, 6 s, 12 s: four tries, one after each gap. */
        expect(c.retries).toBe(4);
        expect(c.resets).toBe(0);
        const gaps = c.retryAt.map((t, i) => t - (i === 0 ? 0 : c.retryAt[i - 1]!));
        for (const [i, want] of [800, 2500, 6000, 12000].entries()) expect(gaps[i]!).toBeGreaterThanOrEqual(want - 50);
        expect(c.finalAt!).toBeGreaterThanOrEqual(c.retryAt[3]!);
        expect(c.finalAt!).toBeGreaterThanOrEqual(21_300 - 100);
        /* The final screen, in the calm words, with the reference kept small. */
        const text = await page.locator("body").innerText();
        expect(text).toContain("Taking longer than usual");
        expect(text).toContain("Nothing you sent or saved was undone.");
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "counts the tries against the page that failed, not the one the address bar still shows",
    async () => {
      /* A tap's soft navigation fails before the browser's address changes:
         the router is drawing /listing/abc while location still says /home.
         (Found on the local production proof, 13 November 2026: the first try
         was counted against the page the person came from, so the failing
         page got five tries instead of four.) The harness's usePathname reads
         window.__pathname, standing in for the router's own pathname. */
      const { page, close } = await mountInBrowser({
        entry: entry({ fails: Infinity }),
        reducedMotion: true,
        url: "http://vallo.test/home",
        init: `${FRESH} window.__pathname = "/listing/abc";`,
      });
      try {
        await page.getByTestId("signal-hold").waitFor();
        const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem("nf_weak_retry") ?? "null"));
        expect(stored?.path).toBe("/listing/abc");
        expect(stored?.count).toBe(1);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "a client error, with no digest, is not retried: a bug a retry cannot fix goes straight to the screen",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry({ fails: Infinity, kind: "client" }), reducedMotion: true, init: FRESH });
      try {
        await page.getByText(/Reference/).waitFor();
        expect(await page.getByTestId("signal-hold").count()).toBe(0);
        await page.waitForTimeout(2000);
        const c = await read(page);
        expect(c.retries).toBe(0);
        expect(c.resets).toBe(0);
        expect(c.fetches).toBe(1);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );
});

describe.skipIf(!hasBrowser && !process.env.CI)("the failure screen's way home is never a dead link", () => {
  it(
    "on the page it leads to, it tries the page again instead of a navigation that changes nothing",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry({ fails: Infinity, kind: "client" }), reducedMotion: true, init: FRESH, url: "http://vallo.test/home" });
      try {
        await page.getByText(/Reference/).waitFor();
        const navigations: string[] = [];
        page.on("framenavigated", (frame) => navigations.push(frame.url()));
        /* Still a real link, for a long press and a screen reader. */
        const home = page.getByRole("link", { name: "Back to home" });
        expect(await home.getAttribute("href")).toBe("/home");
        await home.click();
        await page.waitForFunction(() => (window as unknown as Counts).__retries >= 1);
        /* The lockup, the other way home on the card, does the same. */
        await page.getByRole("link", { name: "Vallo home" }).first().click();
        await page.waitForFunction(() => (window as unknown as Counts).__retries >= 2);
        const c = await read(page);
        expect(c.resets).toBe(0);
        expect(navigations).toEqual([]);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "on another page, it is a full load of home, not a soft navigation through the router that failed",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry({ fails: Infinity, kind: "client" }), reducedMotion: true, init: FRESH, url: "http://vallo.test/listing/abc" });
      try {
        await page.getByText(/Reference/).waitFor();
        const request = page.waitForRequest((r) => r.isNavigationRequest() && r.url() === "http://vallo.test/home");
        await page.getByRole("link", { name: "Back to home" }).click();
        const r = await request;
        expect(r.resourceType()).toBe("document");
        await page.waitForURL("http://vallo.test/home");
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );
});
