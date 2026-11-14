/**
 * THE NATIVE-FEEL TOUCHES, MOUNTED FOR REAL (14 November 2026). In Chromium,
 * with the real components:
 *
 *   re-tap     a tap on the dock tab that is already open scrolls its screen
 *              to the top and does not navigate; at the top, and on another
 *              tab, the tap is left to the link
 *   pill       the "new" pill is hidden at zero, shows a count, and a tap
 *              runs the owner's refresh, goes to the top and says it arrived;
 *              scrolling to the top by hand says so too
 *   pull       a touch that starts inside `[data-no-pull]` never arms the
 *              pull to refresh; the same drag outside it does
 *   adopt      a fresh server read of the notifications adds the row the
 *              live connection never delivered
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const frame = `() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(null))))`;

describe.skipIf(!hasBrowser && !process.env.CI)("a second tap on the open tab", () => {
  const ENTRY = `
    import { mount } from "@/lib/testing/browser-root";
    import { HoldTabLink } from "@/components/app/HoldTabLink";
    mount(
      <div style={{ height: 4000 }}>
        <nav style={{ position: "fixed", bottom: 0, left: 0 }}>
          <HoldTabLink href="/home" data-testid="tab-home">Home</HoldTabLink>
          <HoldTabLink href="/search" data-testid="tab-search">Search</HoldTabLink>
        </nav>
      </div>,
    );
  `;
  /* Whether the app stopped the click is read at the document, after React
     has had it; the click is then stopped there so the page never reloads. */
  const INIT = `
    window.__pathname = "/home";
    window.__prevented = [];
    document.addEventListener("click", (event) => {
      window.__prevented.push(event.defaultPrevented);
      event.preventDefault();
    });
  `;

  it("scrolls to the top without navigating, and only when there is somewhere to go", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: "", init: INIT, reducedMotion: true });
    try {
      const read = () =>
        page.evaluate(() => ({
          y: window.scrollY,
          prevented: (window as unknown as { __prevented: boolean[] }).__prevented.slice(),
        }));
      await page.evaluate(() => window.scrollTo(0, 900));
      expect((await read()).y).toBe(900);

      /* Another tab while scrolled: the link's own business. */
      await page.locator('[data-testid="tab-search"]').click();
      expect(await read()).toEqual({ y: 900, prevented: [false] });

      /* The open tab while scrolled: to the top, and the click is stopped. */
      await page.locator('[data-testid="tab-home"]').click();
      await page.waitForFunction(() => window.scrollY === 0);
      expect((await read()).prevented).toEqual([false, true]);

      /* The open tab at the top: left alone. */
      await page.locator('[data-testid="tab-home"]').click();
      expect(await read()).toEqual({ y: 0, prevented: [false, true, false] });
    } finally {
      await close();
    }
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the new pill", () => {
  const ENTRY = `
    import { useState } from "react";
    import { mount } from "@/lib/testing/browser-root";
    import { NewPill } from "@/components/ui/NewPill";
    window.__log = [];
    function App() {
      const [count, setCount] = useState(0);
      window.__set = setCount;
      return (
        <div style={{ height: 4000 }}>
          <NewPill
            count={count}
            label={count + " new"}
            onGo={() => window.__log.push("go")}
            onTop={() => { window.__log.push("top"); setCount(0); }}
          />
        </div>
      );
    }
    mount(<App />);
  `;
  type W = { __log: string[]; __set: (n: number) => void };

  it("is hidden at zero, shows the count, and a tap refreshes, goes up and reports the top", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: "", reducedMotion: true });
    try {
      const pill = page.locator('[data-testid="new-pill"]');
      expect(await pill.getAttribute("data-hidden")).toBe("");
      expect(await pill.getAttribute("tabindex")).toBe("-1");

      await page.evaluate(() => window.scrollTo(0, 1200));
      await page.evaluate(() => (window as unknown as W).__set(2));
      await page.waitForFunction(() => !document.querySelector('[data-testid="new-pill"]')!.hasAttribute("data-hidden"));
      expect(await pill.textContent()).toBe("2 new");

      await pill.click();
      await page.waitForFunction(() => window.scrollY === 0);
      expect(await page.evaluate(() => (window as unknown as W).__log)).toEqual(["go", "top"]);
      expect(await pill.getAttribute("data-hidden")).toBe("");
    } finally {
      await close();
    }
  });

  it("says the top was reached when the reader scrolls there by hand", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: "", reducedMotion: true });
    try {
      await page.evaluate(() => window.scrollTo(0, 1200));
      await page.evaluate(() => (window as unknown as W).__set(1));
      await page.waitForFunction(() => !document.querySelector('[data-testid="new-pill"]')!.hasAttribute("data-hidden"));
      /* Still well down the page: nothing is reported. */
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.evaluate(`(${frame})()`);
      expect(await page.evaluate(() => (window as unknown as W).__log)).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 10));
      await page.waitForFunction(() => (window as unknown as W).__log.length === 1);
      expect(await page.evaluate(() => (window as unknown as W).__log)).toEqual(["top"]);
    } finally {
      await close();
    }
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("pull to refresh and a box that keeps its own drag", () => {
  const ENTRY = `
    import { mount } from "@/lib/testing/browser-root";
    import { PullToRefresh } from "@/components/ui/PullToRefresh";
    mount(
      <PullToRefresh onRefresh={() => new Promise(() => {})}>
        <div data-testid="list" style={{ height: 300 }}>rows</div>
        <div data-testid="map" data-no-pull="" style={{ height: 300 }}>map</div>
      </PullToRefresh>,
    );
  `;
  const drag = (testId: string) => `(() => {
    const target = document.querySelector('[data-testid="${testId}"]');
    const at = (y) => [new Touch({ identifier: 1, target, clientX: 100, clientY: y })];
    const fire = (type, touches) =>
      target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: touches }));
    const top = target.getBoundingClientRect().top + 20;
    fire("touchstart", at(top));
    fire("touchmove", at(top + 30));
    fire("touchmove", at(top + 90));
  })()`;

  it("arms from the list and never from inside the marked box", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: "", touch: true });
    try {
      const pulling = () => page.evaluate(() => document.querySelector(".nf-ptr")!.hasAttribute("data-pulling"));
      await page.evaluate(drag("map"));
      await page.evaluate(`(${frame})()`);
      expect(await pulling()).toBe(false);
      await page.evaluate(drag("list"));
      await page.waitForFunction(() => document.querySelector(".nf-ptr")!.hasAttribute("data-pulling"));
    } finally {
      await close();
    }
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the notifications after a fresh server read", () => {
  const ENTRY = `
    import { useState } from "react";
    import { getDictionary } from "@vallo/i18n";
    import { LiveNotifications } from "@/app/(app)/notifications/LiveNotifications";
    import { PERSON } from "@/app/(dev)/preview/_fixtures/people";
    import { NOTIFICATIONS } from "@/app/(dev)/preview/f4/fixtures";
    import { mount } from "@/lib/testing/browser-root";
    function App() {
      const [rows, setRows] = useState(NOTIFICATIONS.slice(1));
      window.__fresh = () => setRows([...NOTIFICATIONS]);
      window.__same = () => setRows(NOTIFICATIONS.slice(1));
      return (
        <LiveNotifications
          initial={rows}
          userId={PERSON.id}
          now={Date.parse("2026-09-19T12:00:00.000Z")}
          copy={getDictionary("en").experienceInbox.notifications}
          locale="en"
        />
      );
    }
    mount(<App />);
  `;
  type W = { __fresh: () => void; __same: () => void };

  it("adds the row the list never had, and nothing when the read holds nothing new", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: "" });
    try {
      await page.locator('[data-testid="notification-row"]').first().waitFor();
      const text = () => page.evaluate(() => document.body.textContent ?? "");
      const rows = () => page.locator('[data-testid="notification-row"]').count();
      expect(await text()).not.toContain("Grand Vista Hotel");
      const before = await rows();

      await page.evaluate(() => (window as unknown as W).__same());
      await page.evaluate(`(${frame})()`);
      expect(await rows()).toBe(before);

      await page.evaluate(() => (window as unknown as W).__fresh());
      await page.waitForFunction(() => (document.body.textContent ?? "").includes("Grand Vista Hotel"));
      expect(await rows()).toBeGreaterThan(before);
      /* The pill is for rows that arrive live while the reader is down the list; a read is not that. */
      expect(await page.locator('[data-testid="notifications-new-pill"]').getAttribute("data-hidden")).toBe("");
    } finally {
      await close();
    }
  });
});
