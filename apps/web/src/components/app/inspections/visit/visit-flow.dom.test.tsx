/**
 * SCHEDULE A VISIT, DRIVEN FOR REAL IN CHROMIUM (lib/testing/mount-in-browser).
 *
 * The planner is mounted with its two server actions staged, and each test
 * walks it the way a renter does: type, day, time, Continue, then Send in
 * the review. What is held:
 *
 *   - the suggest path files through `requestInspection` WITH the visit mode,
 *     and the open-time path books through `bookViewingSlot` with it;
 *   - a double tap on Send is one call, carrying a tap key;
 *   - a refusal is said in the review and nothing navigates;
 *   - the video card exists only while `video_calls` is on;
 *   - the status screen says "Request sent" for a request and never
 *     "Visit confirmed", and offers the calendar only once confirmed.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const run = describe.skipIf(!hasBrowser && !process.env.CI);

/* The harness loads no stylesheet, so an open sheet sits at the end of the
   page while it locks the page's scroll: a tall viewport keeps the review
   sheet on screen, as the real fixed sheet is. */
const TALL = { width: 390, height: 3200 };

/* 13 October 2026, 09:00 in Lagos. */
const NOW = Date.parse("2026-10-13T08:00:00Z");

function planner(opts: { slots: string; videoOn: boolean }) {
  return `
    import { mount } from "@/lib/testing/browser-root";
    import { getDictionary } from "@vallo/i18n";
    import { VisitPlanner } from "@/components/app/inspections/visit/VisitPlanner";
    import { ToastHost } from "@/components/ui/ToastHost";
    /* A send's refusal is said by the one banner (Grade 1), drawn by the host
       the root layout mounts. */
    mount(<><VisitPlanner listingId="l-1" locale="en" now={${NOW}} copy={getDictionary("en").visit}
      slots={${opts.slots}} videoOn={${opts.videoOn}} initialSlot={null} roleNoun="owner" lister={null} /><ToastHost /></>);
  `;
}

const calls = (page: Page, name: string) =>
  page.evaluate(
    (n) => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).filter((c) => c[0] === n),
    name,
  );

const routerCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []);

async function pickAndReview(page: Page, mode: "in_person" | "video" = "in_person") {
  await page.getByTestId(`visit-mode-${mode}`).click();
  /* Tomorrow: every suggested hour is open on it. */
  await page.locator('[data-day="2026-10-14"]').click();
  await page.getByTestId("visit-time").first().click();
  await page.getByTestId("visit-continue").click();
  await page.getByTestId("visit-review").waitFor();
}

