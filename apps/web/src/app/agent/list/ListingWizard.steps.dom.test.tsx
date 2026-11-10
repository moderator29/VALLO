/**
 * The listing wizard's step changes, one question per screen on the shared
 * StepFrame (P1.1), mounted in Chromium with the product's stylesheets and
 * read from computed animations, not a clock:
 *
 *   - Continue slides the next question in from the right, at base (240ms),
 *     by transform and opacity only; Back brings the previous one in from the
 *     left (the travel direction the wizard has always had);
 *   - the progress bar moves on transform;
 *   - reduced motion: the question simply changes, nothing travels;
 *   - a refused title (the Finish step) shakes its field once, 4px at whip,
 *     takes the focus and says why.
 *
 * Rewritten for the re-flow: the old version read the wizard's own rail
 * segments and head classes, which the StepFrame replaced.
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

const CSS = productCss(
  "app/css/inner-m.css",
  "app/css/flow-m.css",
  "app/css/grade1.css",
  "app/css/catalogue.css",
  "app/css/lister-publish.css",
  "app/agent/list/steps/listing-steps.css",
);

/* A complete tenancy, derived from ListingWizard.fee-gate.dom.test.tsx's
   DRAFT (itself from the f5 harness). Example content, never written. */
const ENTRY = `
  import { mount } from "@/lib/testing/browser-root";
  import { getDictionary } from "@vallo/i18n";
  import { ListingWizard } from "@/app/agent/list/ListingWizard";
  import { AMENITY_CHOICES, STATE_CODES } from "@/lib/agent/listings-model";
  const t = getDictionary("en");
  const DRAFT = {
    id: "00000000-0000-4000-8000-000000000001", status: "DRAFT",
    title: "Bright 2 bedroom flat in Lekki Phase 1",
    description: "A bright two bedroom flat on a quiet street in Lekki Phase 1, with a fitted kitchen, a balcony off the sitting room and parking inside the compound. The estate is gated with security at the gate day and night.",
    propertyType: "rental", stateCode: "LA", city: "Lagos", area: "Lekki Phase 1", address: "12 Admiralty Way", landmark: "",
    bedrooms: 3, bathrooms: 3, toilets: "4", parkingSpaces: "2", floor: "2", totalFloors: "5", sizeSqm: "150",
    intent: "rent", rentNaira: "1800000", rentPeriod: "year", rentNegotiable: true, cautionDepositNaira: "1800000",
    serviceChargeNaira: "150000", serviceChargePeriod: "month", agencyFeeNaira: "0", legalFeeNaira: "", agreementFeeNaira: "",
    totalMoveInNaira: "", minimumTenancyMonths: "12", availableFrom: "", furnished: "fully_furnished",
    rateNaira: "", ratePeriod: "", salePriceNaira: "", saleAgencyFeeNaira: "", saleLegalFeeNaira: "", governorsConsentFeeNaira: "",
    stampDutyNaira: "", surveyRegistrationFeeNaira: "", totalPurchaseNaira: "", priceNegotiable: false, tenure: "", saleStatus: "",
    yearBuilt: "2021", condition: "newly_built", powerGrid: "BAND_A", powerBackup: "GENERATOR", powerBackupHours: "6",
    waterSupply: "TREATED_MAINS", prepaidMeter: true,
    access: { estateName: "", gateDirections: "", securityPhone: "", accessCode: "" },
    unit: { shape: "flat", ensuite: "", bq: "" },
    amenityCodes: ["wifi", "ac", "kitchen", "parking"], photos: [], videos: [], reviewNotes: null,
  };
  mount(
    <ListingWizard
      copy={t.agentListings} reference={t.listingReference} moveInCopy={t.moveIn}
      compoundCopy={t.shape.compound} serviceCopy={t.shape.service} unitCopy={t.shape.unit} floodCopy={t.shape.neighbours}
      locale="en" userId={null} states={STATE_CODES.map((code) => ({ code, name: code }))} amenities={AMENITY_CHOICES}
      initial={DRAFT} canPersist={false} startAt="location"
    />,
  );
`;

type Motion = { kind: string; name: string; duration: number; frames: string[] };
type Read = { title: string; page: Motion[]; fill: Motion[] };

/* Taps Continue or Back and, in the frame the new question first renders,
   reads the animations on the question's page and on the progress fill. */
