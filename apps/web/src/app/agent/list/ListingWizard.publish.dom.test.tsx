/**
 * Send for review, mounted in Chromium with the product's stylesheets and the
 * server actions staged (round 5, a lister publishing):
 *
 *   - one continuous space: the member card on the last step is the SAME
 *     element after the server accepts; the step's controls give way to the
 *     chain beneath it; no sheet, no other screen;
 *   - nothing turns until the server answers ok: while the action is pending
 *     the card still says Draft and nothing buzzes;
 *   - accepted is a medium, settled moment: one medium haptic, the card
 *     settles 16px into place without fading (380ms; no scale above 1
 *     anywhere, so no pop), the status word
 *     crossfades (240ms), the chain rises 60ms apart; the chain says the
 *     server's status words and the date the server wrote;
 *   - a refusal is immediate: said by the one top banner, one error pattern, no chain;
 *   - reduced motion tells the same story in 160ms fades.
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
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/inner-m.css", "app/css/flow-m.css", "app/css/catalogue.css", "app/css/lister-publish.css");

/* Every vibration the page asks for, in order (Android web's channel). */
const BUZZ = `Object.defineProperty(navigator, "vibrate", { configurable: true, value: (p) => { (window.__buzz = window.__buzz || []).push(p); return true; } });`;

/* The fee-gate test's complete tenancy (itself from the f5 harness), with its
   five scene photographs. Example content, never written anywhere. */
const ENTRY = `
  import { mount } from "@/lib/testing/browser-root";
  import { getDictionary } from "@vallo/i18n";
  import { ListingWizard } from "@/app/agent/list/ListingWizard";
  import { AMENITY_CHOICES, STATE_CODES } from "@/lib/agent/listings-model";
  import { SCENE_PHOTOGRAPHS } from "@/lib/listings/scene-photographs.generated";
  const t = getDictionary("en");
  const DRAFT = {
    id: "00000000-0000-4000-8000-000000000001", status: "DRAFT",
    title: "Bright 2 bedroom flat in Lekki Phase 1",
    description: "A bright two bedroom flat on a quiet street in Lekki Phase 1, with a fitted kitchen, a balcony off the sitting room and parking inside the compound. The estate is gated with security at the gate day and night.",
    propertyType: "rental", stateCode: "LA", city: "Lagos", area: "Lekki Phase 1", address: "12 Admiralty Way", landmark: "Opposite the Lekki roundabout",
    bedrooms: 3, bathrooms: 3, toilets: "4", parkingSpaces: "2", floor: "2", totalFloors: "5", sizeSqm: "150",
    intent: "rent", rentNaira: "1800000", rentPeriod: "year", rentNegotiable: true, cautionDepositNaira: "1800000",
    serviceChargeNaira: "150000", serviceChargePeriod: "month", agencyFeeNaira: "0", legalFeeNaira: "", agreementFeeNaira: "",
    totalMoveInNaira: "", minimumTenancyMonths: "12", availableFrom: "", furnished: "fully_furnished",
    rateNaira: "", ratePeriod: "", salePriceNaira: "", saleAgencyFeeNaira: "", saleLegalFeeNaira: "", governorsConsentFeeNaira: "",
    stampDutyNaira: "", surveyRegistrationFeeNaira: "", totalPurchaseNaira: "", priceNegotiable: false, tenure: "", saleStatus: "",
    yearBuilt: "2021", condition: "newly_built", powerGrid: "BAND_A", powerBackup: "GENERATOR", powerBackupHours: "6",
    waterSupply: "TREATED_MAINS", prepaidMeter: true,
    access: { estateName: "Alagomeji Court", gateDirections: "Second gate off Admiralty Way.", securityPhone: "", accessCode: "" },
    unit: { shape: "flat", ensuite: "", bq: "" },
    amenityCodes: ["wifi", "ac", "kitchen", "parking", "security", "generator", "water", "balcony"],
    photos: Object.entries(SCENE_PHOTOGRAPHS).slice(0, 5).map(([name, url], i) => ({ id: "preview-" + name, path: url, url, position: i })),
    videos: [], reviewNotes: null,
  };
  mount(
    <ListingWizard
      success={t.success} listerCopy={t.experienceLister}
      copy={t.agentListings} reference={t.listingReference} moveInCopy={t.moveIn}
      compoundCopy={t.shape.compound} serviceCopy={t.shape.service} unitCopy={t.shape.unit} floodCopy={t.shape.neighbours}
      locale="en" userId={null} states={STATE_CODES.map((code) => ({ code, name: code }))} amenities={AMENITY_CHOICES}
      initial={DRAFT} canPersist startAt={7} initialFeePolicy={null}
    />,
  );
`;

const SAVES = {
  saveDraft: `async () => ({ ok: true, data: { id: "00000000-0000-4000-8000-000000000001", status: "DRAFT" } })`,
  setAmenities: `async () => ({ ok: true, data: null })`,
  setListingAccess: `async () => ({ ok: true, data: { hasAccess: true } })`,
  fetchListerFeePolicy: `async () => null`,
};
/* The server's answer is held until the test releases it. */
const HELD = `() => new Promise((resolve) => { window.__answer = resolve; })`;
const ACCEPTED = `{ ok: true, data: { id: "00000000-0000-4000-8000-000000000001", status: "SUBMITTED", submittedAt: "2026-10-06T09:00:00.000Z" } }`;

type Motion = { name: string; duration: number; delay: number; frames: string[] };

