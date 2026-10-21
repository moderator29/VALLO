/**
 * EVERY WIRED SUCCESS MOMENT, DRIVEN FOR REAL (docs/SUCCESS_MOMENTS.md).
 *
 * Each block mounts the real component in Chromium with its server action
 * staged (lib/testing/mount-in-browser), and asserts the success sheet opens
 * on the ok path and does NOT open on the pending or error paths. The staged
 * answers are the shapes the actions really return.
 *
 * A "does not open" assertion first waits for the component to have shown
 * what it did instead (the pending sheet, the refusal), so it is not passing
 * merely because it looked too early.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";

/* Every test here mounts a real bundle in Chromium: the browser starts in the
   hook, and each test gets the budget its own waits add up to. */
vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const SHEET = '[data-testid="success-sheet"]';

async function sheetOpens(page: Page, title?: string): Promise<void> {
  await page.waitForSelector(SHEET, { timeout: 15_000 });
  if (title) {
    await page.waitForFunction(
      (t) => document.querySelector('[data-testid="success-title"]')?.textContent === t,
      title,
      { timeout: 15_000 },
    );
  }
}

async function noSheet(page: Page): Promise<void> {
  /* Time for anything scheduled after the answer, generous on a busy box. */
  await page.waitForTimeout(800);
  expect(await page.locator(SHEET).count()).toBe(0);
}

async function actionCalled(page: Page, name: string): Promise<void> {
  await page.waitForFunction(
    (n) => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).some((c) => c[0] === n),
    name,
    { timeout: 15_000 },
  );
}

const routerCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []);

const run = describe.skipIf(!hasBrowser && !process.env.CI);

/* --------------------------------------------------------------- money */

const PAYMENT_RETURN = `
  import { mount } from "@/lib/testing/browser-root";
  import { PaymentReturn } from "@/app/(app)/checkout/[bookingId]/PaymentReturn";
  mount(<PaymentReturn reference="rm-book-abc123" bookingId="bk-1" amountMinor={50000000} locale="en"
    retryHref="/checkout/bk-1" plansAction={{ label: "See your stays", href: "/bookings" }} />);
`;

run("card payment settled (checkout return)", () => {
  it("opens with the SETTLED amount and the reference when the charge settled against this booking", async () => {
    const { page, close } = await mountInBrowser({
      entry: PAYMENT_RETURN,
      url: "http://vallo.test/checkout/bk-1?paid=1&reference=rm-book-abc123",
      actions: {
        settleCardPayment: `async () => ({ ok: true, data: { bookingId: "bk-1", amountMinor: 48500000, confirmed: true, outcome: "settled" } })`,
      },
    });
    try {
      await sheetOpens(page, "Stay paid");
      expect(await page.getByTestId("success-amount").textContent()).toContain("485,000");
      expect(await page.locator(".nf-success__mono").textContent()).toBe("rm-book-abc123");
      /* The flag goes when the sheet does. */
      await page.getByTestId("success-secondary").click();
      const replaced = (await routerCalls(page)).filter((c) => c[0] === "replace");
      expect(replaced[0]?.[1]).toBe("/checkout/bk-1");
    } finally {
      await close();
    }
  });

  it("does not open while the payment is still being confirmed", async () => {
    const { page, close } = await mountInBrowser({
      entry: PAYMENT_RETURN,
      actions: { settleCardPayment: `() => new Promise(() => {})` },
    });
    try {
      await page.getByText("Confirming your payment").first().waitFor();
      await noSheet(page);
    } finally {
      await close();
    }
  });

  it("does not open for a settlement against another booking, or a refunded charge", async () => {
    for (const data of [
      `{ bookingId: "bk-OTHER", amountMinor: 1, confirmed: true, outcome: "settled" }`,
      `{ bookingId: "bk-1", amountMinor: 1, confirmed: false, outcome: "already-settled", transactionStatus: "REFUNDED" }`,
    ]) {
      const { page, close } = await mountInBrowser({
        entry: PAYMENT_RETURN,
        actions: { settleCardPayment: `async () => ({ ok: true, data: ${data} })` },
      });
      try {
        await page.getByText("Still checking").first().waitFor();
        await noSheet(page);
      } finally {
        await close();
      }
    }
  });

  it("does not open when the server refuses (still processing, failed)", async () => {
    const { page, close } = await mountInBrowser({
      entry: PAYMENT_RETURN,
      actions: { settleCardPayment: `async () => ({ ok: false, error: "The payment is still processing. Your booking confirms the moment it settles." })` },
    });
    try {
      await page.getByText("Payment not confirmed").first().waitFor();
      await noSheet(page);
    } finally {
      await close();
    }
  });
});

run("rent and move-in paid (rent return)", () => {
  it("says rent, not a stay", async () => {
    const { page, close } = await mountInBrowser({
      entry: PAYMENT_RETURN.replace('bookingId="bk-1"', 'bookingId="bk-1" kind="rent"'),
      actions: {
        settleCardPayment: `async () => ({ ok: true, data: { bookingId: "bk-1", amountMinor: 50000000, confirmed: true, outcome: "settled" } })`,
      },
    });
    try {
      await sheetOpens(page, "Rent paid");
    } finally {
      await close();
    }
  });
});

