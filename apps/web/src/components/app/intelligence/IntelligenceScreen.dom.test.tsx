/**
 * VALLO INTELLIGENCE, THE SCREEN, mounted for real in Chromium with the
 * engine's routes stubbed at `fetch` (fixtures only: no real person, no real
 * listing). Held here:
 *
 *   - the suggestions are a keyboard combobox: Down and Up walk them (and
 *     wrap), Enter takes the active one, Escape closes the list and a second
 *     Escape clears the words, a pointer sets the active option;
 *   - a suggestions answer that arrives late never replaces a newer one;
 *   - removing a "Search understood" chip, or Clear, is a new address that
 *     keeps the words and drops the filter, and the engine is asked again;
 *   - People to follow: the viewer's own row says "You" and offers no Follow,
 *     a person the engine offers to follow has the app's own Follow, and the
 *     Follow stays inside its row;
 *   - the field names its keyboard (search) and is 16px or more, and the
 *     screen's own controls are 44px targets on a phone;
 *   - the caret goes to the field only when a launcher asked for it.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/chips.css", "components/social/find/people-v2.css", "components/app/intelligence/intelligence.css");

function entry({ signedIn = true, focus = false }: { signedIn?: boolean; focus?: boolean } = {}): string {
  return `
    import { getDictionary } from "@vallo/i18n";
    import { mount } from "@/lib/testing/browser-root";
    import { AuthGateProvider } from "@/components/auth/AuthGate";
    import { parseIntelUrl } from "@/lib/intelligence/client";
    import { IntelligenceScreen } from "@/components/app/intelligence/IntelligenceScreen";
    const copy = getDictionary("en").intelligence;
    mount(
      <AuthGateProvider signedIn={${signedIn}}>
        <IntelligenceScreen
          copy={copy}
          locale="en"
          signedIn={${signedIn}}
          initial={parseIntelUrl(new URLSearchParams(window.location.search))}
          focusOnOpen={${focus}}
        />
      </AuthGateProvider>,
    );
  `;
}

/**
 * The engine, stubbed. `window.__fetches` records every call; the suggest
 * answer for "lek" is slow on purpose (the stale-response test), the rest
 * answer at once.
 */
const STUB = `
  window.__fetches = [];
  const json = (body, delay = 0) => new Promise((resolve) => setTimeout(() => resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })), delay));
  const PEOPLE = [
    { key: "person:a1", kind: "person", title: "Test Agent One", href: "/u/test-agent-one", person: { handle: "test-agent-one", role: "agent", following: false }, actions: [{ id: "follow", label: "Follow" }], count: { value: 12, noun: "followers" } },
    { key: "person:me", kind: "person", title: "Test Viewer", href: "/u/test-viewer", person: { handle: "test-viewer", isYou: true }, actions: [{ id: "follow", label: "Follow" }] },
    { key: "person:l1", kind: "person", title: "A Landlord With A Very Long Name That Does Not Wrap Anywhere", href: "/u/test-landlord", person: { role: "landlord" }, actions: [{ id: "view-profile", label: "View profile", href: "/u/test-landlord" }] },
  ];
  window.fetch = async (input, init) => {
    const url = new URL(String(input), location.origin);
    window.__fetches.push({ path: url.pathname, search: url.search, method: (init && init.method) || "GET" });
    if (url.pathname === "/api/intelligence/discover") {
      return json({ popular: [], recent: [{ query: "2 bed in yaba", at: "2026-11-15T10:00:00Z" }], fresh: [], people: PEOPLE, examples: [] });
    }
    if (url.pathname === "/api/intelligence/suggest") {
      const q = url.searchParams.get("q");
      if (q === "lek") return json({ q, suggestions: [{ key: "q:stale", kind: "query", label: "Stale answer", query: "stale answer" }] }, 700);
      if (q === "lekki") {
        return json({ q, suggestions: [
          { key: "q:1", kind: "query", label: "lekki 2 bedroom", query: "lekki 2 bedroom" },
          { key: "p:1", kind: "place", label: "Lekki Phase 1, Lagos", hint: "Location", query: "Lekki Phase 1" },
          { key: "s:1", kind: "screen", label: "Saved searches", hint: "Screen", href: "/saved" },
        ] }, 10);
      }
      return json({ q, suggestions: [] });
    }
    if (url.pathname === "/api/intelligence/search") {
      const drop = (url.searchParams.get("drop") || "").split(",").filter(Boolean);
      const understood = { raw: url.searchParams.get("q"), via: "rules", kind: "property", bedrooms: 2, place: "Lekki, Lagos", maxPrice: 5000000 };
      for (const key of drop) delete understood[key];
      return json({
        q: url.searchParams.get("q"),
        understood,
        tab: url.searchParams.get("tab") || "all",
        tabs: [{ tab: "all" }, { tab: "property", count: 2 }, { tab: "person", count: 1 }],
        results: [
          { key: "property:1", kind: "property", title: "Fixture flat one", href: "/listing/fixture-1", place: "Lekki, Lagos", subtitle: "Example listing. Not available.", bedrooms: 2, price: { amount: 4500000, per: "year" }, actions: [{ id: "open", label: "Open", href: "/listing/fixture-1" }] },
          { key: "property:2", kind: "property", title: "Fixture flat two", href: "/listing/fixture-2", place: "Lekki, Lagos" },
        ],
        tookMs: 12,
      });
    }
    if (url.pathname === "/api/intelligence/event") return new Response(null, { status: 204 });
    if (url.pathname === "/api/intelligence/recent") return new Response(null, { status: window.__recentFails ? 500 : 204 });
    return new Response("", { status: 404 });
  };
`;