run("schedule a visit: suggesting a time", () => {
  it("files a request with the visit mode, then opens its status screen", async () => {
    const { page, close } = await mountInBrowser({
      viewport: TALL,
      entry: planner({ slots: "[]", videoOn: true }),
      actions: { requestInspection: `async () => ({ ok: true, data: { id: "ix-1" } })` },
    });
    try {
      await page.getByTestId("visit-ask-lead").waitFor();
      await pickAndReview(page, "video");
      expect(await page.getByTestId("visit-send").textContent()).toContain("Send request");
      await page.getByTestId("visit-send").click();
      await page.waitForFunction(() =>
        ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).some((c) => c[0] === "replace"),
      );
      const [call] = await calls(page, "requestInspection");
      const input = call?.[1] as { listingId: string; mode: string; when: string; tapKey?: string };
      expect(input.listingId).toBe("l-1");
      expect(input.mode).toBe("video");
      /* 08:00 tomorrow in Lagos is 07:00Z: the first suggested hour. */
      expect(input.when).toBe("2026-10-14T07:00:00.000Z");
      expect(input.tapKey).toMatch(/^[0-9a-f-]{36}$/);
      expect(await routerCalls(page)).toContainEqual(["replace", "/listing/l-1/visit/ix-1"]);
      expect(await calls(page, "bookViewingSlot")).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it("sends once however many times Send is pressed", async () => {
    const { page, close } = await mountInBrowser({
      viewport: TALL,
      entry: planner({ slots: "[]", videoOn: false }),
      actions: {
        requestInspection: `() => new Promise((resolve) => setTimeout(() => resolve({ ok: true, data: { id: "ix-2" } }), 600))`,
      },
    });
    try {
      await pickAndReview(page);
      const send = page.getByTestId("visit-send");
      await send.click();
      await send.click({ force: true }).catch(() => undefined);
      await send.click({ force: true }).catch(() => undefined);
      await page.waitForFunction(() =>
        ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).some((c) => c[0] === "replace"),
      );
      expect(await calls(page, "requestInspection")).toHaveLength(1);
    } finally {
      await close();
    }
  });

  it("says a refusal in the review and goes nowhere", async () => {
    const { page, close } = await mountInBrowser({
      viewport: TALL,
      entry: planner({ slots: "[]", videoOn: false }),
      actions: {
        requestInspection: `async () => ({ ok: false, error: "You have already asked to see this property." })`,
      },
    });
    try {
      await pickAndReview(page);
      await page.getByTestId("visit-send").click();
      await page.getByTestId("visit-send-error").waitFor();
      expect(await page.getByTestId("visit-send-error").textContent()).toContain("already asked");
      expect((await routerCalls(page)).filter((c) => c[0] === "replace")).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it("offers a video visit only while calls are on", async () => {
    const { page, close } = await mountInBrowser({ viewport: TALL, entry: planner({ slots: "[]", videoOn: false }) });
    try {
      await page.getByTestId("visit-mode-in_person").waitFor();
      expect(await page.getByTestId("visit-mode-video").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("asks for a day and a time before it reviews anything", async () => {
    const { page, close } = await mountInBrowser({ viewport: TALL, entry: planner({ slots: "[]", videoOn: false }) });
    try {
      await page.getByTestId("visit-continue").click();
      await page.getByTestId("visit-problem").waitFor();
      expect(await page.getByTestId("visit-review").count()).toBe(0);
    } finally {
      await close();
    }
  });
});

run("schedule a visit: an open time the lister set", () => {
  const slots = `[{ slotAt: "2026-10-14T09:00:00.000Z", minutes: 30, windowId: "w1" }, { slotAt: "2026-10-14T15:00:00.000Z", minutes: 30, windowId: "w1" }]`;

  it("books the slot with the visit mode and says it is booked straight away", async () => {
    const { page, close } = await mountInBrowser({
      viewport: TALL,
      entry: planner({ slots, videoOn: true }),
      actions: { bookViewingSlot: `async () => ({ ok: true, data: { id: "ix-9" } })` },
    });
    try {
      /* Days without open times cannot be picked. */
      expect(await page.locator('[data-day="2026-10-15"]').isDisabled()).toBe(true);
      await pickAndReview(page);
      expect(await page.getByTestId("visit-send").textContent()).toContain("Book this visit");
      await page.getByTestId("visit-send").click();
      await page.waitForFunction(() =>
        ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).some((c) => c[0] === "replace"),
      );
      const [call] = await calls(page, "bookViewingSlot");
      expect(call?.[1]).toMatchObject({ listingId: "l-1", slotAt: "2026-10-14T09:00:00.000Z", mode: "in_person" });
      expect(await routerCalls(page)).toContainEqual(["replace", "/listing/l-1/visit/ix-9"]);
    } finally {
      await close();
    }
  });
});

function status(row: string) {
  return `
    import { mount } from "@/lib/testing/browser-root";
    import { getDictionary } from "@vallo/i18n";
    import { VisitStatus } from "@/components/app/inspections/visit/VisitStatus";
    const t = getDictionary("en");
    const base = { id: "ix-1", listingId: "l-1", requestedAt: "2026-10-15T09:00:00.000Z", slotAt: null, note: "Is parking included?",
      listerNote: null, createdAt: "2026-10-13T07:00:00.000Z", respondedAt: null, confirmedAt: null, completedAt: null,
      outcome: null, visitMode: "in_person", conversationId: "c-1", slotMinutes: null };
    mount(<VisitStatus row={{ ...base, ...${row} }} listingId="l-1" locale="en" now={${NOW}} copy={t.visit}
      reminders={{ eve: null, day: null }} roleNoun="owner" lister={null} area="Yaba" place="Yaba, Lagos"
      calendarWords={t.memberKit.dayKit} />);
  `;
}

run("the visit status screen", () => {
  it("says a request was sent, never confirmed, and holds the calendar until it is", async () => {
    const { page, close } = await mountInBrowser({ entry: status(`{ state: "REQUESTED" }`) });
    try {
      expect(await page.getByTestId("visit-status-title").textContent()).toBe("Request sent");
      expect(await page.getByText("The owner will confirm shortly.").count()).toBe(1);
      expect(await page.getByTestId("visit-check").count()).toBe(1);
      expect(await page.getByTestId("visit-add-calendar").isDisabled()).toBe(true);
      expect(await page.getByTestId("visit-calendar-why").count()).toBe(1);
      expect(await page.getByTestId("visit-sent-note").textContent()).toContain("Is parking included?");
    } finally {
      await close();
    }
  });

  it("offers the calendar file once the visit is confirmed", async () => {
    const { page, close } = await mountInBrowser({
      entry: status(`{ state: "CONFIRMED", slotAt: "2026-10-15T09:00:00.000Z", confirmedAt: "2026-10-13T07:30:00.000Z" }`),
    });
    try {
      expect(await page.getByTestId("visit-status-title").textContent()).toBe("Visit confirmed");
      expect(await page.getByTestId("visit-add-calendar").isDisabled()).toBe(false);
      const download = page.waitForEvent("download");
      await page.getByTestId("visit-add-calendar").click();
      const file = await download;
      expect(file.suggestedFilename()).toBe("vallo-viewing-yaba.ics");
    } finally {
      await close();
    }
  });

  it("offers a proposed time to accept, without the tick", async () => {
    const { page, close } = await mountInBrowser({
      entry: status(`{ state: "PROPOSED", slotAt: "2026-10-16T10:00:00.000Z" }`),
      actions: { acceptProposedTime: `async () => ({ ok: true, data: null })` },
    });
    try {
      expect(await page.getByTestId("visit-check").count()).toBe(0);
      await page.getByTestId("visit-accept").click();
      await page.waitForFunction(() =>
        ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).some((c) => c[0] === "refresh"),
      );
      expect((await calls(page, "acceptProposedTime"))[0]?.[1]).toEqual({ id: "ix-1" });
    } finally {
      await close();
    }
  });

  it("says a declined request plainly and offers to ask again, with no calendar", async () => {
    const { page, close } = await mountInBrowser({ entry: status(`{ state: "DECLINED", respondedAt: "2026-10-13T07:40:00.000Z" }`) });
    try {
      expect(await page.getByTestId("visit-status-title").textContent()).toBe("Request declined");
      expect(await page.getByTestId("visit-add-calendar").count()).toBe(0);
      expect(await page.getByTestId("visit-ask-again").getAttribute("href")).toBe("/listing/l-1/visit");
    } finally {
      await close();
    }
  });

  it("shows Join video visit only inside the window", async () => {
    /* 15:00 in Lagos is 14:00Z; the render's clock is 13:55Z, five minutes before. */
    const entry = status(`{ state: "CONFIRMED", visitMode: "video", slotAt: "2026-10-13T14:00:00.000Z", confirmedAt: "2026-10-13T07:30:00.000Z", slotMinutes: 30 }`);
    const open = await mountInBrowser({ entry: entry.replace(`now={${NOW}}`, `now={${Date.parse("2026-10-13T13:55:00Z")}}`) });
    try {
      expect(await open.page.getByTestId("visit-join").count()).toBe(1);
    } finally {
      await open.close();
    }
    const early = await mountInBrowser({ entry });
    try {
      expect(await early.page.getByTestId("visit-join").count()).toBe(0);
      expect(await early.page.getByTestId("visit-join-later").count()).toBe(1);
    } finally {
      await early.close();
    }
  });
});