const SHARE = `
  import { mount } from "@/lib/testing/browser-root";
  import { getDictionary } from "@vallo/i18n";
  import { SettleShareOnReturn } from "@/components/app/tenancy/FlatmateControls";
  mount(<SettleShareOnReturn tenancyId="11111111-1111-4111-8111-111111111111" reference="rm-book-share1" success={getDictionary("en").success} />);
`;

run("a flatmate share paid", () => {
  it("opens for a share settled on this call, with its amount", async () => {
    const { page, close } = await mountInBrowser({
      entry: SHARE,
      actions: { settleShareReturn: `async () => ({ ok: true, data: { state: "share-settled", paidMinor: 1, totalMinor: 2, amountMinor: 25000000 } })` },
    });
    try {
      await sheetOpens(page, "Your share is paid");
      expect(await page.getByTestId("success-amount").textContent()).toContain("250,000");
    } finally {
      await close();
    }
  });

  it("says the move-in is paid in full when this share completed it", async () => {
    const { page, close } = await mountInBrowser({
      entry: SHARE,
      actions: { settleShareReturn: `async () => ({ ok: true, data: { state: "settled", paidMinor: null, totalMinor: 2, amountMinor: 1 } })` },
    });
    try {
      await sheetOpens(page, "Move-in paid in full");
    } finally {
      await close();
    }
  });

  it("does not open on a revisit (already recorded) or a refusal (still processing)", async () => {
    for (const answer of [
      `{ ok: true, data: { state: "already", paidMinor: null, totalMinor: null, amountMinor: null } }`,
      `{ ok: false, error: "The payment is still processing. It is recorded the moment it settles." }`,
    ]) {
      const { page, close } = await mountInBrowser({ entry: SHARE, actions: { settleShareReturn: `async () => (${answer})` } });
      try {
        await actionCalled(page, "settleShareReturn");
        await page.waitForFunction(() =>
          ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).some((c) => c[0] === "refresh"),
        );
        await noSheet(page);
      } finally {
        await close();
      }
    }
  });
});

const CRYPTO = (state: string) => `
  import { mount } from "@/lib/testing/browser-root";
  import { CryptoPaymentStatus } from "@/components/app/payments/crypto/CryptoPaymentStatus";
  const view = { id: "c1", reference: "rm-crypto-1", bookingId: "bk-1", state: ${JSON.stringify(state)}, asset: "USDT",
    network: "tron", assetName: "Tether", networkName: "Tron", decimals: 6, networkWarning: "Send on Tron only.",
    amountMinor: 50000000, feeMinor: 0, rate: "1600", cryptoAmount: "312.5", cryptoReceived: null, cryptoOverpaid: null,
    cryptoRefunded: null, depositAddress: "TXYZ", depositMemo: null, hostedUrl: null, refundAddress: null, txHash: null,
    refundTxHash: null, confirmations: null, confirmationsRequired: null, expiresAt: new Date(Date.now() + 600000).toISOString(),
    settledAt: null, providerPaymentId: null, createdAt: new Date().toISOString() };
  window.__view = view;
  mount(<CryptoPaymentStatus initial={view} locale="en" providerName="Provider" />);
`;

run("crypto payment settled", () => {
  it("opens on a live transition to settled", async () => {
    const { page, close } = await mountInBrowser({
      entry: CRYPTO("confirming"),
      actions: { cryptoPaymentStatus: `async () => ({ ok: true, data: { ...window.__view, state: "settled", cryptoReceived: "312.5" } })` },
    });
    try {
      await sheetOpens(page, "Crypto payment received");
    } finally {
      await close();
    }
  }, 20_000);

  it("does not open while it is still confirming, nor for a payment already settled on arrival", async () => {
    for (const [initial, polled] of [
      ["confirming", "confirming"],
      ["settled", "settled"],
    ] as const) {
      const { page, close } = await mountInBrowser({
        entry: CRYPTO(initial),
        actions: { cryptoPaymentStatus: `async () => ({ ok: true, data: { ...window.__view, state: ${JSON.stringify(polled)} } })` },
      });
      try {
        if (initial === "confirming") await actionCalled(page, "cryptoPaymentStatus");
        await noSheet(page);
      } finally {
        await close();
      }
    }
  }, 20_000);
});

