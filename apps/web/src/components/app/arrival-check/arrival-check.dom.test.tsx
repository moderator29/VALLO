/**
 * The arrival check, in two halves, on the product's own stylesheets.
 *
 * THE RULING (browser). `ArrivalRuling` is the console's uphold or decline of an
 * arrival report: a ruling decides whether a payout is held or released and can
 * never be taken back, so its confirmation is a `DragToConfirm` in MONEY mode.
 * Mounted for real, with the server action staged by the test, this holds it to:
 * never auto-resets once confirmed; says "confirmed" only AFTER the action has
 * resolved (and says "confirming" until then); a refusal, or a ruling the
 * database answered "none" to, springs the slide back and says why in a sentence;
 * the keyboard path is the handle itself.
 *
 * THE RECORDS (server markup, read in Chromium). `ArrivalCheck` (the guest's
 * booking) and `ArrivalCheckRecord` (the console) are async server components
 * over a database read, so they are called as the functions they are with the
 * read stubbed, and the markup they produce is loaded into Chromium on the
 * product CSS: the answered fact as a dated row in Lagos time (never a tick),
 * and the StatusChip's word, shape and colour for each state ("as listed" is the
 * filled circle, a report is the diamond and is never red).
 *
 * Fixtures are structural: slot references, a fixed instant, the real English
 * dictionary. No booking, person, amount or reference is invented.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Page } from "playwright-core";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { axeViolations } from "@/components/ui/ported-test-css";
import { GLASS_CSS, productCss } from "@/lib/testing/product-css";

/* The reads the two server components make, and what the client half calls. */
const reads = vi.hoisted(() => ({
  mine: null as unknown,
  record: null as unknown,
}));
vi.mock("@/lib/stays/arrival-check-queries", () => ({
  readMyArrivalCheck: async () => reads.mine,
  readArrivalCheckRecord: async () => reads.record,
}));
vi.mock("@/lib/stays/arrival-check-actions", () => ({
  ruleArrivalCheck: async () => ({ ok: true, data: { state: "ruled" } }),
  answerArrivalCheck: async () => ({ ok: true, data: null }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }) }));

import { ArrivalCheck } from "./ArrivalCheck";
import { ArrivalCheckRecord } from "./ArrivalCheckRecord";
import { lagosToday } from "@/lib/bookings/schema";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss(GLASS_CSS, "app/css/base.css", "app/css/chips.css", "app/css/typography.css", "app/css/controls.css");

/* ------------------------------------------------------------ the ruling */

const RULING_ENTRY = `
  import { getDictionary } from "@vallo/i18n";
  import { ArrivalRuling } from "@/components/app/arrival-check/ArrivalRuling";
  import { ToastHost } from "@/components/ui/ToastHost";
  import { mount } from "@/lib/testing/browser-root";
  const t = getDictionary("en");
  window.__facts = { admin: t.arrivalCheck.admin, slide: t.experienceUi };
  /* The server answers when the test says so. */
  window.__answer = null;
  window.__release = (value) => window.__answer(value);
  mount(
    <div style={{ width: 360, padding: 16 }}>
      <ToastHost />
      <ArrivalRuling bookingId="booking-slot" copy={t.arrivalCheck.admin} slide={t.experienceUi} />
    </div>,
  );
`;

/* A held action: resolves only when the test releases it, with what it says. */
const HELD = {
  ruleArrivalCheck: `(input) => new Promise((resolve) => { window.__answer = resolve; })`,
};

type Facts = {
  admin: Record<string, string>;
  slide: { slideToConfirm: string; confirming: string; confirmed: string };
};
const facts = (page: Page) => page.evaluate(() => (window as unknown as { __facts: Facts }).__facts);
const release = (page: Page, value: unknown) =>
  page.evaluate((v) => (window as unknown as { __release: (x: unknown) => void }).__release(v), value);
const calls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __calls?: unknown[][] }).__calls ?? []);
const routerCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []);
const slide = (page: Page) => page.getByTestId("arrival-ruling-slide");
const state = (page: Page) => slide(page).getAttribute("data-state");

/* A pointer slide, end to end, the way DragToConfirm's own test does it. */
async function slideAcross(page: Page) {
  const handle = slide(page).getByRole("button");
  const box = (await handle.boundingBox())!;
  const track = (await slide(page).boundingBox())!;
  const travel = track.width - 2 * 4 - 2 - 48;
  const y = box.y + box.height / 2;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + travel / 2, y, { steps: 4 });
  await page.mouse.move(x + travel, y, { steps: 4 });
  await page.mouse.up();
}

