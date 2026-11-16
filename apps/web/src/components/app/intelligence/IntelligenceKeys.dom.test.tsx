/**
 * VALLO INTELLIGENCE, AS A PHONE TYPES INTO IT AND BACKS OUT OF IT (the
 * founder, 16 November 2026: "there is no go back button in all pages areas
 * etc in the VALLO intelligence and there is a lot of bugs keyboard bugs
 * texting bugs"). Mounted for real in Chromium, the engine stubbed at
 * `fetch` (fixtures only). Each case is a bug that was reproduced on the
 * screen before it was fixed:
 *
 *   - typing fast, Backspace, select-all and delete, and a paste never drop
 *     or reorder a character, and the caret stays where it was put;
 *   - an input method's composition never submits, including Safari's
 *     committing Enter (key 229 just after `compositionend`);
 *   - a list that opens under a resting pointer (or the finger that tapped
 *     the field) never decides what Enter takes: Enter searched "Lekki Phase
 *     2" for a person who typed "lekki";
 *   - the clear keeps the caret, and the list opens again on the next word
 *     (a stale blur timer had shut it for good);
 *   - a tapped suggestion is taken, on a touch screen;
 *   - the list hangs over the page (nothing under it jumps) and is never
 *     taller than the screen, scrolling inside itself;
 *   - Cmd/Ctrl+K never pulls the caret out from behind an open sheet;
 *   - every state has the app's back control and it walks the same steps as
 *     the browser's Back: the suggestions close first, a category returns
 *     home, results return to where they came from, a link straight to a
 *     search lands on the home, and the filters' Apply costs one Back;
 *   - amounts in the filters read "1,500,000" as they are typed, with the
 *     caret kept in place.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/chips.css", "components/social/find/people-v2.css", "components/app/intelligence/intelligence.css");

const ENTRY = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { AuthGateProvider } from "@/components/auth/AuthGate";
  import { parseIntelUrl } from "@/lib/intelligence/client";
  import { IntelligenceScreen } from "@/components/app/intelligence/IntelligenceScreen";
  const copy = getDictionary("en").intelligence;
  mount(
    <AuthGateProvider signedIn={true}>
      <IntelligenceScreen copy={copy} locale="en" signedIn={true} initial={parseIntelUrl(new URLSearchParams(window.location.search))} />
    </AuthGateProvider>,
  );
`;

/* Every word typed gets eight suggestions; a search answers with two fixture flats. */
const STUB = `
  window.__searches = [];
  const json = (body, delay = 0) => new Promise((resolve) => setTimeout(() => resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })), delay));
  window.fetch = async (input) => {
    const url = new URL(String(input), location.origin);
    if (url.pathname === "/api/intelligence/discover") {
      return json({ popular: [], recent: [], fresh: [], people: [], examples: [], trending: [], forYou: [],
        categories: [{ tab: "property", live: 0, newThisWeek: 0, areas: [], latest: [] }, { tab: "stay", live: 0, newThisWeek: 0, areas: [], latest: [] }, { tab: "restaurant", live: 0, newThisWeek: 0, areas: [], latest: [] }] });
    }
    if (url.pathname === "/api/intelligence/suggest") {
      const q = url.searchParams.get("q");
      return json({ q, suggestions: [
        { key: "q:1", kind: "query", label: q + " 2 bedroom", query: q + " 2 bedroom" },
        { key: "q:2", kind: "query", label: q + " shortlet", query: q + " shortlet" },
        { key: "p:1", kind: "place", label: "Lekki Phase 1, Lagos", hint: "Location", query: "Lekki Phase 1" },
        { key: "p:2", kind: "place", label: "Lekki Phase 2, Lagos", hint: "Location", query: "Lekki Phase 2" },
        { key: "p:3", kind: "place", label: "Lekki, Lagos", hint: "Location", query: "Lekki" },
        { key: "u:1", kind: "person", label: "Test Agent One", hint: "Agent", href: "/u/test-agent-one" },
        { key: "s:1", kind: "screen", label: "Saved searches", hint: "Screen", href: "/saved" },
        { key: "s:2", kind: "screen", label: "Messages", hint: "Screen", href: "/messages" },
      ] }, 5);
    }
    if (url.pathname === "/api/intelligence/search") {
      window.__searches.push(url.searchParams.get("q"));
      return json({
        q: url.searchParams.get("q"),
        understood: { raw: url.searchParams.get("q"), via: "rules", kind: "property", maxPrice: 5000000 },
        tab: url.searchParams.get("tab") || "all",
        tabs: [{ tab: "all" }, { tab: "property", count: 2 }],
        results: [
          { key: "property:1", kind: "property", title: "Fixture flat one", href: "/listing/fixture-1", place: "Lekki, Lagos" },
          { key: "property:2", kind: "property", title: "Fixture flat two", href: "/listing/fixture-2", place: "Lekki, Lagos" },
        ],
        tookMs: 3,
      });
    }
    return new Response(null, { status: 204 });
  };
`;

