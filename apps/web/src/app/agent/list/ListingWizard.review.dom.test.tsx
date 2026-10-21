/**
 * The listing wizard's way back from its last two steps, its save of an
 * emptied box, and its second try at a photo, mounted in Chromium:
 *
 *   - every open line of the send checklist names the market it is in and
 *     carries an Edit that lands on the step owning the fix, with one tap
 *     back to where the lister was;
 *   - Condition's Edit on "Check it over" lands on the first step, where the
 *     question is asked (it went to the price step, which does not ask it);
 *   - a box the lister emptied is saved as null, which the action reads as
 *     "clear the column", and a stated zero fee is saved as zero;
 *   - a photo that did not upload for a reason a second try can fix is kept,
 *     and "Try again" sends that same file again.
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

/* The publish test's complete tenancy. Example content, never written. */
const DRAFT = `{
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
}`;

/* A sale above the old 100m naira ceiling, with no title deed chosen yet. */
const SALE = `{ ...${DRAFT}, propertyType: "home", intent: "sale", salePriceNaira: "380000000", saleStatus: "available", unit: { shape: "detached", ensuite: "", bq: "" } }`;

function entry(draft: string, props: string): string {
  return `
    import { mount } from "@/lib/testing/browser-root";
    import { getDictionary } from "@vallo/i18n";
    import { ListingWizard } from "@/app/agent/list/ListingWizard";
    import { AMENITY_CHOICES, STATE_CODES } from "@/lib/agent/listings-model";
    import { SCENE_PHOTOGRAPHS } from "@/lib/listings/scene-photographs.generated";
    const t = getDictionary("en");
    mount(
      <ListingWizard
        success={t.success} listerCopy={t.experienceLister}
        copy={t.agentListings} reference={t.listingReference} moveInCopy={t.moveIn}
        compoundCopy={t.shape.compound} serviceCopy={t.shape.service} unitCopy={t.shape.unit} floodCopy={t.shape.neighbours}
        locale="en" states={STATE_CODES.map((code) => ({ code, name: code }))} amenities={AMENITY_CHOICES}
        initial={${draft}} initialFeePolicy={null} ${props}
      />,
    );
  `;
}

const SAVES = {
  saveDraft: `async () => ({ ok: true, data: { id: "00000000-0000-4000-8000-000000000001", status: "DRAFT" } })`,
  setAmenities: `async () => ({ ok: true, data: null })`,
  setListingAccess: `async () => ({ ok: true, data: { hasAccess: true } })`,
  fetchListerFeePolicy: `async () => null`,
};

const title = (page: Page) => page.locator(".nf-lw-head__title").innerText();

async function titleBecomes(page: Page, text: string): Promise<void> {
  await page.waitForFunction((want) => document.querySelector(".nf-lw-head__title")?.textContent === want, text);
}

describe.runIf(hasBrowser)("the wizard's way back, its save of an emptied box, and its second try", () => {
  it("names the market on the open price line, and its Edit goes to the price step and back", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry(SALE, `userId={null} canPersist={false} startAt={7}`),
      css: CSS,
    });
    try {
      expect(await page.locator('[data-testid="send-title"]').innerText()).toBe("A few things before you send");
      const line = page.locator('[data-testid="send-check-price"]');
      expect(await line.innerText()).toContain("Asking price and title deed");
      expect(await line.getAttribute("data-met")).toBeNull();
      /* A met line carries no Edit. */
      expect(await page.locator('[data-testid="send-check-title"] button').count()).toBe(0);

      await line.getByRole("button", { name: "Edit: Asking price and title deed" }).click();
      await titleBecomes(page, "The price");
      const back = page.locator('[data-testid="wizard-return"]');
      expect(await back.innerText()).toContain("Back to Submit");

      await back.click();
      await titleBecomes(page, "Send it for review");
      expect(await page.locator('[data-testid="wizard-return"]').count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("sends Condition's Edit to the first step, where the question is", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry(DRAFT, `userId={null} canPersist={false} startAt={6}`),
      css: CSS,
    });
    try {
      expect(await title(page)).toBe("Check it over");
      await page.getByRole("button", { name: "Edit: Condition" }).click();
      await titleBecomes(page, "What are you listing?");
      expect(await page.locator('[data-testid="wizard-return"]').innerText()).toContain("Back to Guest view");
    } finally {
      await close();
    }
  });

  it("saves an emptied box as null and a stated zero fee as zero", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry(DRAFT, `userId="00000000-0000-4000-8000-0000000000aa" canPersist startAt={2}`),
      css: CSS,
      actions: SAVES,
    });
    try {
      expect(await title(page)).toBe("Where is it?");
      await page.locator('input[placeholder="Opposite the Lekki roundabout"]').fill("");
      await page.locator(".fixed button", { hasText: "Next" }).click();
      await page.waitForFunction(() =>
        ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).some((call) => call[0] === "saveDraft"),
      );
      const sent = await page.evaluate(
        () =>
          ((window as unknown as { __calls: unknown[][] }).__calls.find((call) => call[0] === "saveDraft")![1]) as Record<
            string,
            unknown
          >,
      );
      expect(sent.landmark).toBeNull();
      expect(sent.legalFeeNaira).toBeNull();
      expect(sent.agencyFeeNaira).toBe("0");
      expect(sent.area).toBe("Lekki Phase 1");
    } finally {
      await close();
    }
  });

  it("keeps a photo whose upload dropped, and Try again sends that same file", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry(DRAFT, `userId="00000000-0000-4000-8000-0000000000aa" canPersist startAt={1}`),
      css: CSS,
      actions: {
        ...SAVES,
        addPhoto: `async () => ({ ok: true, data: { photoId: "00000000-0000-4000-8000-0000000000p6", position: 5 } })`,
      },
      /* A secure origin, so the browser lends the wizard crypto.randomUUID. */
      url: "http://localhost/",
    });
    try {
      const before = await page.locator(".nf-lw-shot").count();
      /* A 1600 by 1200 photograph, chosen through the real file input. The
         harness's storage client has no upload, which is a dropped upload. */
      await page.evaluate(async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1600;
        canvas.height = 1200;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "seagreen";
        context.fillRect(0, 0, 1600, 1200);
        const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), "image/png"));
        const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
        const files = new DataTransfer();
        files.items.add(new File([blob], "sitting-room.png", { type: "image/png" }));
        input.files = files.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForSelector('[data-testid="photo-retry"]');
      expect(await page.locator('[data-testid="photo-problems"]').innerText()).toContain(
        "sitting-room.png: That photo did not finish uploading.",
      );

      /* The connection comes back: storage takes the file this time. */
      await page.evaluate(() => {
        Object.defineProperty(Object.prototype, "upload", { value: async () => ({ error: null }), configurable: true, writable: true });
        Object.defineProperty(Object.prototype, "getPublicUrl", {
          value: () => ({ data: { publicUrl: "http://localhost/sitting-room.jpg" } }),
          configurable: true,
          writable: true,
        });
      });
      await page.locator('[data-testid="photo-retry"]').click();
      await page.waitForFunction((count) => document.querySelectorAll(".nf-lw-shot").length === count + 1, before);
      expect(await page.locator('[data-testid="photo-retry"]').count()).toBe(0);
      expect(await page.locator('[data-testid="photo-problems"]').count()).toBe(0);
      const attached = await page.evaluate(
        () => ((window as unknown as { __calls: unknown[][] }).__calls ?? []).filter((call) => call[0] === "addPhoto").length,
      );
      expect(attached).toBe(1);
    } finally {
      await close();
    }
  });
});