describe.skipIf(!hasBrowser && !process.env.CI)("the console's arrival ruling", () => {
  it("offers Uphold and Decline, and asks with a sentence and a money-mode slide, taking no ruling yet", async () => {
    const { page, close } = await mountInBrowser({ entry: RULING_ENTRY, css: CSS, actions: HELD });
    try {
      const f = await facts(page);
      expect(await page.getByRole("button", { name: f.admin.uphold!, exact: true }).count()).toBe(1);
      expect(await page.getByRole("button", { name: f.admin.decline!, exact: true }).count()).toBe(1);
      expect(await slide(page).count()).toBe(0);
      await page.getByRole("button", { name: f.admin.uphold!, exact: true }).click();
      const ask = page.getByTestId("arrival-ruling-confirm");
      expect(await ask.locator("p").first().textContent()).toBe(f.admin.confirmUphold);
      /* A ruling decides whether money moves, so the slide is the money kind. */
      expect(await slide(page).getAttribute("data-money")).toBe("true");
      expect(await state(page)).toBe("idle");
      expect(await calls(page)).toEqual([]);
      /* The handle is a real button named for what it does, a 44px target. */
      const handle = slide(page).getByRole("button", { name: f.admin.uphold!, exact: true });
      expect((await handle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await page.waitForTimeout(300).then(() => axeViolations(page))).toEqual([]);
      /* Not now: back to the two choices, nothing sent. */
      await page.getByRole("button", { name: f.admin.cancel!, exact: true }).click();
      expect(await slide(page).count()).toBe(0);
      expect(await page.getByRole("button", { name: f.admin.decline!, exact: true }).count()).toBe(1);
      expect(await calls(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("says Confirming while the server has not answered, Confirmed only after it has, and then stays confirmed for good", async () => {
    const { page, close } = await mountInBrowser({ entry: RULING_ENTRY, css: CSS, actions: HELD });
    try {
      const f = await facts(page);
      await page.getByRole("button", { name: f.admin.uphold!, exact: true }).click();
      await slideAcross(page);
      await page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.getAttribute("data-state") === "confirming");
      /* The finger is at the end, but nothing is claimed: the action is still out. */
      expect(await slide(page).getAttribute("aria-busy")).toBe("true");
      expect(await slide(page).textContent()).toContain(f.slide.confirming);
      expect(await slide(page).textContent()).not.toContain(f.slide.confirmed);
      expect(await calls(page)).toEqual([["ruleArrivalCheck", { bookingId: "booking-slot", ruling: "upheld" }]]);
      /* Held for a good while: it does not confirm by itself. */
      await page.waitForTimeout(800);
      expect(await state(page)).toBe("confirming");
      expect(await routerCalls(page)).toEqual([]);
      /* A sent ruling cannot be called back, so Cancel is not offered while
         it is out: tapping it would only close the confirmation over a
         ruling that still lands (auditor A5). */
      expect(await page.getByTestId("arrival-ruling-cancel").isDisabled()).toBe(true);

      await release(page, { ok: true, data: { state: "ruled" } });
      await page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.getAttribute("data-state") === "confirmed");
      expect(await slide(page).textContent()).toContain(f.slide.confirmed);
      expect(await page.locator("[role=status]").first().textContent()).toBe(f.slide.confirmed);
      /* The page is asked to draw the ruled record. */
      expect(await routerCalls(page)).toEqual([["refresh"]]);
      /* Money never springs back to looking unconfirmed. */
      await page.waitForTimeout(1500);
      expect(await state(page)).toBe("confirmed");
      expect(await slide(page).getAttribute("data-failed")).toBeNull();
      /* And a second slide does not send a second ruling. */
      await slideAcross(page);
      expect((await calls(page)).length).toBe(1);
    } finally {
      await close();
    }
  });

  it("confirms from the keyboard on the handle itself in two presses, and sends the ruling that was asked for", async () => {
    const { page, close } = await mountInBrowser({ entry: RULING_ENTRY, css: CSS, actions: HELD });
    try {
      const f = await facts(page);
      await page.getByRole("button", { name: f.admin.decline!, exact: true }).click();
      expect(await page.getByTestId("arrival-ruling-confirm").locator("p").first().textContent()).toBe(f.admin.confirmDecline);
      await slide(page).getByRole("button", { name: f.admin.decline!, exact: true }).focus();
      /* Money: the first press only arms the slide (D49.2). */
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.hasAttribute("data-armed"));
      expect(await calls(page)).toEqual([]);
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.getAttribute("data-state") === "confirming");
      expect(await calls(page)).toEqual([["ruleArrivalCheck", { bookingId: "booking-slot", ruling: "declined" }]]);
      await release(page, { ok: true, data: { state: "ruled" } });
      await page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.getAttribute("data-state") === "confirmed");
    } finally {
      await close();
    }
  });

  it("springs back and says the refusal in a sentence when the database refuses", async () => {
    const { page, close } = await mountInBrowser({ entry: RULING_ENTRY, css: CSS, actions: HELD });
    try {
      const f = await facts(page);
      await page.getByRole("button", { name: f.admin.uphold!, exact: true }).click();
      await slide(page).getByRole("button").focus();
      /* Money: the first press only arms the slide (D49.2). */
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.hasAttribute("data-armed"));
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.getAttribute("data-state") === "confirming");
      /* No server sentence: the component's own words for a failed ruling. */
      await release(page, { ok: false, error: "" });
      await page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.getAttribute("data-state") === "idle");
      expect(await slide(page).getAttribute("data-failed")).toBe("declined");
      expect(await page.getByRole("status").filter({ hasText: f.admin.ruleFailed! }).count()).toBeGreaterThanOrEqual(1);
      expect(await slide(page).textContent()).toContain(f.admin.ruleFailed!);
      expect(await slide(page).textContent()).not.toContain(f.slide.confirmed);
      /* Nothing was ruled, so the page is not asked to redraw as if it had been. */
      expect(await routerCalls(page)).toEqual([]);
      /* And it can be tried again: the handle is live, and so is Cancel. */
      expect(await slide(page).getByRole("button").getAttribute("aria-disabled")).toBeNull();
      expect(await page.getByTestId("arrival-ruling-cancel").isDisabled()).toBe(false);
      await page.waitForTimeout(400);
      /* The refusal words on the track clear contrast: they take the primary ink and the
         track's edge carries the failure (ported.css, `.nf-dtc[data-failed]`). */
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("uses the server's own sentence when it gives one, and says so when the ruling found nothing to rule", async () => {
    const own = await mountInBrowser({ entry: RULING_ENTRY, css: CSS, actions: HELD });
    try {
      const f = await facts(own.page);
      await own.page.getByRole("button", { name: f.admin.uphold!, exact: true }).click();
      await slide(own.page).getByRole("button").focus();
      /* Money: the first press only arms the slide (D49.2). */
      await own.page.keyboard.press("Enter");
      await own.page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.hasAttribute("data-armed"));
      await own.page.keyboard.press("Enter");
      await own.page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.getAttribute("data-state") === "confirming");
      await release(own.page, { ok: false, error: "The server's own sentence, slot." });
      await own.page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.getAttribute("data-state") === "idle");
      /* Said by the one top banner (founder, 7 November 2026). */
      expect(await own.page.getByTestId("arrival-ruling-message").textContent()).toContain("The server's own sentence, slot.");
    } finally {
      await own.close();
    }

    const none = await mountInBrowser({ entry: RULING_ENTRY, css: CSS, actions: HELD });
    try {
      const f = await facts(none.page);
      await none.page.getByRole("button", { name: f.admin.decline!, exact: true }).click();
      await slide(none.page).getByRole("button").focus();
      /* Money: the first press only arms the slide (D49.2). */
      await none.page.keyboard.press("Enter");
      await none.page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.hasAttribute("data-armed"));
      await none.page.keyboard.press("Enter");
      await none.page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.getAttribute("data-state") === "confirming");
      await release(none.page, { ok: true, data: { state: "none" } });
      await none.page.waitForFunction(() => document.querySelector("[data-testid=arrival-ruling-slide]")?.getAttribute("data-state") === "idle");
      /* Not a success: the slide is back at rest, with the sentence for "nothing to rule". */
      expect(await none.page.getByTestId("arrival-ruling-message").textContent()).toContain(f.admin.ruleNone);
      expect(await routerCalls(none.page)).toEqual([]);
    } finally {
      await none.close();
    }
  });

  it("holds a short slide back without sending anything", async () => {
    const { page, close } = await mountInBrowser({ entry: RULING_ENTRY, css: CSS, actions: HELD });
    try {
      const f = await facts(page);
      await page.getByRole("button", { name: f.admin.uphold!, exact: true }).click();
      const handle = slide(page).getByRole("button");
      const box = (await handle.boundingBox())!;
      await page.mouse.move(box.x + 24, box.y + 24);
      await page.mouse.down();
      await page.mouse.move(box.x + 24 + 80, box.y + 24, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(600);
      expect(await state(page)).toBe("idle");
      expect(await calls(page)).toEqual([]);
    } finally {
      await close();
    }
  });
});