const PAY_PANEL = `
  import { mount } from "@/lib/testing/browser-root";
  import { PayPanel } from "@/app/(app)/checkout/[bookingId]/PayPanel";
  const view = { bookingId: "bk-1", listingId: "l-1", title: "Two-bedroom flat, Yaba", location: "Yaba, Lagos",
    checkIn: "2030-01-10", checkOut: "2030-01-12", dateRange: "Thu 10 Jan to Sat 12 Jan", nights: 2, guests: 2,
    lines: [], platformTakesNothing: true, currency: "NGN", locale: "en", totalMinor: 48500000, totalDisplay: "₦485,000.00",
    status: "PENDING", paid: false, holdExpiresAt: new Date(Date.now() + 3600000).toISOString(), holdExpired: false,
    cardAvailable: true, agreement: { id: "ag-1", status: "approved", reason: null } };
  const cards = [{ id: "33333333-3333-4333-8333-333333333333", cardType: "visa", last4: "4081", expMonth: 12, expYear: 2035,
    bank: "Test Bank", reusable: true, isDefault: true, createdAt: "2026-01-01T00:00:00Z" }];
  mount(<PayPanel view={view} savedCards={cards} plansAction={{ label: "See your stays", href: "/bookings" }}
    chargeSavedCard={(id) => window.__actions.charge(id)} />);
`;

async function payWithSavedCard(page: Page) {
  await page.getByRole("button", { name: "Pay with this card" }).first().click();
}

run("stay paid in the checkout panel (saved card)", () => {
  it("opens the receipt with amount and reference when the charge was applied, and refreshes only when it closes", async () => {
    const { page, close } = await mountInBrowser({
      entry: PAY_PANEL,
      actions: { charge: `async () => ({ ok: true, data: { kind: "charged", reference: "rm-book-sc-1", settled: true } })` },
    });
    try {
      await payWithSavedCard(page);
      await sheetOpens(page, "Stay paid");
      expect(await page.getByTestId("success-amount").textContent()).toContain("485,000");
      expect(await page.locator(".nf-success__mono").textContent()).toBe("rm-book-sc-1");
      /* A refresh now would re-render the page down its paid branch, which
         does not mount this panel, and take the receipt away. */
      await page.waitForTimeout(500);
      expect((await routerCalls(page)).filter((c) => c[0] === "refresh")).toEqual([]);
      expect(await page.locator(SHEET).count()).toBe(1);
      await page.getByTestId("success-primary").evaluate((el) => (el as HTMLElement).click());
      await page.waitForFunction(() =>
        ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).some((c) => c[0] === "refresh"),
        null,
        { timeout: 15_000 },
      );
    } finally {
      await close();
    }
  });

  it("shows 'Confirming your payment', never the receipt, when the charge is not yet applied", async () => {
    const { page, close } = await mountInBrowser({
      entry: PAY_PANEL,
      actions: { charge: `async () => ({ ok: true, data: { kind: "charged", reference: "rm-book-sc-2", settled: false } })` },
    });
    try {
      await payWithSavedCard(page);
      await page.getByText("Your card was charged and we are applying it", { exact: false }).waitFor({ timeout: 15_000 });
      await noSheet(page);
    } finally {
      await close();
    }
  });

  it("shows no receipt when the charge was refused", async () => {
    const { page, close } = await mountInBrowser({
      entry: PAY_PANEL,
      actions: { charge: `async () => ({ ok: false, error: "Your bank declined this card." })` },
    });
    try {
      await payWithSavedCard(page);
      await page.getByText("Payment not completed").first().waitFor({ timeout: 15_000 });
      await noSheet(page);
    } finally {
      await close();
    }
  });
});

/* --------------------------------------------------- viewings and more */

/*
 * MOMENTS 8 AND 9 MOVED INTO SCHEDULE A VISIT (13 October 2026).
 *
 * The request sheet and the slot panel each filed a viewing and opened their
 * own success sheet. Both now hand off to the two-step flow at
 * `/listing/[id]/visit`, which files through the same actions, and its status
 * screen IS the moment: "Request sent" for a request (never "booked" or
 * "confirmed"), "Visit confirmed" for an open time booked. That is driven for
 * real in `components/app/inspections/visit/visit-flow.dom.test.tsx`. What is
 * held here is the hand-off: neither old surface files anything or opens a
 * sheet any more, so a viewing cannot be filed two ways.
 */

const REQUEST = `
  import { mount } from "@/lib/testing/browser-root";
  import { AuthGateProvider } from "@/components/auth/AuthGate";
  import { RequestInspection } from "@/components/app/inspections/RequestInspection";
  import { getDictionary } from "@vallo/i18n";
  mount(<AuthGateProvider signedIn><RequestInspection listingId="l-1" existing={null} locale="en" copy={getDictionary("en").visit.entry} zone="Lagos time" /></AuthGateProvider>);
`;

const REQUESTED = `
  import { mount } from "@/lib/testing/browser-root";
  import { AuthGateProvider } from "@/components/auth/AuthGate";
  import { RequestInspection } from "@/components/app/inspections/RequestInspection";
  import { getDictionary } from "@vallo/i18n";
  mount(<AuthGateProvider signedIn><RequestInspection listingId="l-1" locale="en" copy={getDictionary("en").visit.entry} zone="Lagos time" existing={{ id: "ix-1", listingId: "l-1",
    listingTitle: null, state: "REQUESTED", requestedAt: "2030-01-15T09:00:00.000Z", slotAt: null, note: null, listerNote: null,
    createdAt: "2030-01-10T09:00:00.000Z", respondedAt: null, conversationId: null, counterpartName: null }} /></AuthGateProvider>);
`;