function mounted(opts: { url?: string; touch?: boolean; viewport?: { width: number; height: number }; reducedMotion?: boolean } = {}) {
  return mountInBrowser({
    entry: ENTRY,
    css: CSS,
    init: STUB,
    url: opts.url ?? "http://vallo.test/intelligence",
    touch: opts.touch,
    viewport: opts.viewport,
    reducedMotion: opts.reducedMotion,
  });
}

const field = (page: Page) => page.getByTestId("intel-input");
const q = (page: Page) => new URL(page.url()).searchParams.get("q");
const listOpen = (page: Page) => page.evaluate(() => !document.querySelector<HTMLElement>("[data-testid='intel-suggest']")!.hidden);
const screenState = (page: Page) => page.getByTestId("intel-screen").getAttribute("data-state");
const until = (page: Page, fn: string) => page.waitForFunction(fn, null, { timeout: 5000 });

describe.skipIf(!hasBrowser && !process.env.CI)("VALLO Intelligence, typing and the way back", () => {
  it("typing fast, Backspace, select-all and paste never drop a character or move the caret", async () => {
    const { page, close } = await mounted({ touch: true });
    try {
      const input = field(page);
      await input.focus();
      const words = "2 bedroom flat in Lekki under 5m with parking";
      await page.keyboard.type(words, { delay: 0 });
      /* While the suggestions arrive and redraw, nothing typed is lost. */
      await page.getByTestId("intel-option").first().waitFor();
      expect(await input.inputValue()).toBe(words);
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");
      expect(await input.inputValue()).toBe(words.slice(0, -2));
      /* Typed in the middle: the caret stays after what was typed. */
      await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(2, 2));
      await page.keyboard.type("big ", { delay: 15 });
      await page.waitForTimeout(250);
      expect(await input.inputValue()).toBe(`2 big ${words.slice(2, -2)}`);
      expect(await input.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(6);
      /* Select all and delete empties it; a paste lands whole. */
      await input.evaluate((el: HTMLInputElement) => el.select());
      await page.keyboard.press("Backspace");
      expect(await input.inputValue()).toBe("");
      await page.keyboard.insertText("shortlet in Yaba this weekend");
      expect(await input.inputValue()).toBe("shortlet in Yaba this weekend");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe("intel-input");
    } finally {
      await close();
    }
  });

  it("an input method's composition never submits, Safari's committing Enter included", async () => {
    const { page, close } = await mounted();
    try {
      const result = await field(page).evaluate((el: HTMLInputElement) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        const enter = (keyCode: number, isComposing: boolean) => {
          const event = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode, bubbles: true, cancelable: true, isComposing });
          el.dispatchEvent(event);
          /* A trusted Enter's default is the form's submission: run it when nothing stopped it. */
          if (!event.defaultPrevented) el.form!.requestSubmit();
          return event.defaultPrevented;
        };
        el.focus();
        el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "" }));
        for (const text of ["l", "le", "lek"]) {
          el.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: text }));
          set.call(el, text);
          el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertCompositionText", isComposing: true }));
        }
        const midway = enter(229, true);
        el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "lek" }));
        /* Safari: the Enter that commits the word comes after compositionend, as key 229. */
        const safari = enter(229, false);
        return { midway, safari, value: el.value, search: location.search };
      });
      expect(result).toEqual({ midway: true, safari: true, value: "lek", search: "" });
      expect(await screenState(page)).toBe("empty");
      /* A plain Enter afterwards is a search. */
      await page.waitForTimeout(200);
      await field(page).press("Enter");
      await page.getByTestId("intel-results").waitFor();
      expect(q(page)).toBe("lek");
    } finally {
      await close();
    }
  });

  it("a list that opens under a resting pointer never decides what Enter searches", async () => {
    const { page, close } = await mounted();
    try {
      const box = (await field(page).boundingBox())!;
      /* The pointer rests where the list is about to draw, as a mouse or a tapping finger does. */
      await page.mouse.click(box.x + 40, box.y + box.height / 2);
      await page.mouse.move(box.x + 40, box.y + box.height + 120);
      await page.keyboard.type("lekki", { delay: 20 });
      await page.getByTestId("intel-option").first().waitFor();
      await page.waitForTimeout(200);
      expect(await field(page).getAttribute("aria-activedescendant")).toBeNull();
      await page.keyboard.press("Enter");
      await page.getByTestId("intel-results").waitFor();
      expect(q(page)).toBe("lekki");
    } finally {
      await close();
    }
  });

  it("the clear keeps the caret, and the list opens again for the next words", async () => {
    const { page, close } = await mounted();
    try {
      await field(page).click();
      await page.keyboard.type("lekki", { delay: 10 });
      await page.getByTestId("intel-option").first().waitFor();
      await page.getByTestId("intel-clear").click();
      expect(await field(page).inputValue()).toBe("");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe("intel-input");
      await page.waitForTimeout(250);
      await page.keyboard.type("yaba", { delay: 10 });
      await until(page, "!document.querySelector(\"[data-testid='intel-suggest']\").hidden");
      expect(await listOpen(page)).toBe(true);
    } finally {
      await close();
    }
  });

  it("a tapped suggestion is taken on a touch screen, and the keyboard goes", async () => {
    const { page, close } = await mounted({ touch: true });
    try {
      await field(page).tap();
      await page.keyboard.type("yaba", { delay: 10 });
      await page.getByTestId("intel-option").first().waitFor();
      await page.getByTestId("intel-option").nth(1).tap();
      await page.getByTestId("intel-results").waitFor();
      expect(q(page)).toBe("yaba shortlet");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? null)).toBeNull();
    } finally {
      await close();
    }
  });

  it("the list hangs over the page, nothing under it moves, and it is never taller than the screen", async () => {
    /* Still, so the page's one-shot entrance is not mistaken for a jump. */
    const { page, close } = await mounted({ viewport: { width: 360, height: 480 }, reducedMotion: true });
    try {
      /* Where the page under the field sits in the document (scrolling aside). */
      const below = () => page.getByTestId("intel-discover").evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
      const before = await below();
      await field(page).click();
      await page.keyboard.type("lekki", { delay: 10 });
      await page.getByTestId("intel-option").first().waitFor();
      expect(await below()).toBe(before);
      const fit = await page.getByTestId("intel-suggest").evaluate((el) => {
        const box = el.getBoundingClientRect();
        el.scrollTop = el.scrollHeight;
        const last = [...el.querySelectorAll("[role='option']")].pop()!.getBoundingClientRect();
        return { bottom: box.bottom, inner: window.innerHeight, scrolls: el.scrollHeight > el.clientHeight, lastShown: last.bottom <= box.bottom + 1 };
      });
      expect(fit.bottom).toBeLessThanOrEqual(fit.inner);
      expect(fit.scrolls).toBe(true);
      expect(fit.lastShown).toBe(true);
    } finally {
      await close();
    }
  });

  it("every state has the back control, and it walks the same steps as the browser's Back", async () => {
    const { page, close } = await mounted({ touch: true });
    try {
      const back = page.getByTestId("intel-back");
      /* The home: the platform's own way back, named for where it goes. */
      expect(await back.getAttribute("aria-label")).toMatch(/^Back/);
      expect(await back.getAttribute("data-back-destination")).toBeTruthy();

      /* Typing: the back closes the suggestions first and keeps the words. */
      await field(page).tap();
      await page.keyboard.type("lekki", { delay: 10 });
      await page.getByTestId("intel-option").first().waitFor();
      expect(await back.getAttribute("aria-label")).toBe("Close the suggestions");
      await back.tap();
      await until(page, "document.querySelector(\"[data-testid='intel-suggest']\").hidden");
      expect(await field(page).inputValue()).toBe("lekki");
      expect(await screenState(page)).toBe("empty");

      /* The browser's Back does the same with the list open. */
      await field(page).tap();
      await page.keyboard.type(" flat", { delay: 10 });
      await until(page, "!document.querySelector(\"[data-testid='intel-suggest']\").hidden");
      await page.goBack();
      await until(page, "document.querySelector(\"[data-testid='intel-suggest']\").hidden");
      expect(await field(page).inputValue()).toBe("lekki flat");
      expect(await screenState(page)).toBe("empty");

      /* A category, then its results, then back twice: the category, then the home. */
      await page.getByTestId("intel-cat-property").tap();
      await page.getByTestId("intel-cathead").waitFor();
      expect(await back.getAttribute("aria-label")).toBe("Back to everything on Vallo");
      await page.getByTestId("intel-beds-2").tap();
      await page.getByTestId("intel-property-show").tap();
      await page.getByTestId("intel-results").waitFor();
      expect(await back.getAttribute("aria-label")).toBe("Back to Properties");
      await back.tap();
      await page.getByTestId("intel-cathead").waitFor();
      /* What was picked is still picked. */
      expect(await page.getByTestId("intel-beds-2").getAttribute("aria-pressed")).toBe("true");
      await page.goBack();
      await page.getByTestId("intel-explore").waitFor();
      expect(page.url()).toBe("http://vallo.test/intelligence");

      /* A search, a refinement, and back: one step each, no dead press. */
      await field(page).tap();
      await page.keyboard.type("lekki flat", { delay: 10 });
      await page.keyboard.press("Enter");
      await page.getByTestId("intel-results").waitFor();
      expect(q(page)).toBe("lekki flat");
      expect(await back.getAttribute("aria-label")).toBe("Back to VALLO Intelligence");
      await page.getByTestId("intel-chip-price").tap();
      await until(page, "new URL(location.href).searchParams.get('drop') === 'maxPrice'");
      expect(await back.getAttribute("aria-label")).toBe("Back to your last search");
      await back.tap();
      await until(page, "!new URL(location.href).searchParams.get('drop')");
      expect(q(page)).toBe("lekki flat");
      await back.tap();
      await page.getByTestId("intel-explore").waitFor();
      expect(await field(page).inputValue()).toBe("");
    } finally {
      await close();
    }
  });

  it("a link straight to a search lands on the home on Back, and the filters' Apply costs one Back", async () => {
    const { page, close } = await mounted({ url: "http://vallo.test/intelligence?q=lekki&tab=property", touch: true });
    try {
      await page.getByTestId("intel-results").waitFor();
      await page.getByTestId("intel-edit-filters").first().tap();
      await page.getByTestId("intel-filters").waitFor();
      /* Amounts read grouped as they are typed; the caret stays in place. */
      const min = page.locator("input[name='min']");
      await min.tap();
      await page.keyboard.type("1500000", { delay: 10 });
      expect(await min.inputValue()).toBe("1,500,000");
      await min.evaluate((el: HTMLInputElement) => el.setSelectionRange(1, 1));
      await page.keyboard.type("2", { delay: 10 });
      expect(await min.inputValue()).toBe("12,500,000");
      expect(await min.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(2);
      /* Backspace over a separator takes the digit before it. */
      await min.evaluate((el: HTMLInputElement) => el.setSelectionRange(3, 3));
      await page.keyboard.press("Backspace");
      expect(await min.inputValue()).toBe("1,500,000");
      /* Cmd/Ctrl+K inside the sheet leaves the caret in the sheet. */
      await page.keyboard.press("Control+k");
      expect(await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name)).toBe("min");
      /* Lowest over highest (5,000,000 understood) changes places on Apply. */
      const max = page.locator("input[name='max']");
      await max.fill("");
      await max.type("900000");
      await page.getByRole("button", { name: "Show results" }).tap();
      await until(page, "new URL(location.href).searchParams.get('max') === '1500000'");
      expect(new URL(page.url()).searchParams.get("min")).toBe("900000");
      /* One Back: the search as it was. */
      await page.goBack();
      await until(page, "!new URL(location.href).searchParams.get('max')");
      expect(q(page)).toBe("lekki");
      await page.getByTestId("intel-results").waitFor();
      /* The next: this screen's home, not out of it. */
      await page.getByTestId("intel-back").tap();
      await page.getByTestId("intel-explore").waitFor();
      expect(page.url()).toBe("http://vallo.test/intelligence");
    } finally {
      await close();
    }
  });
});
