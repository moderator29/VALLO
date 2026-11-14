/**
 * FEEDBACK IS INSTANT (Agent FEEL, 13 November 2026). The founder: the banner
 * for a save "takes about a second to pop up". It waited for the server, and
 * the server rendered the whole page before answering. These pin the fix in a
 * real browser:
 *
 *   - the banner is on screen within 100ms of the tap while the server has
 *     NOT answered (the staged action never settles, or settles 1.5s later);
 *   - the control flips on the tap and is never disabled while a call is out;
 *   - a refusal puts the control back and says why, with Try again.
 *
 * The details pass's product stylesheet is loaded, so "visible" is the real
 * banner material at a readable opacity, not a node in the tree.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

type Page = import("playwright-core").Page;

const LISTING = "00000000-0000-4000-8000-0000000000aa";
const CSS = productCss("app/css/details.css", "app/css/grade1.css");

const HEART_ENTRY = `
  import { mount } from "@/lib/testing/browser-root";
  import { SaveButton, useSaveControl } from "@/components/app/SaveControl";
  import { ToastHost } from "@/components/ui/ToastHost";
  function Heart() {
    const save = useSaveControl("${LISTING}", false);
    return <SaveButton saved={save.saved} pending={save.pending} onToggle={save.toggle} title="A flat in Yaba" />;
  }
  mount(<><Heart /><ToastHost /></>);
`;

/**
 * Click `selector` and time, from inside the page, the moment the control's
 * `aria-pressed` flips and the moment the feedback (the quick pill for a
 * save, the top banner otherwise: `card`) is drawn at opacity 0.5 or more.
 */
async function timeTap(page: Page, selector: string, words = "", card = ".nf-quick") {
  return page.evaluate(
    ([sel, expected, cardSel]) =>
      new Promise<{ flip: number | null; mounted: number | null; visible: number | null; text: string | null }>((resolve) => {
        const control = document.querySelector(sel) as HTMLElement;
        const before = control.getAttribute("aria-pressed");
        let flip: number | null = null;
        let mounted: number | null = null;
        let visible: number | null = null;
        let text: string | null = null;
        const t0 = performance.now();
        const tick = () => {
          const at = performance.now() - t0;
          if (flip === null && control.getAttribute("aria-pressed") !== before) flip = at;
          const found = document.querySelector(`${cardSel}:not([data-leaving])`) as HTMLElement | null;
          const card = found && (found.textContent ?? "").includes(expected) ? found : null;
          if (card && mounted === null) {
            mounted = at;
            text = card.textContent;
          }
          if (card && visible === null && parseFloat(getComputedStyle(card).opacity) >= 0.5) visible = at;
          if ((flip !== null && visible !== null) || at > 3000) return resolve({ flip, mounted, visible, text });
          requestAnimationFrame(tick);
        };
        control.click();
        tick();
      }),
    [selector, words, card] as const,
  );
}

