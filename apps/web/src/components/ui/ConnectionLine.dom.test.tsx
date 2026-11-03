/**
 * THE OFFLINE LINE, NOT THE OFFLINE WALL (8 October 2026). The founder saw a
 * full-screen "No connection" card on TestFlight where the page he had just
 * been on should have been. A page this phone kept now opens with no signal
 * (`public/sw.js`), and what a person is told is one small line at the top of
 * that page: never a block over it, never focus taken, never an alert.
 *
 * In a real Chromium: the line appears when the browser goes offline and
 * says what is on screen; a document the worker answered from the phone says
 * so while the phone reports signal; and when the connection returns the page
 * refreshes itself in place and the line says so, then leaves.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const copy = getDictionary("en").details.connection;
const CSS = productCss("app/css/details.css");

const entry = `
  import { mount } from "@/lib/testing/browser-root";
  import { ConnectionLine } from "@/components/ui/ConnectionLine";
  mount(<main><h1>The page you were on</h1><button>Still works</button><ConnectionLine /></main>);
`;

/* The worker's Server-Timing mark on a page it answered from the phone. */
const KEPT_DOCUMENT = `
  const original = performance.getEntriesByType.bind(performance);
  performance.getEntriesByType = (type) =>
    type === "navigation" ? [{ serverTiming: [{ name: "vallo-kept", description: "kept", duration: 0 }] }] : original(type);
`;

/* The mark on a page the worker answered AT ONCE (13 October 2026). */
const INSTANT_DOCUMENT = `
  const original = performance.getEntriesByType.bind(performance);
  performance.getEntriesByType = (type) =>
    type === "navigation" ? [{ serverTiming: [{ name: "vallo-kept", description: "instant", duration: 0 }] }] : original(type);
`;

/* The mark on a page answered at once on Save-Data or 2G (2 November 2026). */
const INSTANT_LIGHT_DOCUMENT = `
  const original = performance.getEntriesByType.bind(performance);
  performance.getEntriesByType = (type) =>
    type === "navigation" ? [{ serverTiming: [{ name: "vallo-kept", description: "instant-light", duration: 0 }] }] : original(type);
`;

const OFFLINE_FROM_THE_START = `Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false });`;

const refreshCalls = (page: import("playwright-core").Page) =>
  page.evaluate(() => ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).filter(([name]) => name === "refresh").length);