run("inspection requested", () => {
  it("is the door into Schedule a visit and files nothing itself", async () => {
    const { page, close } = await mountInBrowser({
      entry: REQUEST,
      actions: { requestInspection: `async () => ({ ok: true, data: { id: "ix-1" } })` },
    });
    try {
      const door = page.getByTestId("request-inspection");
      expect(await door.getAttribute("href")).toBe("/listing/l-1/visit");
      await door.click();
      await noSheet(page);
      expect(await page.evaluate(() => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).length)).toBe(0);
    } finally {
      await close();
    }
  });

  it("sends a renter who already asked to that visit's own status screen", async () => {
    const { page, close } = await mountInBrowser({ entry: REQUESTED });
    try {
      expect(await page.getByTestId("inspection-existing-link").getAttribute("href")).toBe("/listing/l-1/visit/ix-1");
      expect(await page.getByTestId("request-inspection").count()).toBe(0);
    } finally {
      await close();
    }
  });
});

const SLOTS = `
  import { mount } from "@/lib/testing/browser-root";
  import { getDictionary } from "@vallo/i18n";
  import { ViewingSlots } from "@/components/app/inspections/ViewingSlots";
  mount(<ViewingSlots listingId="l-1" locale="en" copy={getDictionary("en").frontDoor.viewings} success={getDictionary("en").success}
    slots={[{ slotAt: "2030-01-15T09:00:00.000Z", minutes: 30, windowId: "w1" }]} />);
`;

run("inspection (viewing) booked", () => {
  it("hands the chosen time to Schedule a visit and books nothing itself", async () => {
    const { page, close } = await mountInBrowser({ entry: SLOTS, actions: { bookViewingSlot: `async () => ({ ok: true, data: { id: "ix-9" } })` } });
    try {
      await page.getByTestId("viewing-slot").first().click();
      const next = page.getByTestId("viewing-slot-continue");
      expect(await next.getAttribute("href")).toBe(`/listing/l-1/visit?slot=${encodeURIComponent("2030-01-15T09:00:00.000Z")}`);
      await next.click();
      await noSheet(page);
      expect(await page.evaluate(() => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).length)).toBe(0);
    } finally {
      await close();
    }
  });
});

const DRAW = `
  import { mount } from "@/lib/testing/browser-root";
  import { DrawUpAgreement } from "@/components/app/agreements/DrawUpAgreement";
  mount(<DrawUpAgreement inspectionId="ix-1" minDate="2030-01-01" />);
`;

run("agreement drawn up", () => {
  it("sends the person to the agreement WITH the moment named on the ok path only", async () => {
    const ok = await mountInBrowser({ entry: DRAW, actions: { openRentAgreement: `async () => ({ ok: true, data: { agreementId: "ag-1" } })` } });
    try {
      await ok.page.getByTestId("draw-up-agreement").evaluate((form) => (form as HTMLFormElement).requestSubmit());
      await ok.page.waitForFunction(() =>
        ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).some((c) => c[0] === "push"),
      );
      expect((await routerCalls(ok.page)).find((c) => c[0] === "push")?.[1]).toBe("/agreements/ag-1?done=agreement-drawn");
    } finally {
      await ok.close();
    }
    const refused = await mountInBrowser({ entry: DRAW, actions: { openRentAgreement: `async () => ({ ok: false, error: "The report is not submitted yet." })` } });
    try {
      await refused.page.getByTestId("draw-up-agreement").evaluate((form) => (form as HTMLFormElement).requestSubmit());
      await refused.page.getByText("The report is not submitted yet.").waitFor();
      expect(await routerCalls(refused.page)).toEqual([]);
    } finally {
      await refused.close();
    }
  });
});

const CONFIRM = `
  import { mount } from "@/lib/testing/browser-root";
  import { ConfirmTerms } from "@/components/app/agreements/AgreementControls";
  mount(<ConfirmTerms agreementId="ag-1" version={2} />);
`;

run("agreement confirmed", () => {
  it("returns to the agreement with the moment named on ok, and stays put on a refusal", async () => {
    const ok = await mountInBrowser({
      entry: CONFIRM,
      url: "http://vallo.test/agreements/ag-1",
      actions: { confirmAgreement: `async () => ({ ok: true, data: { status: "in_review" } })` },
    });
    try {
      await ok.page.getByRole("checkbox").check();
      await ok.page.getByRole("button", { name: "Confirm these terms" }).click();
      /* The confirm panel (plan item 22): the same call, from its primary. */
      await ok.page.getByRole("dialog").getByRole("button", { name: "Confirm these terms" }).click();
      await ok.page.waitForFunction(() =>
        ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).some((c) => c[0] === "replace"),
      );
      expect((await routerCalls(ok.page)).find((c) => c[0] === "replace")?.[1]).toBe("/agreements/ag-1?done=agreement-confirmed");
    } finally {
      await ok.close();
    }
    const refused = await mountInBrowser({ entry: CONFIRM, actions: { confirmAgreement: `async () => ({ ok: false, error: "These terms changed." })` } });
    try {
      await refused.page.getByRole("checkbox").check();
      await refused.page.getByRole("button", { name: "Confirm these terms" }).click();
      await refused.page.getByRole("dialog").getByRole("button", { name: "Confirm these terms" }).click();
      await refused.page.getByText("These terms changed.").waitFor();
      expect((await routerCalls(refused.page)).filter((c) => c[0] === "replace")).toEqual([]);
    } finally {
      await refused.close();
    }
  });
});