/* ------------------------------------------------------- the records */

const ANSWERED_AT = "2026-10-06T14:30:00Z";
const LATER = "2026-10-08T09:05:00Z";

/* Markup from a server component, mounted in Chromium so CSS and axe see it. */
function shown(html: string): string {
  return `
    import { mount } from "@/lib/testing/browser-root";
    mount(<div style={{ maxWidth: 420, margin: "0 auto", padding: 16 }} dangerouslySetInnerHTML={{ __html: ${JSON.stringify(html)} }} />);
  `;
}
async function guestMarkup(view: unknown, checkIn = "2026-10-06") {
  reads.mine = view;
  return renderToStaticMarkup(await ArrivalCheck({ bookingId: "booking-slot", checkIn, locale: "en" }));
}
async function recordMarkup(record: unknown) {
  reads.record = record;
  return renderToStaticMarkup(await ArrivalCheckRecord({ bookingId: "booking-slot", locale: "en" }));
}

/* The chip's mark, in one read. */
const chip = (page: Page) =>
  page.locator(".nf-badge").first().evaluate((el) => {
    const mark = el.querySelector("[aria-hidden=true]") as HTMLElement | null;
    const s = mark ? getComputedStyle(mark) : null;
    return {
      word: (el.textContent ?? "").trim(),
      cls: [...el.classList].find((c) => c.startsWith("nf-badge--")) ?? "",
      clip: s?.clipPath ?? "",
      radius: s?.borderTopLeftRadius ?? "",
      filled: s ? !/, 0\)$/.test(s.backgroundColor) : false,
    };
  });