async function mounted(opts: { url?: string; signedIn?: boolean; focus?: boolean; touch?: boolean } = {}) {
  return mountInBrowser({
    entry: entry({ signedIn: opts.signedIn ?? true, focus: opts.focus ?? false }),
    css: CSS,
    init: STUB,
    url: opts.url ?? "http://vallo.test/intelligence",
    touch: opts.touch,
  });
}

describe.skipIf(!hasBrowser && !process.env.CI)("VALLO Intelligence", () => {
  it("walks the suggestions with the keyboard and the pointer, takes one with Enter, and closes with Escape", async () => {
    const { page, close } = await mounted();
    try {
      const field = page.getByTestId("intel-input");
      await field.fill("lekki");
      await page.getByTestId("intel-option").first().waitFor();
      const state = () =>
        page.evaluate(() => {
          const input = document.querySelector<HTMLInputElement>("[data-testid='intel-input']")!;
          const options = [...document.querySelectorAll("[data-testid='intel-option']")];
          return {
            expanded: input.getAttribute("aria-expanded"),
            active: input.getAttribute("aria-activedescendant"),
            selected: options.map((o) => o.getAttribute("aria-selected")),
            ids: options.map((o) => o.id),
            labels: options.map((o) => o.querySelector(".nf-intel-option__label")?.textContent),
            groups: [...document.querySelectorAll("[data-testid='intel-suggest'] [role='group'] > .nf-intel-overline")].map((g) => g.textContent),
          };
        });
      let s = await state();
      expect(s.expanded).toBe("true");
      expect(s.labels).toEqual(["lekki 2 bedroom", "Lekki Phase 1, Lagos", "Saved searches"]);
      expect(s.groups).toEqual(["Searches", "Places", "Go to"]);
      expect(s.active).toBeNull();

      await field.press("ArrowDown");
      s = await state();
      expect(s.active).toBe(s.ids[0]);
      expect(s.selected).toEqual(["true", "false", "false"]);
      await field.press("ArrowDown");
      await field.press("ArrowDown");
      s = await state();
      expect(s.active).toBe(s.ids[2]);
      /* Down from the last wraps to the first; Up from the first to the last. */
      await field.press("ArrowDown");
      expect((await state()).active).toBe(s.ids[0]);
      await field.press("ArrowUp");
      expect((await state()).active).toBe(s.ids[2]);

      /* A pointer moves the active option too. */
      await page.getByTestId("intel-option").nth(1).hover();
      expect((await state()).selected).toEqual(["false", "true", "false"]);

      /* Escape closes the list and keeps the words; a second Escape clears them. */
      await field.press("Escape");
      expect((await state()).expanded).toBe("false");
      expect(await field.inputValue()).toBe("lekki");
      await field.press("Escape");
      expect(await field.inputValue()).toBe("");

      /* Enter on a "Go to" suggestion opens its screen. */
      await page.mouse.move(0, 0);
      await field.fill("lekki");
      await page.getByTestId("intel-option").first().waitFor();
      await field.press("ArrowUp");
      await field.press("Enter");
      expect(await page.evaluate(() => (window as unknown as { __router: { calls: unknown[][] } }).__router.calls)).toEqual([["push", "/saved"]]);

      /* Enter on an active query suggestion runs it as a search. */
      await field.fill("lekki 2");
      await field.fill("lekki");
      await page.getByTestId("intel-option").first().waitFor();
      await field.press("ArrowDown");
      await field.press("Enter");
      await page.waitForFunction(() => new URLSearchParams(location.search).get("q") === "lekki 2 bedroom");
      await page.waitForFunction(() =>
        (window as unknown as { __fetches: { path: string; search: string }[] }).__fetches.some(
          (f) =>
            f.path === "/api/intelligence/search" &&
            new URLSearchParams(f.search).get("q") === "lekki 2 bedroom" &&
            /* A submitted search says so to the engine, never in the address. */
            new URLSearchParams(f.search).get("submit") === "1",
        ),
      );
      expect(await field.inputValue()).toBe("lekki 2 bedroom");
      expect(await page.evaluate(() => location.search)).not.toContain("submit");
    } finally {
      await close();
    }
  });

  it("never lets a late suggestions answer replace a newer one", async () => {
    const { page, close } = await mounted();
    try {
      const field = page.getByTestId("intel-input");
      await field.fill("lek");
      /* Past the debounce, so the slow "lek" request is really sent. */
      await page.waitForFunction(() =>
        (window as unknown as { __fetches: { path: string; search: string }[] }).__fetches.some((f) => f.path === "/api/intelligence/suggest" && f.search === "?q=lek"),
      );
      await field.fill("lekki");
      await page.getByTestId("intel-option").first().waitFor();
      /* Wait out the slow answer (700ms) and then some. */
      await page.waitForTimeout(1000);
      const labels = await page.$$eval("[data-testid='intel-option'] .nf-intel-option__label", (els) => els.map((e) => e.textContent));
      expect(labels).toEqual(["lekki 2 bedroom", "Lekki Phase 1, Lagos", "Saved searches"]);
      expect(labels).not.toContain("Stale answer");
    } finally {
      await close();
    }
  });

  it("removing an understood chip keeps the words, drops the filter in the address and asks again; Clear drops them all", async () => {
    const { page, close } = await mounted({ url: "http://vallo.test/intelligence?q=2+bed+in+lekki+under+5m" });
    try {
      await page.getByTestId("intel-understood").waitFor();
      const chips = () => page.$$eval("[data-testid='intel-understood'] button.nf-intel-chip", (els) => els.map((e) => e.textContent?.trim()));
      /* An example listing says so, with no verified mark and no action but opening it. */
      expect(await page.getByTestId("intel-result-sub").first().textContent()).toBe("Example listing. Not available.");
      expect(await page.locator("[data-testid='intel-result'] .nf-badge--verified").count()).toBe(0);
      expect(await page.locator("[data-testid='intel-result'] [data-testid^='intel-action-']").count()).toBe(0);
      /* On the All tab the kind the words pointed at is a chip too. */
      expect(await chips()).toEqual(["Properties", "2 bedrooms", "Lekki, Lagos", "Under ₦5,000,000"]);
      await page.getByRole("button", { name: "Remove 2 bedrooms" }).click();
      await page.waitForFunction(() => new URLSearchParams(location.search).get("drop") === "bedrooms");
      const params = await page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search)));
      expect(params).toEqual({ q: "2 bed in lekki under 5m", drop: "bedrooms" });
      await page.waitForFunction(() => !document.querySelector("[data-testid='intel-chip-beds']"));
      expect(await chips()).toEqual(["Properties", "Lekki, Lagos", "Under ₦5,000,000"]);
      const asked = await page.evaluate(() =>
        (window as unknown as { __fetches: { path: string; search: string }[] }).__fetches
          .filter((f) => f.path === "/api/intelligence/search")
          .map((f) => new URLSearchParams(f.search).get("drop")),
      );
      expect(asked).toEqual([null, "bedrooms"]);

      /* Back walks the removal back. */
      await page.evaluate(() => history.back());
      await page.waitForFunction(() => !new URLSearchParams(location.search).has("drop"));
      await page.getByTestId("intel-chip-beds").waitFor();

      /* Clear takes every filter away and keeps the words. */
      await page.getByRole("button", { name: "Clear all filters" }).click();
      await page.waitForFunction(() => (new URLSearchParams(location.search).get("drop") ?? "").split(",").length === 4);
      const cleared = await page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search)));
      expect(cleared.q).toBe("2 bed in lekki under 5m");
      expect(cleared.drop!.split(",").sort()).toEqual(["bedrooms", "kind", "maxPrice", "place"]);
    } finally {
      await close();
    }
  });

  it("People to follow: the viewer's own row says You and offers no Follow; Follow appears only where offered, and stays inside its row", async () => {
    const { page, close } = await mounted({ touch: true });
    try {
      await page.getByTestId("intel-people").waitFor();
      const rows = await page.$$eval("[data-testid='intel-people'] [data-testid='person-row']", (els) =>
        els.map((row) => {
          const box = row.getBoundingClientRect();
          const act = row.querySelector(".nf-ppl-card__act > *");
          const actBox = act?.getBoundingClientRect();
          return {
            name: row.querySelector(".nf-ppl-card__name span")?.textContent,
            line: row.querySelector(".nf-ppl-card__handle")?.textContent,
            action: act?.textContent?.trim(),
            follow: row.querySelectorAll("button").length,
            mine: row.getAttribute("data-mine"),
            inside: actBox ? actBox.left >= box.left - 0.5 && actBox.right <= box.right + 0.5 : false,
          };
        }),
      );
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ name: "Test Agent One", action: "Follow", follow: 1, mine: null, inside: true });
      expect(rows[0]!.line).toContain("Agent");
      expect(rows[0]!.line).toContain("12 followers");
      expect(rows[1]).toMatchObject({ name: "Test Viewer", action: "You", follow: 0, mine: "yes", inside: true });
      expect(rows[2]).toMatchObject({ action: "View profile", follow: 0, inside: true });
      expect(rows[2]!.line).toContain("Landlord");
      /* Nothing on the page overflows sideways at 390. */
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      await close();
    }
  });

  it("recent searches: one is removed through the recent route, and a refusal puts it back", async () => {
    const { page, close } = await mounted();
    try {
      await page.getByTestId("intel-recent").waitFor();
      /* Refused first: the row comes back. */
      await page.evaluate(() => ((window as unknown as { __recentFails: boolean }).__recentFails = true));
      await page.getByRole("button", { name: "Remove 2 bed in yaba from recent searches" }).click();
      await page.waitForFunction(() =>
        (window as unknown as { __fetches: { path: string }[] }).__fetches.some((f) => f.path === "/api/intelligence/recent"),
      );
      await page.getByTestId("intel-recent-item").waitFor();
      await page.evaluate(() => ((window as unknown as { __recentFails: boolean }).__recentFails = false));
      await page.evaluate(() => ((window as unknown as { __fetches: unknown[] }).__fetches.length = 0));
      await page.getByRole("button", { name: "Remove 2 bed in yaba from recent searches" }).click();
      await page.getByTestId("intel-recent").waitFor({ state: "detached" });
      const calls = await page.evaluate(() =>
        (window as unknown as { __fetches: { path: string; search: string; method: string }[] }).__fetches.filter((f) => f.path === "/api/intelligence/recent"),
      );
      expect(calls).toEqual([{ path: "/api/intelligence/recent", search: "?q=2+bed+in+yaba", method: "DELETE" }]);
    } finally {
      await close();
    }
  });

  it("names the search keyboard, is 16px or more, and gives a phone 44px targets", async () => {
    const { page, close } = await mounted({ touch: true });
    try {
      await page.getByTestId("intel-suggested").waitFor();
      const field = await page.evaluate(() => {
        const input = document.querySelector<HTMLInputElement>("[data-testid='intel-input']")!;
        return {
          inputmode: input.getAttribute("inputmode"),
          enterkeyhint: input.getAttribute("enterkeyhint"),
          autocapitalize: input.getAttribute("autocapitalize"),
          autocomplete: input.getAttribute("autocomplete"),
          autocorrect: input.getAttribute("autocorrect"),
          spellcheck: input.getAttribute("spellcheck"),
          fontSize: parseFloat(getComputedStyle(input).fontSize),
          role: input.getAttribute("role"),
        };
      });
      expect(field).toMatchObject({ inputmode: "search", enterkeyhint: "search", autocapitalize: "none", autocomplete: "off", autocorrect: "off", spellcheck: "false", role: "combobox" });
      expect(field.fontSize).toBeGreaterThanOrEqual(16);

      const small = await page.evaluate(() =>
        [
          "[data-testid='intel-assist-open']",
          "[data-testid='intel-go']",
          "[data-testid^='intel-cat-']",
          "[data-testid='intel-explore-all']",
          "[data-testid='intel-try-chip']",
          "[data-testid='intel-recent-remove']",
          "[data-testid='intel-recent-clear']",
          "[data-testid^='intel-suggested-'] a",
        ]
          .flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)].map((el) => ({ selector, box: el.getBoundingClientRect() })))
          .filter(({ box }) => box.height < 43.5 || box.width < 43.5)
          .map(({ selector, box }) => `${selector} ${Math.round(box.width)}x${Math.round(box.height)}`),
      );
      expect(small).toEqual([]);
    } finally {
      await close();
    }
  });

  it("puts the caret in the field only when a launcher asked, and then tidies the address", async () => {
    const plain = await mounted();
    try {
      await plain.page.getByTestId("intel-suggested").waitFor();
      expect(await plain.page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).not.toBe("intel-input");
    } finally {
      await plain.close();
    }
    const launched = await mounted({ focus: true, url: "http://vallo.test/intelligence?focus=1" });
    try {
      await launched.page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "intel-input");
      await launched.page.waitForFunction(() => !location.search.includes("focus"));
    } finally {
      await launched.close();
    }
  });
});