const ARRIVAL = (show: boolean, seenKey?: string) => `
  import { mount } from "@/lib/testing/browser-root";
  import { getDictionary } from "@vallo/i18n";
  import { SuccessFromFlag } from "@/components/ui/SuccessFromFlag";
  mount(<SuccessFromFlag copy={getDictionary("en").success} show={${show}} moment="agreementDrawn" ${seenKey ? `seenKey=${JSON.stringify(seenKey)}` : ""} />);
`;

run("on arrival (agreement, listing and approval pages)", () => {
  it("opens when the page says the record backs the flag, and strips the flag", async () => {
    const { page, close } = await mountInBrowser({ entry: ARRIVAL(true), url: "http://vallo.test/agreements/ag-1?done=agreement-drawn" });
    try {
      await sheetOpens(page, "Agreement drawn up");
      expect((await routerCalls(page)).find((c) => c[0] === "replace")?.[1]).toBe("/agreements/ag-1");
    } finally {
      await close();
    }
  });

  it("does not open when the record does not back it", async () => {
    const { page, close } = await mountInBrowser({ entry: ARRIVAL(false), url: "http://vallo.test/agreements/ag-1?done=agreement-drawn" });
    try {
      await noSheet(page);
    } finally {
      await close();
    }
  });

  it("an approval opens once per device: it marks itself seen, and a seen one stays shut", async () => {
    const first = await mountInBrowser({ entry: ARRIVAL(true, "agreement-approved:ag-1") });
    try {
      await sheetOpens(first.page);
      expect(await first.page.evaluate(() => window.localStorage.getItem("nf-seen:agreement-approved:ag-1"))).toBe("1");
      /* No flag rode on this one, so there is nothing to strip. */
      expect((await routerCalls(first.page)).filter((c) => c[0] === "replace")).toEqual([]);
    } finally {
      await first.close();
    }
    const again = await mountInBrowser({
      entry: ARRIVAL(true, "agreement-approved:ag-1"),
      init: `window.localStorage.setItem("nf-seen:agreement-approved:ag-1", "1")`,
    });
    try {
      await noSheet(again.page);
    } finally {
      await again.close();
    }
  });
});

const REFUND = `
  import { mount } from "@/lib/testing/browser-root";
  import { getDictionary } from "@vallo/i18n";
  import { RefundRequestForm } from "@/components/app/after-gate/RefundRequestForm";
  mount(<RefundRequestForm success={getDictionary("en").success} bookingId="bk-1" copy={getDictionary("en").afterTheGate.refund} reasons={[{ code: "guest_choice", label: "My plans changed" }]} />);
`;

run("refund requested", () => {
  it("opens as requested (never refunded), and refreshes the page only when it closes", async () => {
    const { page, close } = await mountInBrowser({ entry: REFUND, actions: { requestRefund: `async () => ({ ok: true, data: null })` } });
    try {
      await page.getByTestId("refund-request").evaluate((form) => (form as HTMLFormElement).requestSubmit());
      /* The confirm panel (plan item 22) files the same ask from its primary. */
      await page.getByRole("dialog").getByRole("button", { name: "Ask for a refund" }).click();
      await sheetOpens(page, "Refund requested");
      expect((await routerCalls(page)).filter((c) => c[0] === "refresh")).toEqual([]);
      await page.getByTestId("success-primary").click();
      await page.waitForFunction(() =>
        ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).some((c) => c[0] === "refresh"),
      );
    } finally {
      await close();
    }
  });

  it("does not open when the ask is refused", async () => {
    const { page, close } = await mountInBrowser({ entry: REFUND, actions: { requestRefund: `async () => ({ ok: false, error: "This stay has not been paid." })` } });
    try {
      await page.getByTestId("refund-request").evaluate((form) => (form as HTMLFormElement).requestSubmit());
      /* The confirm panel (plan item 22) files the same ask from its primary. */
      await page.getByRole("dialog").getByRole("button", { name: "Ask for a refund" }).click();
      await page.getByText("This stay has not been paid.").waitFor();
      await noSheet(page);
    } finally {
      await close();
    }
  });
});

const TABLE = `
  import { mount } from "@/lib/testing/browser-root";
  import { getDictionary } from "@vallo/i18n";
  import { ReserveTable } from "@/app/(app)/listing/[id]/ReserveTable";
  mount(<ReserveTable listingId="l-1" success={getDictionary("en").success} copy={getDictionary("en").memberFlows} locale="en" />);
`;