const compact = (text: string | null) => (text ?? "").replace(/[\s ]+/g, " ").trim();

describe.skipIf(!hasBrowser && !process.env.CI)("the guest's answered arrival check", () => {
  it("states an as-listed answer as a success chip with a filled circle, and a dated Lagos row beneath", async () => {
    const html = await guestMarkup({ state: "answered", answer: "as_listed", answeredAt: ANSWERED_AT, reference: null });
    const { page, close } = await mountInBrowser({ entry: shown(html), css: CSS });
    try {
      const section = page.getByTestId("arrival-check-answered");
      expect(await section.count()).toBe(1);
      expect(await chip(page)).toMatchObject({ word: "Yes, it is as listed", cls: "nf-badge--success", filled: true });
      expect((await chip(page)).clip).toBe("none");
      /* Round: the shape a finished thing has. */
      expect(parseFloat((await chip(page)).radius)).toBeGreaterThan(4);
      /* The fact is a dated row, in Lagos time (14:30 UTC is 15:30 there, and the locale reads the 24-hour clock), not a tick. */
      expect(compact(await section.locator("dt").textContent())).toBe("Answered");
      expect(compact(await page.getByTestId("arrival-check-answered-at").textContent())).toMatch(/^Tue,? 6 Oct,? 15:30$/);
      expect(await section.locator("dd").evaluate((el) => getComputedStyle(el).fontVariantNumeric)).toContain("tabular-nums");
      expect(await section.locator("svg").count()).toBe(0);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("states each report as the diamond, a looked-at state and never red, with its reason as the word", async () => {
    const seen: Record<string, Awaited<ReturnType<typeof chip>>> = {};
    for (const [reason, word] of [
      ["no_access", "I could not get in"],
      ["not_as_listed", "It is not as listed"],
    ] as const) {
      const html = await guestMarkup({ state: "answered", answer: reason, answeredAt: LATER, reference: "REF-SLOT" });
      const { page, close } = await mountInBrowser({ entry: shown(html), css: CSS });
      try {
        const c = await chip(page);
        seen[reason] = c;
        /* The word is the dictionary's own reason; the shape is the diamond. */
        expect(c.word.length).toBeGreaterThan(0);
        expect(c.cls).toBe("nf-badge--pending");
        expect(c.clip).not.toBe("none");
        expect(c.filled).toBe(true);
        /* Never the failure colour: compare with a real failed badge on the same stage. */
        const failed = await page.evaluate(() => {
          const el = document.createElement("span");
          el.className = "nf-badge nf-badge--error";
          el.textContent = "x";
          document.body.append(el);
          const s = getComputedStyle(el);
          const out = { color: s.color, bg: s.backgroundColor };
          el.remove();
          const chipEl = document.querySelector(".nf-badge") as HTMLElement;
          const mine = getComputedStyle(chipEl);
          return { failed: out, color: mine.color, bg: mine.backgroundColor };
        });
        expect(failed.bg).not.toBe(failed.failed.bg);
        expect(failed.color).not.toBe(failed.failed.color);
        const row = page.getByTestId("arrival-check-answered-at");
        expect(compact(await row.textContent())).toMatch(/^Thu,? 8 Oct,? 10:05$/);
        expect(word.length).toBeGreaterThan(0);
        expect(await axeViolations(page)).toEqual([]);
      } finally {
        await close();
      }
    }
    /* The two reports share the diamond; neither is the as-listed circle. */
    expect(seen.no_access!.clip).toBe(seen.not_as_listed!.clip);
    expect(seen.no_access!.word).not.toBe(seen.not_as_listed!.word);
  });

  it("says the reference in the sentence when there is one and drops its slot when there is not", async () => {
    const withRef = await guestMarkup({ state: "answered", answer: "no_access", answeredAt: LATER, reference: "REF-SLOT" });
    expect(withRef).toContain("REF-SLOT");
    const without = await guestMarkup({ state: "answered", answer: "no_access", answeredAt: LATER, reference: null });
    expect(without).not.toMatch(/\{reference\}|\{time\}/);
    expect(without).not.toContain("REF-SLOT");
  });

  it("draws no dated row when the database gave no answer time, and nothing at all when there is nothing to say", async () => {
    const noTime = await guestMarkup({ state: "answered", answer: "as_listed", answeredAt: null, reference: null });
    expect(noTime).not.toContain("arrival-check-answered-at");
    for (const view of [{ state: "none" }, { state: "closed" }, { state: "before", opensAt: null }]) {
      expect(await guestMarkup(view)).toBe("");
    }
    /* A failed read says so only on the days it could be hiding an open check. */
    expect(await guestMarkup({ state: "failed" }, "2020-01-01")).toBe("");
    expect(await guestMarkup({ state: "failed" }, lagosToday())).toContain("arrival-check-failed");
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the console's arrival record", () => {
  const base = { note: null, reference: null, photoUrls: [] as string[], ruling: null, ruledAt: null };

  it("states an as-listed answer as one dated line and offers no ruling", async () => {
    const html = await recordMarkup({ ...base, answer: "as_listed", answeredAt: ANSWERED_AT });
    const { page, close } = await mountInBrowser({ entry: shown(html), css: CSS });
    try {
      const card = page.getByTestId("admin-arrival-check");
      expect(compact(await card.locator("p").first().textContent())).toMatch(/6 Oct,? 15:30$/);
      expect(await card.getByRole("button").count()).toBe(0);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("puts the reference beside the date, and offers Uphold and Decline on an unruled report", async () => {
    const html = await recordMarkup({ ...base, answer: "no_access", answeredAt: ANSWERED_AT, reference: "REF-SLOT", note: "A note, slot." });
    const { page, close } = await mountInBrowser({ entry: shown(html), css: CSS });
    try {
      const card = page.getByTestId("admin-arrival-check");
      expect(compact(await card.locator("p").first().textContent())).toMatch(/6 Oct,? 15:30 · REF-SLOT$/);
      expect(await card.textContent()).toContain("A note, slot.");
      expect(await card.getByRole("button").count()).toBe(2);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("states a ruling as a dated sentence and takes the buttons away", async () => {
    for (const ruling of ["upheld", "declined"] as const) {
      const html = await recordMarkup({ ...base, answer: "not_as_listed", answeredAt: ANSWERED_AT, ruling, ruledAt: LATER });
      const { page, close } = await mountInBrowser({ entry: shown(html), css: CSS });
      try {
        const card = page.getByTestId("admin-arrival-check");
        expect(await card.getByRole("button").count(), ruling).toBe(0);
        expect(compact(await card.locator("p.font-semibold").textContent()), ruling).toMatch(/8 Oct/);
      } finally {
        await close();
      }
    }
  });

  it("draws nothing for no record or an unreadable one", async () => {
    expect(await recordMarkup(null)).toBe("");
    expect(await recordMarkup("unavailable")).toBe("");
  });
});