async function stepAndRead(page: Page, which: "continue" | "back"): Promise<Read> {
  return page.evaluate(async (which) => {
    const title = () => document.querySelector(".nf-g1step__title")?.textContent ?? "";
    const before = title();
    const button =
      which === "continue"
        ? document.querySelector<HTMLButtonElement>('[data-testid="step-continue"]')
        : document.querySelector<HTMLButtonElement>('.nf-g1step__bar button[aria-label="Back"]');
    button!.click();
    await new Promise<void>((done) => {
      const tick = () => (title() !== before ? done() : requestAnimationFrame(tick));
      tick();
    });
    const describe = (a: Animation): Motion => {
      const effect = a.effect as KeyframeEffect;
      return {
        kind: a instanceof CSSTransition ? "transition" : "animation",
        name: a instanceof CSSAnimation ? a.animationName : (a as CSSTransition).transitionProperty,
        duration: Number(effect.getTiming().duration),
        frames: effect.getKeyframes().map((f) => `${f.opacity ?? ""}|${f.transform ?? ""}|${(f as Record<string, unknown>).filter ?? ""}`),
      };
    };
    const on = (el: Element | null) =>
      document.getAnimations().filter((a) => (a.effect as KeyframeEffect).target === el).map(describe);
    return {
      title: title(),
      page: on(document.querySelector(".nf-g1step__page")),
      fill: on(document.querySelector(".nf-g1step__progress-fill")),
    };
  }, which) as Promise<Read>;
}

describe.runIf(hasBrowser)("the wizard's step changes", () => {
  it("slides the next question in from the right at base, and the last one back from the left", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: CSS });
    try {
      expect(await page.locator(".nf-g1step__title").innerText()).toBe("Where is the property?");
      expect(await page.locator(".nf-g1step__eyebrow").innerText()).toMatch(/location/i);

      const next = await stepAndRead(page, "continue");
      expect(next.title).toBe("How many rooms does it have?");
      expect(next.page).toEqual([expect.objectContaining({ name: "nf-g1-step-in", duration: 240 })]);
      /* Transform and opacity only, from the right (forward). */
      expect(next.page[0]!.frames.join(" ")).not.toMatch(/blur/);
      expect(next.page[0]!.frames[0]).toMatch(/^0\|translate3d\(24px, 0px, 0px\)/);
      /* The bar moves on transform. */
      expect(next.fill).toEqual([expect.objectContaining({ kind: "transition", name: "transform" })]);

      await page.waitForTimeout(500);
      const back = await stepAndRead(page, "back");
      expect(back.title).toBe("Where is the property?");
      expect(back.page).toEqual([expect.objectContaining({ name: "nf-g1-step-in-back", duration: 240 })]);
      expect(back.page[0]!.frames[0]).toMatch(/^0\|translate3d\(-24px, 0px, 0px\)/);
    } finally {
      await close();
    }
  });

  it("keeps the field being typed in focused from one keystroke to the next", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: CSS });
    try {
      const input = page.locator('input[placeholder="Lagos"]');
      await input.click();
      await page.keyboard.type("ab");
      /* Every letter lands: the frame re-renders on each one and must not
         take the focus with it (see steps/FocusKeeper.tsx). */
      expect(await input.inputValue()).toBe("Lagosab");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("placeholder"))).toBe("Lagos");
    } finally {
      await close();
    }
  });

  it("under reduced motion, the question simply changes: nothing travels", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: CSS, reducedMotion: true });
    try {
      const next = await stepAndRead(page, "continue");
      expect(next.title).toBe("How many rooms does it have?");
      expect(next.page).toEqual([]);
      expect(next.fill.every((m) => m.duration <= 1)).toBe(true);
    } finally {
      await close();
    }
  });

  it("a refused title shakes its field once, 4px at whip, and says why", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY.replace('title: "Bright 2 bedroom flat in Lekki Phase 1"', 'title: ""').replace('startAt="location"', 'startAt="describe"'),
      css: CSS,
    });
    try {
      expect(await page.locator(".nf-g1step__title").innerText()).toBe("Describe the property");
      const shake = await page.evaluate(async () => {
        document.querySelector<HTMLButtonElement>('[data-testid="step-continue"]')!.click();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const field = document.getElementById("listing-title-field")!;
        return {
          motions: field.getAnimations().map((a) => ({
            name: (a as CSSAnimation).animationName,
            duration: Number(a.effect!.getTiming().duration),
            easing: getComputedStyle(field).animationTimingFunction,
          })),
          focused: document.activeElement === field.querySelector("input"),
          still: document.querySelector(".nf-g1step__title")?.textContent,
        };
      });
      expect(shake.motions).toEqual([{ name: "nf-lw-shake", duration: 160, easing: "cubic-bezier(0.7, 0, 0.2, 1)" }]);
      expect(shake.focused).toBe(true);
      expect(shake.still).toBe("Describe the property");
    } finally {
      await close();
    }
  });
});
