/**
 * THE WAIT AND THE SCREEN ARE THE SAME HEIGHT, IN CHROMIUM (W2, round 5;
 * CRAFT-PRINCIPLES 2.6). Payouts, receipts and refunds each draw their own
 * screen, inert, while the history is read (`MoneyWait`). Here the wait and
 * the screen it stands in for are mounted on the compiled cascade (Tailwind
 * and every product sheet, as the build compiles them) with the history
 * fixtures, and every section of the one must sit where the same section of
 * the other sits: the same top, the same height, and the same total. Before
 * this, these routes fell through to the group's three generic card rows,
 * which have no hero band and no field, so the screen re-laid when it came.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { appCss, fitMount } from "@/lib/testing/locale-fit";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

/* The screens as their pages draw them, from the money fixtures (one payout,
   made into a second one, payments and refunds by kind). */
const SETUP = `
  const base = FIXTURE_PAYOUTS[0];
  const PAYOUTS = [base, { ...base, id: "p2", occurredAt: "2026-09-28T10:00:00Z" }];
  const PAYMENTS = [
    { ...base, id: "r1", kind: "payment", direction: "out", bookingId: "b1" },
    { ...base, id: "r2", kind: "payment", direction: "out", bookingId: "b2", occurredAt: "2026-09-30T10:00:00Z" },
    { ...base, id: "r3", kind: "refund", direction: "in", bookingId: "b3", occurredAt: "2026-09-29T10:00:00Z" },
  ];
  const REFUNDS = [
    { ...base, id: "f1", kind: "refund", direction: "in", bookingId: "b1" },
    { ...base, id: "f2", kind: "refund", direction: "in", bookingId: "b2", occurredAt: "2026-10-02T08:00:00Z" },
    { ...base, id: "f3", kind: "refund", direction: "in", bookingId: "b3", occurredAt: "2026-10-02T07:00:00Z" },
  ];
`;

const IMPORTS = `
  import { FIXTURE_PAYOUTS } from "@/app/(dev)/preview/money/fixtures";
  import { PageFrame } from "@/components/app/PageFrame";
  import { TYPE } from "@/components/app/Screen";
  import { HistoryHero } from "@/components/app/money-history/HistoryHero";
  import { HistoryList } from "@/components/app/money-history/HistoryList";
  import { PayoutList } from "@/components/money/PayoutList";
  import { ReceiptVault } from "@/components/money/ReceiptVault";
  import * as M from "@/lib/money/copy";
  import PayoutsWait from "@/app/(app)/payouts/loading";
  import ReceiptsWait from "@/app/(app)/receipts/loading";
  import RefundsWait from "@/app/(app)/refunds/loading";
`;

const SCREENS = {
  payouts: {
    wait: `<PayoutsWait />`,
    page: `<main className="nf-page nf-md nf-history">
      <PageFrame title={M.PAYOUTS_TITLE} fallback="/home"><div>
      <div className="mt-inline space-y-block">
        <HistoryHero id="t" label={M.EARNINGS_TOTAL_LABEL} totalMinor={345600000} locale="en" note={M.EARNINGS_SETTLEMENT + " " + M.HISTORY_NOT_A_BALANCE} facts={[]} />
        <p className={TYPE.body}>{M.PAYOUTS_LEDE}</p>
        <PayoutList entries={PAYOUTS} locale="en" />
      </div>
      </div></PageFrame>
    </main>`,
  },
  receipts: {
    wait: `<ReceiptsWait />`,
    page: `<main className="nf-page nf-md">
      <PageFrame title={M.RECEIPTS_TITLE} fallback="/payments"><div>
      <div className="mt-inline space-y-block">
        <p className={TYPE.body}>{M.RECEIPTS_LEDE}</p>
        <ReceiptVault entries={PAYMENTS} scanned={3} kind="all" query="" basePath="/receipts" locale="en" />
        <p className={TYPE.rowMeta}>{M.PARTNERS_SHORT}</p>
      </div>
      </div></PageFrame>
    </main>`,
  },
  refunds: {
    wait: `<RefundsWait />`,
    page: `<main className="nf-page nf-md nf-history">
      <PageFrame title={M.REFUNDS_TITLE} fallback="/payments"><div>
      <div className="mt-inline space-y-block">
        <p className={TYPE.body}>{M.REFUNDS_LEDE}</p>
        <p className={TYPE.rowMeta}>{M.REFUNDS_SCOPE}</p>
        <HistoryList entries={REFUNDS} nextBefore={null} basePath="/refunds" paged={false} locale="en" heading="Your refunds" linkToBooking />
        <section className="nf-panel nf-panel--card">
          <h2 className="nf-body font-semibold text-[var(--nf-content-primary)]">{M.REFUNDS_HOW_TITLE}</h2>
          <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">{M.REFUNDS_HOW_BODY}</p>
          <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">{M.REFUND_ROUTE}</p>
        </section>
      </div>
      </div></PageFrame>
    </main>`,
  },
} as const;

type Section = { tag: string; top: number; h: number };

/** Every laid-out box down to the sections' children, in document order, skipping the
    wait's `display: contents` wrapper and the loading state's hidden label. */
const sections = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector("#stage > *")!;
    const out: { tag: string; top: number; h: number }[] = [];
    const walk = (el: Element, depth: number) => {
      for (const child of el.children) {
        const cs = getComputedStyle(child);
        if (cs.display === "contents") {
          walk(child, depth);
          continue;
        }
        if (child.classList.contains("sr-only") || cs.position === "absolute" || cs.position === "fixed") continue;
        const r = child.getBoundingClientRect();
        if (r.height === 0) continue;
        out.push({ tag: `${"  ".repeat(depth)}${child.tagName.toLowerCase()}`, top: Math.round(r.top), h: Math.round(r.height) });
        if (depth < 2) walk(child, depth + 1);
      }
    };
    walk(root, 0);
    return { total: Math.round(root.getBoundingClientRect().height), out };
  });

const mount = async (body: string) =>
  fitMount({ locale: "en", imports: IMPORTS, setup: SETUP, body, css: await appCss(), bleed: true, reducedMotion: true });

describe.skipIf(!hasBrowser && !process.env.CI)("a money screen's wait is the screen", () => {
  for (const [name, screen] of Object.entries(SCREENS)) {
    it(`${name}: every section of the wait sits where the screen's does, at its height`, async () => {
      const wait = await mount(screen.wait);
      const page = await mount(screen.page);
      try {
        await wait.page.evaluate(() => document.fonts.ready);
        await page.page.evaluate(() => document.fonts.ready);
        const a = await sections(wait.page);
        const z = await sections(page.page);
        /* Positions and heights only: the wait draws a field's box where the page has a form, and a
           chip as a span where the page has a link, on purpose (a wait submits and prefetches nothing). */
        const shape = (s: { out: Section[] }) => s.out.map((x) => `${x.tag.length - x.tag.trimStart().length}: top ${x.top} h ${x.h}`);
        expect(shape(a)).toEqual(shape(z));
        expect(a.total).toBe(z.total);
        /* And it is a wait: inert, inside the one loading state. */
        expect(await wait.page.locator("[data-state-kind=loading] [data-money-wait][inert]").count()).toBe(1);
      } finally {
        await wait.close();
        await page.close();
      }
    });
  }
});
