/**
 * A REFUSED SAVE TAKES THE LISTER TO THE BOX IT NAMED (22 November 2026).
 *
 * Every Continue saves the draft, and a refused save holds the lister in
 * place. When the refused box was on another screen (a pasted broadcast's
 * move-in total below its own parts, refused on the first screen), every
 * Continue on the first screen was refused again for a box the lister could
 * not reach: the agent sign-up NIN, in the listing wizard. Now the wizard
 * goes to the step that owns the box, shows the sentence there, and once the
 * box is fixed Continue takes the lister back to where they were heading.
 *
 * Example content only; the actions are staged in the page.
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

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

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
      initial={DRAFT} canPersist startAt="kind" initialFeePolicy={null}
    />,
  );
`;

const REFUSAL = "The parts you have entered already come to 3,600,000. The total has to be at least that.";
const ACTIONS = {
  /* Refused while the page says so, for the total on the charges step. */
  saveDraft: `async () => window.__refuse
    ? { ok: false, error: "The total to move in is less than the fees you listed, so one of the two figures is wrong.", fieldErrors: { totalMoveInNaira: ${JSON.stringify(REFUSAL)} } }
    : { ok: true, data: { id: "00000000-0000-4000-8000-000000000001", status: "DRAFT" } }`,
  setAmenities: `async () => ({ ok: true, data: null })`,
  setListingAccess: `async () => ({ ok: true, data: { hasAccess: true } })`,
  fetchListerFeePolicy: `async () => null`,
};

const stepOn = (page: Page) => page.locator(".nf-lw-wizard").getAttribute("data-step");
const waitStep = (page: Page, id: string) =>
  page.waitForFunction((id) => document.querySelector(".nf-lw-wizard")?.getAttribute("data-step") === id, id);

describe.runIf(hasBrowser)("a refused save names a box on another step", () => {
  it("goes to the step that owns the box, then Continue returns to where the lister was heading", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, actions: ACTIONS, init: "window.__refuse = true;" });
    try {
      expect(await stepOn(page)).toBe("kind");
      await page.locator('[data-testid="step-continue"]').click();
      await waitStep(page, "charges");
      expect(await page.content()).toContain(REFUSAL);
      /* Fixed (the server now accepts): Continue goes back to the step after the first. */
      await page.evaluate(() => {
        (window as unknown as { __refuse: boolean }).__refuse = false;
      });
      await page.locator('[data-testid="step-continue"]').click();
      await waitStep(page, "type");
    } finally {
      await close();
    }
  });

  it("still holds the lister in place when the refused box is on the screen they are on", async () => {
    const entry = ENTRY.replace('startAt="kind"', 'startAt="charges"');
    const { page, close } = await mountInBrowser({ entry, actions: ACTIONS, init: "window.__refuse = true;" });
    try {
      expect(await stepOn(page)).toBe("charges");
      await page.locator('[data-testid="step-continue"]').click();
      await page.waitForFunction(() => document.body.innerHTML.includes("already come to"));
      expect(await stepOn(page)).toBe("charges");
    } finally {
      await close();
    }
  });
});