describe.skipIf(!hasBrowser && !process.env.CI)("feedback on the tap", () => {
  it("a heart flips and its quick pill is up within 100ms while the server has not answered", async () => {
    /* No staged `toggleSave`: the harness answers with a promise that never settles.
       The heart's feedback is the QUICK PILL (founder, 14 November 2026): short
       words, no Undo button, the heart itself stays as the inverse. */
    const { page, close } = await mountInBrowser({ entry: HEART_ENTRY, css: CSS });
    try {
      const t = await timeTap(page, "[data-testid=card-save]");
      expect(t.text).toContain("Saved");
      expect(t.flip).not.toBeNull();
      expect(t.flip!).toBeLessThan(100);
      expect(t.mounted!).toBeLessThan(100);
      expect(t.visible!).toBeLessThan(100);
      /* No button inside the pill, and it never takes the pointer. */
      expect(await page.locator(".nf-quick button").count()).toBe(0);
      /* Never disabled while the call is out. */
      expect(await page.locator("[data-testid=card-save]").isDisabled()).toBe(false);
      /* The state WANTED is sent, never "flip". */
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls).toEqual([["toggleSave", { listingId: LISTING, want: true }]]);
    } finally {
      await close();
    }
  });

  it("an unsave says so on the tap too, before a slow server answers", async () => {
    const { page, close } = await mountInBrowser({
      entry: HEART_ENTRY,
      css: CSS,
      actions: {
        toggleSave: `async (i) => { await new Promise((r) => setTimeout(r, 1500)); return { ok: true, data: { mode: "db", listingId: i.listingId, saved: i.want } }; }`,
      },
    });
    try {
      await timeTap(page, "[data-testid=card-save]");
      /* An unsave INSIDE the pill's life is a change of mind: the pill goes
         quietly and nothing else is said (handoff 6.1). So wait the pill out;
         an unsave after it is news again and says so. */
      await page.locator(".nf-quick").waitFor({ state: "detached" });
      await page.waitForFunction(() => (window as unknown as { __calls: unknown[] }).__calls.length === 1);
      const t = await timeTap(page, "[data-testid=card-save]", "Removed from Saved");
      expect(t.text).toContain("Removed from Saved");
      expect(t.visible!).toBeLessThan(100);
      expect(await page.locator("[data-testid=card-save]").getAttribute("aria-pressed")).toBe("false");
    } finally {
      await close();
    }
  });

  it("a refusal puts the heart back and says why, with Try again", async () => {
    const { page, close } = await mountInBrowser({
      entry: HEART_ENTRY,
      css: CSS,
      actions: {
        toggleSave: `async () => { await new Promise((r) => setTimeout(r, 300)); return { ok: false, error: "We could not update your shortlist just now. Please try again in a moment." }; }`,
      },
    });
    try {
      const heart = page.locator("[data-testid=card-save]");
      await heart.click();
      expect(await heart.getAttribute("aria-pressed")).toBe("true");
      await page.getByText("We could not update your shortlist just now.").waitFor();
      expect(await heart.getAttribute("aria-pressed")).toBe("false");
      expect(await page.getByRole("button", { name: "Try again" }).count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("a signed-out save becomes a device save and the banner's words change in place", async () => {
    const { page, close } = await mountInBrowser({
      entry: HEART_ENTRY,
      css: CSS,
      actions: {
        toggleSave: `async () => { await new Promise((r) => setTimeout(r, 200)); return { ok: false, error: "Sign in to do that." }; }`,
      },
    });
    try {
      const heart = page.locator("[data-testid=card-save]");
      const t = await timeTap(page, "[data-testid=card-save]");
      expect(t.visible!).toBeLessThan(100);
      const id = await page.evaluate(() => document.querySelector(".nf-quick")?.outerHTML.length);
      await page.getByText("Saved on this device").waitFor();
      /* Kept on: the device owns it now. */
      expect(await heart.getAttribute("aria-pressed")).toBe("true");
      /* One pill whose words changed in place, no second entrance, no error. */
      expect(await page.locator(".nf-quick").count()).toBe(1);
      expect(await page.getByRole("alert").count()).toBe(0);
      expect(id).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });

  it("a follow is said on the tap while the server has not answered", async () => {
    const { page, close } = await mountInBrowser({
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { FollowButton } from "@/components/social/profile/FollowButton";
        import { ToastHost } from "@/components/ui/ToastHost";
        mount(<><FollowButton handle="ada_o" initialFollowing={false} signedIn /><ToastHost /></>);`,
      css: CSS,
    });
    try {
      const t = await timeTap(page, "button[aria-pressed]", "", ".nf-toast");
      expect(t.text).toContain("You follow @ada_o");
      expect(t.flip!).toBeLessThan(100);
      expect(t.visible!).toBeLessThan(100);
      expect(await page.locator("button[aria-pressed]").isDisabled()).toBe(false);
    } finally {
      await close();
    }
  });
});