const behindTheLock = `
  import { mount } from "@/lib/testing/browser-root";
  import { ConnectionLine } from "@/components/ui/ConnectionLine";
  mount(<main><div className="contents" data-passcode-guarded="" inert><h1>Behind the lock</h1></div><ConnectionLine /></main>);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the connection line", () => {
  it("says nothing while the page came from the network and the phone is online", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      expect(await page.getByTestId("connection-line").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("going offline draws a small status line over the page, not a wall in front of it", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.context().setOffline(true);
      const line = page.getByTestId("connection-line");
      await line.waitFor();
      expect(await line.textContent()).toContain(copy.offline);
      expect(await line.getAttribute("role")).toBe("status");
      /* The page is still the page: its heading is visible, its button still
         takes a click, and the line takes no pointer events. */
      expect(await page.getByRole("heading", { name: "The page you were on" }).isVisible()).toBe(true);
      expect(await line.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
      const box = await line.locator(".nf-connection__pill").boundingBox();
      expect(box!.height).toBeLessThan(60);
      await page.getByRole("button", { name: "Still works" }).click({ timeout: 2_000 });
    } finally {
      await close();
    }
  });

  it("a page the worker answered from the phone says so, then refreshes itself when the signal returns", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, init: KEPT_DOCUMENT });
    try {
      const line = page.getByTestId("connection-line");
      await line.waitFor();
      expect(await line.getAttribute("data-state")).toBe("kept");
      expect(await line.textContent()).toContain(copy.kept);

      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page.waitForFunction(() => document.querySelector("[data-testid=connection-line]")?.getAttribute("data-state") === "back");
      expect(await line.textContent()).toContain(copy.back);
      const calls = await page.evaluate(() => (window as unknown as { __router: { calls: unknown[][] } }).__router.calls);
      expect(calls.filter(([name]) => name === "refresh")).toHaveLength(1);
    } finally {
      await close();
    }
  });

  it("a page answered at once from the phone says nothing and refreshes itself in place straight away", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, init: INSTANT_DOCUMENT });
    try {
      await page.waitForFunction(
        () => ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).some(([name]) => name === "refresh"),
      );
      expect(await refreshCalls(page)).toBe(1);
      expect(await page.getByTestId("connection-line").count()).toBe(0);
      /* The worker's word that its own copy is fresh does not refresh twice. */
      await page.evaluate(() => navigator.serviceWorker?.dispatchEvent?.(new MessageEvent("message", { data: { type: "vallo:page-fresh", path: location.pathname } })));
      expect(await refreshCalls(page)).toBe(1);
    } finally {
      await close();
    }
  });

  it("on Save-Data or 2G, a page answered at once waits for the network's copy and refreshes once, quietly", async () => {
    /* The test page has no worker; a stand-in channel carries the worker's word. */
    const { page, close } = await mountInBrowser({
      entry,
      css: CSS,
      init: INSTANT_LIGHT_DOCUMENT + `Object.defineProperty(navigator, "serviceWorker", { value: new EventTarget(), configurable: true });`,
    });
    try {
      await page.waitForTimeout(400);
      expect(await refreshCalls(page)).toBe(0);
      expect(await page.getByTestId("connection-line").count()).toBe(0);
      await page.evaluate(() => navigator.serviceWorker?.dispatchEvent?.(new MessageEvent("message", { data: { type: "vallo:page-fresh", path: location.pathname } })));
      await page.waitForFunction(
        () => ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).some(([name]) => name === "refresh"),
      );
      expect(await refreshCalls(page)).toBe(1);
    } finally {
      await close();
    }
  });

  it("a page answered at once with no signal says it is offline, and refreshes when the signal returns", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, init: INSTANT_DOCUMENT + OFFLINE_FROM_THE_START });
    try {
      const line = page.getByTestId("connection-line");
      await line.waitFor();
      expect(await line.getAttribute("data-state")).toBe("offline");
      expect(await refreshCalls(page)).toBe(0);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page.waitForFunction(() => document.querySelector("[data-testid=connection-line]")?.getAttribute("data-state") === "back");
      expect(await refreshCalls(page)).toBe(1);
    } finally {
      await close();
    }
  });

  it("behind the passcode lock, a page answered at once leaves the refresh to the unlock", async () => {
    const { page, close } = await mountInBrowser({ entry: behindTheLock, css: CSS, init: INSTANT_DOCUMENT });
    try {
      await page.waitForTimeout(300);
      expect(await refreshCalls(page)).toBe(0);
      expect(await page.getByTestId("connection-line").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("a guard about to lock (a tab never unlocked) also leaves the refresh to the unlock; an unlocked tab refreshes", async () => {
    const guardedOpen = `
      import { mount } from "@/lib/testing/browser-root";
      import { ConnectionLine } from "@/components/ui/ConnectionLine";
      mount(<main><div className="contents" data-passcode-guarded=""><h1>Guarded</h1></div><ConnectionLine /></main>);
    `;
    const fresh = await mountInBrowser({ entry: guardedOpen, css: CSS, init: INSTANT_DOCUMENT });
    try {
      await fresh.page.waitForTimeout(300);
      expect(await refreshCalls(fresh.page)).toBe(0);
    } finally {
      await fresh.close();
    }
    const unlocked = await mountInBrowser({
      entry: guardedOpen,
      css: CSS,
      init: INSTANT_DOCUMENT + `sessionStorage.setItem("vallo.passcode.tab", "1");`,
    });
    try {
      await unlocked.page.waitForFunction(
        () => ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).some(([name]) => name === "refresh"),
      );
      expect(await refreshCalls(unlocked.page)).toBe(1);
    } finally {
      await unlocked.close();
    }
  });

  it("the words are short, plain and free of em dashes", () => {
    for (const line of [copy.offline, copy.kept, copy.back]) {
      expect(line.length).toBeLessThan(60);
      expect(line).not.toMatch(/—/);
    }
  });
});