async function motionsOf(page: Page, selector: string): Promise<Motion[]> {
  return page.evaluate(
    (selector) =>
      [...document.querySelectorAll(selector)].flatMap((el) =>
        el.getAnimations().map((a) => {
          const effect = a.effect as KeyframeEffect;
          return {
            name: (a as CSSAnimation).animationName,
            duration: Number(effect.getTiming().duration),
            delay: Number(effect.getTiming().delay),
            frames: effect.getKeyframes().map((f) => `${f.opacity ?? ""}|${f.transform ?? ""}`),
          };
        }),
      ),
    selector,
  );
}

const status = (page: Page) => page.locator('[data-testid="member-card-status"]').innerText();

async function sendAndHold(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __card: Element | null }).__card = document.querySelector('[data-testid="member-card"]');
  });
  await page.locator('[data-testid="listing-send"]').click();
  await page.waitForFunction(() => typeof (window as unknown as { __answer?: unknown }).__answer === "function");
}

describe.runIf(hasBrowser)("Send for review becomes the card in review, in place", () => {
  it("turns nothing until the server says ok, then keeps the same card and settles it", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: CSS, actions: { ...SAVES, submitListing: HELD }, init: BUZZ });
    try {
      expect(await status(page)).toBe("Draft");
      await sendAndHold(page);
      /* Pending: the server has not answered. */
      expect(await status(page)).toBe("Draft");
      expect(await page.locator('[data-testid="listing-chain"]').count()).toBe(0);
      expect(await page.evaluate(() => (window as unknown as { __buzz?: unknown[] }).__buzz ?? [])).toEqual([]);

      await page.evaluate(`window.__answer(${ACCEPTED})`);
      await page.waitForSelector('[data-testid="listing-chain"]');

      /* The same element: the card was never replaced. */
      expect(await page.evaluate(() => document.querySelector('[data-testid="member-card"]') === (window as unknown as { __card: Element }).__card)).toBe(true);
      expect(await status(page)).toBe("Submitted");
      expect(await page.locator('[data-testid="listing-send"]').count()).toBe(0);
      expect(await page.locator('[role="dialog"]').count()).toBe(0);
      /* The status words are the workspace's; the state is said in words too. */
      expect(await page.locator(".nf-lw-chain__name").allTextContents()).toEqual(["Submitted, Done", "Under review, Not yet", "Live, Not yet"]);
      const chain = await page.locator(".nf-lw-chain__row").allInnerTexts();
      expect(chain[0]).toContain("Received 6 Oct 2026");
      expect(chain[1]).toContain("24 to 48 hours");

      /* One medium beat, when the server accepted. Nothing heavy: nothing is live. */
      expect(await page.evaluate(() => (window as unknown as { __buzz: unknown[] }).__buzz)).toEqual([14]);

      const card = await motionsOf(page, ".nf-lw-publish__card");
      expect(card).toEqual([expect.objectContaining({ name: "nf-lw-land", duration: 380, delay: 0 })]);
      /* It was already on screen, so it settles and never fades. */
      expect(card[0]!.frames[0]).toBe("|translate3d(0px, 16px, 0px)");
      expect(await motionsOf(page, ".nf-lw-publish__status")).toEqual([expect.objectContaining({ name: "nf-lw-fade", duration: 240 })]);
      const rows = await motionsOf(page, ".nf-lw-chain__row");
      expect(rows.map((m) => [m.name, m.delay])).toEqual([["nf-lw-rise", 60], ["nf-lw-rise", 120], ["nf-lw-rise", 180]]);
      /* No pop anywhere on the page: no scale above 1 in any running keyframe. */
      const scales = await page.evaluate(() =>
        document.getAnimations().flatMap((a) =>
          (a.effect as KeyframeEffect).getKeyframes().flatMap((f) => [...String(f.transform ?? "").matchAll(/scale\(([\d.]+)/g)].map((m) => Number(m[1]))),
        ),
      );
      expect(scales.filter((s) => s > 1)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("says a refusal through the one banner, with one error pattern, and sends nothing on", async () => {
    const refused = `async () => ({ ok: false, error: "Some details need finishing before this can be reviewed. Each one is listed below.", fieldErrors: { photos: "Add at least 5 photos." } })`;
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: CSS, actions: { ...SAVES, submitListing: refused }, init: BUZZ });
    try {
      await page.locator('[data-testid="listing-send"]').click();
      /* The refusal is said by the one top banner now, not an inline note
         beside Send (ListingWizard banner conversion, 7 November 2026). */
      await page.getByText("Each one is listed below.").waitFor();
      expect(await page.evaluate(() => (window as unknown as { __buzz: unknown[] }).__buzz)).toEqual([[40, 60, 40, 60, 40]]);
      expect(await page.locator('[data-testid="listing-chain"]').count()).toBe(0);
      expect(await status(page)).toBe("Draft");
    } finally {
      await close();
    }
  });

  it("under reduced motion, the same story in 160ms fades, with no travel", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      css: CSS,
      actions: { ...SAVES, submitListing: HELD },
      init: BUZZ,
      reducedMotion: true,
    });
    try {
      await sendAndHold(page);
      await page.evaluate(`window.__answer(${ACCEPTED})`);
      await page.waitForSelector('[data-testid="listing-chain"]');
      /* The card holds still; the word and the chain fade. */
      expect(await motionsOf(page, ".nf-lw-publish__card")).toEqual([]);
      const all = await motionsOf(page, ".nf-lw-publish__status, .nf-lw-chain__row");
      expect(all.length).toBe(4);
      for (const m of all) {
        expect(m).toMatchObject({ name: "nf-lw-fade", duration: 160 });
        expect(m.frames.join(" ")).not.toMatch(/translate|scale/);
      }
    } finally {
      await close();
    }
  });
});