/* Today's seatings can all have passed (the form never offers a past time,
   read on Lagos's clock), which disables the request in the evening; these
   tests ask for tomorrow, which always has times, so they never depend on
   the hour they run at. */
async function requestTomorrow(page: Page) {
  await page.getByRole("button", { name: "Tomorrow" }).click();
  await page.getByRole("button", { name: "Request a table" }).click();
}

run("table requested", () => {
  it("opens as a request sent, never as booked", async () => {
    const { page, close } = await mountInBrowser({ entry: TABLE, actions: { reserveTable: `async () => ({ ok: true, data: { reservationId: "r1", status: "PENDING" } })` } });
    try {
      await requestTomorrow(page);
      await sheetOpens(page, "Table request sent");
    } finally {
      await close();
    }
  });

  it("does not open when the restaurant cannot take it", async () => {
    const { page, close } = await mountInBrowser({ entry: TABLE, actions: { reserveTable: `async () => ({ ok: false, error: "The restaurant is closed that day." })` } });
    try {
      await requestTomorrow(page);
      await page.getByText("The restaurant is closed that day.").waitFor();
      await noSheet(page);
    } finally {
      await close();
    }
  });
});

const VNIN = `
  import { mount } from "@/lib/testing/browser-root";
  import { getDictionary } from "@vallo/i18n";
  import { VninPanel } from "@/components/verification/VninPanel";
  mount(<VninPanel copy={getDictionary("en").trustVisible.vnin} success={getDictionary("en").success} merchantCode="M1" />);
`;

async function sendVnin(page: Page) {
  await page.getByLabel("Virtual NIN").fill("AB1234567890CD");
  await page.getByRole("button", { name: "Confirm with NIMC" }).click();
}

run("identity matched (vNIN)", () => {
  it("opens only when the server says passed", async () => {
    const { page, close } = await mountInBrowser({ entry: VNIN, actions: { verifyIdentityWithVnin: `async () => ({ ok: true, data: { status: "passed", message: "Matched." } })` } });
    try {
      await sendVnin(page);
      await sheetOpens(page, "Identity matched");
    } finally {
      await close();
    }
  });

  it("does not open while NIMC is still answering, or on a refusal", async () => {
    for (const answer of [
      `{ ok: true, data: { status: "pending", message: "NIMC has not answered yet." } }`,
      `{ ok: false, error: "That vNIN has expired." }`,
    ]) {
      const { page, close } = await mountInBrowser({ entry: VNIN, actions: { verifyIdentityWithVnin: `async () => (${answer})` } });
      try {
        await sendVnin(page);
        await page.getByText(/NIMC has not answered yet|That vNIN has expired/).waitFor();
        await noSheet(page);
      } finally {
        await close();
      }
    }
  });
});

const CONTACT = `
  import { mount } from "@/lib/testing/browser-root";
  import { ContactForm } from "@/app/(site)/contact/ContactForm";
  mount(<ContactForm />);
`;

run("support ticket filed (contact form)", () => {
  it("opens with the reference on ok, and not on a refusal", async () => {
    const ok = await mountInBrowser({ entry: CONTACT, actions: { submitContactForm: `async () => ({ ok: true, data: { reference: "SUP-4821" } })` } });
    try {
      await ok.page.locator("form").first().evaluate((form) => {
        (form as HTMLFormElement).noValidate = true;
        (form as HTMLFormElement).requestSubmit();
      });
      await sheetOpens(ok.page, "Message sent");
      expect(await ok.page.locator(".nf-success__mono").textContent()).toBe("SUP-4821");
    } finally {
      await ok.close();
    }
    const refused = await mountInBrowser({ entry: CONTACT, actions: { submitContactForm: `async () => ({ ok: false, error: "Add a message." })` } });
    try {
      await refused.page.locator("form").first().evaluate((form) => {
        (form as HTMLFormElement).noValidate = true;
        (form as HTMLFormElement).requestSubmit();
      });
      await actionCalled(refused.page, "submitContactForm");
      await noSheet(refused.page);
    } finally {
      await refused.close();
    }
  });
});

const REPORT = `
  import { mount } from "@/lib/testing/browser-root";
  import { ReportSheet } from "@/components/app/ReportSheet";
  mount(<ReportSheet targetType="listing" targetId="l-1" targetLabel="Two-bedroom flat" signedIn />);
`;

run("report submitted", () => {
  it("opens once the report is on file, and not on a refusal", async () => {
    for (const [answer, opens] of [
      [`{ ok: true, data: { targetId: "l-1", category: "scam" } }`, true],
      [`{ ok: false, error: "Choose what is wrong." }`, false],
    ] as const) {
      const { page, close } = await mountInBrowser({ entry: REPORT, actions: { reportSomething: `async () => (${answer})` } });
      try {
        await page.getByTestId("report-opener").click();
        await page.getByTestId("report-sheet").waitFor();
        await page.locator('[data-testid="report-sheet"] form').evaluate((form) => {
          (form as HTMLFormElement).noValidate = true;
          (form as HTMLFormElement).requestSubmit();
        });
        if (opens) await sheetOpens(page, "Report received");
        else {
          await actionCalled(page, "reportSomething");
          await noSheet(page);
        }
      } finally {
        await close();
      }
    }
  });
});

/* ------------------------------------------------ the account moments */

const HOST = `
  import { mount } from "@/lib/testing/browser-root";
  import { SuccessFlagHost } from "@/components/ui/SuccessFlagHost";
  import { showSuccess } from "@/lib/ui/success-moments";
  window.__show = showSuccess;
  mount(<SuccessFlagHost />);
`;

run("account created, password changed, email verified, passcode set (the root layout's host)", () => {
  it("opens from the one-shot cookie the server set, asking the server for it", async () => {
    const { page, close } = await mountInBrowser({
      entry: HOST,
      init: `document.cookie = "nf_done_hint=1; path=/"`,
      actions: { consumeSuccess: `async () => "password-changed"` },
    });
    try {
      await page.waitForSelector('[data-testid="success-sheet-account"]', { timeout: 15_000 });
      expect(await page.getByRole("dialog", { name: "Password changed" }).count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("a forged hint gets nothing: the server answers from the HttpOnly cookie alone", async () => {
    const { page, close } = await mountInBrowser({
      entry: HOST,
      init: `document.cookie = "nf_done_hint=1; path=/"`,
      actions: { consumeSuccess: `async () => null` },
    });
    try {
      await actionCalled(page, "consumeSuccess");
      await page.waitForTimeout(800);
      expect(await page.locator('[data-testid="success-sheet-account"]').count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("does not open from ?done= (a forgeable link), strips it, and asks the server nothing", async () => {
    const { page, close } = await mountInBrowser({ entry: HOST, url: "http://vallo.test/about?done=password-changed&x=1" });
    try {
      await page.waitForFunction(() => window.location.search === "?x=1", null, { timeout: 15_000 });
      await page.waitForTimeout(800);
      expect(await page.locator('[data-testid="success-sheet-account"]').count()).toBe(0);
      expect(await page.evaluate(() => (window as unknown as { __calls?: unknown[] }).__calls ?? [])).toEqual([]);
    } finally {
      await close();
    }
  });

  it("opens from showSuccess (the passcode screen's call)", async () => {
    const { page, close } = await mountInBrowser({ entry: HOST });
    try {
      await page.evaluate(() => (window as unknown as { __show: (f: string) => void }).__show("passcode-set"));
      await page.waitForSelector('[data-testid="success-sheet-account"]', { timeout: 15_000 });
      expect(await page.getByRole("dialog", { name: "Passcode set" }).count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("refuses a record's moment through showSuccess: those are the record's page's to check", async () => {
    const { page, close } = await mountInBrowser({ entry: HOST });
    try {
      await page.evaluate(() => (window as unknown as { __show: (f: string) => void }).__show("listing-live"));
      await page.waitForTimeout(800);
      expect(await page.locator('[data-testid="success-sheet-account"]').count()).toBe(0);
    } finally {
      await close();
    }
  });
});

/* ---------------------------------------- the moment's own promises, per flow */

/*
 * Every account moment the host shows (passcode set and changed, account
 * ready, email confirmed, password changed): the right words, the right
 * object, and ONE primary pill that is a real 44px-or-taller target and
 * closes the moment. The account moments land wherever the person was going,
 * so their button is "Continue", which closes, rather than a link.
 */
run("the account moments' object and button, flow by flow", () => {
  it.each([
    ["passcode-set", "Passcode set", "passcode-lock"],
    ["passcode-changed", "Passcode changed", "passcode-lock"],
    ["account-created", "Welcome to Vallo", "celebrate"],
    ["email-verified", "Email confirmed", "envelope"],
    ["password-changed", "Password changed", "shield"],
  ] as const)("%s: %s, with its object and a Continue pill that closes it", async (flag, title, object) => {
    const { page, close } = await mountInBrowser({ entry: HOST });
    try {
      await page.evaluate((f) => (window as unknown as { __show: (f: string) => void }).__show(f), flag);
      const dialog = page.getByRole("dialog", { name: title });
      await dialog.waitFor({ timeout: 15_000 });
      expect(await page.locator(".nf-success__mark").getAttribute("data-object")).toBe(object);
      const primary = page.getByTestId("success-primary");
      expect(await primary.textContent()).toBe("Continue");
      expect(await primary.evaluate((el) => el.tagName)).toBe("BUTTON");
      expect(await page.getByTestId("success-secondary").count()).toBe(0);
      await primary.click();
      await page.waitForFunction(() => document.querySelector('[data-testid="success-sheet-account"]') === null);
    } finally {
      await close();
    }
  });
});

/* ---------------------------------------------------------- invitations */

const ADD_FLATMATE = `
  import { mount } from "@/lib/testing/browser-root";
  import { getDictionary } from "@vallo/i18n";
  import { AddFlatmate } from "@/components/app/tenancy/FlatmateControls";
  mount(<AddFlatmate tenancyId="11111111-1111-4111-8111-111111111111" copy={getDictionary("en").afterTheGate.flatmates} success={getDictionary("en").success} />);
`;

async function inviteFlatmate(page: Page): Promise<void> {
  const inputs = page.locator('[data-testid="flatmate-add"] input');
  await inputs.nth(0).fill("ada@example.com");
  await inputs.nth(1).fill("150000");
  await page.locator('[data-testid="flatmate-add"] button[type="submit"]').click();
}

run("flatmate invited to share a move-in", () => {
  it("opens 'Invitation sent' once the door took it, and refreshes only when it closes", async () => {
    const { page, close } = await mountInBrowser({
      entry: ADD_FLATMATE,
      actions: { addRentContributor: `async () => ({ ok: true, data: null })` },
    });
    try {
      await inviteFlatmate(page);
      await sheetOpens(page, "Invitation sent");
      expect(await page.locator(".nf-success__mark").getAttribute("data-object")).toBe("team");
      /* It says what happens next, and never that anybody agreed. */
      expect(await page.locator(".nf-success__body").textContent()).toContain("accept or decline");
      expect((await routerCalls(page)).filter((c) => c[0] === "refresh")).toHaveLength(0);
      await page.getByTestId("success-primary").click();
      await page.waitForFunction(() => (window as unknown as { __router: { calls: unknown[][] } }).__router.calls.some((c) => c[0] === "refresh"));
    } finally {
      await close();
    }
  });

  it("does not open when the door refuses", async () => {
    const { page, close } = await mountInBrowser({
      entry: ADD_FLATMATE,
      actions: { addRentContributor: `async () => ({ ok: false, error: "No Vallo account uses that email address." })` },
    });
    try {
      await inviteFlatmate(page);
      await page.getByText("No Vallo account uses that email address.").first().waitFor();
      await noSheet(page);
    } finally {
      await close();
    }
  });
});

const INVITE_AGENTS = `
  import { mount } from "@/lib/testing/browser-root";
  import { getDictionary } from "@vallo/i18n";
  import { InviteForm } from "@/app/agent/portfolio/PortfolioControls";
  mount(<InviteForm listingId="l-1" place="Flat 2, Yaba" copy={getDictionary("en").landlord.portfolio} />);
`;

async function inviteAgents(page: Page): Promise<void> {
  const inputs = page.locator("form input");
  await inputs.nth(0).fill("2000000");
  await inputs.nth(1).fill("2500000");
  await page.getByTestId("portfolio-invite").click();
}

run("agents invited to pitch (owner's portfolio)", () => {
  it("asks the portfolio for the moment, naming the unit, only when the database told somebody", async () => {
    const { page, close } = await mountInBrowser({
      entry: INVITE_AGENTS,
      url: "http://vallo.test/agent/portfolio",
      actions: { inviteAgents: `async () => ({ ok: true, data: { told: 3 } })` },
    });
    try {
      await inviteAgents(page);
      await page.waitForFunction(() => (window as unknown as { __router: { calls: unknown[][] } }).__router.calls.some((c) => c[0] === "replace"));
      const replaced = (await routerCalls(page)).filter((c) => c[0] === "replace");
      expect(replaced[0]?.[1]).toBe("/agent/portfolio?done=agents-invited&listing=l-1");
    } finally {
      await close();
    }
  });

  it("asks for nothing when nobody was told, or when it was refused", async () => {
    for (const answer of [`{ ok: true, data: { told: 0 } }`, `{ ok: false, error: "band" }`]) {
      const { page, close } = await mountInBrowser({
        entry: INVITE_AGENTS,
        actions: { inviteAgents: `async () => (${answer})` },
      });
      try {
        await inviteAgents(page);
        await actionCalled(page, "inviteAgents");
        await page.locator("form p[role]").waitFor();
        expect((await routerCalls(page)).filter((c) => c[0] === "replace")).toHaveLength(0);
      } finally {
        await close();
      }
    }
  });

  it("opens on arrival when the page found the invitation open on that unit", async () => {
    const { page, close } = await mountInBrowser({
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { getDictionary } from "@vallo/i18n";
        import { SuccessFromFlag } from "@/components/ui/SuccessFromFlag";
        mount(<SuccessFromFlag copy={getDictionary("en").success} show moment="agentsInvited" values={{ place: "Flat 2, Yaba" }} strip={["listing"]} />);
      `,
      url: "http://vallo.test/agent/portfolio?done=agents-invited&listing=l-1",
    });
    try {
      await sheetOpens(page, "Invitation sent");
      expect(await page.locator(".nf-success__body").textContent()).toContain("Flat 2, Yaba");
      const replaced = (await routerCalls(page)).filter((c) => c[0] === "replace");
      expect(replaced[0]?.[1]).toBe("/agent/portfolio");
    } finally {
      await close();
    }
  });
});
