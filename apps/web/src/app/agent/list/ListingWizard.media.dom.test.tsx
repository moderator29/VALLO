/**
 * The media step: photos and videos in one row, mounted in Chromium. The row
 * is rebuilt from the two tables (`mergeMedia`), a video can never become the
 * cover, a move is stored as one order (`reorderMedia`), and the count nudges
 * from the minimum (three) toward the recommendation (five).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

const CSS = productCss("app/css/inner-m.css", "app/css/flow-m.css", "app/css/grade1.css", "app/css/catalogue.css", "app/css/lister-publish.css", "app/agent/list/steps/listing-steps.css");

const ID = "00000000-0000-4000-8000-000000000001";
const P = (n: number) => `00000000-0000-4000-8000-0000000000a${n}`;
const V = "00000000-0000-4000-8000-0000000000b1";

function entry(photoCount: number, withVideo: boolean): string {
  return `
    import { mount } from "@/lib/testing/browser-root";
    import { getDictionary } from "@vallo/i18n";
    import { ListingWizard } from "@/app/agent/list/ListingWizard";
    import { AMENITY_CHOICES, STATE_CODES } from "@/lib/agent/listings-model";
    const t = getDictionary("en");
    const photos = Array.from({ length: ${photoCount} }, (_, i) => ({ id: "${P(0).slice(0, -1)}" + i, path: "u/l/" + i + ".jpg", url: "/p" + i + ".jpg", position: i }));
    const videos = ${withVideo} ? [{ id: "${V}", url: "/v.mp4", posterUrl: "/v.jpg", durationSeconds: 42, position: 1 }] : [];
    const DRAFT = {
      id: "${ID}", status: "DRAFT", title: "Bright 2 bedroom flat in Lekki Phase 1", description: "", propertyType: "rental",
      stateCode: "LA", city: "Lagos", area: "Lekki", address: "", landmark: "", bedrooms: 2, bathrooms: 2, toilets: "", parkingSpaces: "",
      floor: "", totalFloors: "", sizeSqm: "", intent: "rent", rentNaira: "", rentPeriod: "year", rentNegotiable: false,
      cautionDepositNaira: "", serviceChargeNaira: "", serviceChargePeriod: "year", agencyFeeNaira: "", legalFeeNaira: "",
      agreementFeeNaira: "", totalMoveInNaira: "", minimumTenancyMonths: "", availableFrom: "", furnished: "", rateNaira: "",
      ratePeriod: "", salePriceNaira: "", saleAgencyFeeNaira: "", saleLegalFeeNaira: "", governorsConsentFeeNaira: "",
      stampDutyNaira: "", surveyRegistrationFeeNaira: "", totalPurchaseNaira: "", priceNegotiable: false, tenure: "", saleStatus: "",
      yearBuilt: "", condition: "", powerGrid: "", powerBackup: "", powerBackupHours: "", waterSupply: "", prepaidMeter: false,
      access: { estateName: "", gateDirections: "", securityPhone: "", accessCode: "" },
      amenityCodes: ["wifi"], photos, videos, reviewNotes: null,
    };
    mount(
      <ListingWizard
        copy={t.agentListings} reference={t.listingReference} moveInCopy={t.moveIn}
        compoundCopy={t.shape.compound} serviceCopy={t.shape.service} unitCopy={t.shape.unit} floodCopy={t.shape.neighbours}
        locale="en" userId="00000000-0000-4000-8000-0000000000ff" states={STATE_CODES.map((code) => ({ code, name: code }))}
        amenities={AMENITY_CHOICES} initial={DRAFT} canPersist startAt="photos" initialFeePolicy={null}
      />,
    );
  `;
}

const kinds = (page: import("playwright-core").Page) =>
  page.locator(".nf-lw-shot").evaluateAll((els) => els.map((el) => el.getAttribute("data-kind")));

describe.runIf(hasBrowser)("photos and videos in one row", () => {
  it("rebuilds the row with the video where it was put, and never lets it become the cover", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry(3, true),
      css: CSS,
      actions: {
        reorderMedia: `async (input) => ({ ok: true, data: {
          photos: input.items.filter((i) => i.kind === "photo").map((i, n) => ({ id: i.id, path: "u/l/" + i.id.slice(-1) + ".jpg", position: n })),
          videos: input.items.map((i, n) => ({ ...i, position: n })).filter((i) => i.kind === "video").map((i) => ({ id: i.id, position: i.position })),
        } })`,
      },
    });
    try {
      expect(await kinds(page)).toEqual(["photo", "video", "photo", "photo"]);
      const tiles = page.locator(".nf-lw-shot");
      /* The cover cannot step back behind a video, and the video cannot step
         in front of the cover. */
      expect(await tiles.nth(0).getByRole("button", { name: "Move this item later" }).isDisabled()).toBe(true);
      expect(await tiles.nth(1).getByRole("button", { name: "Move this item earlier" }).isDisabled()).toBe(true);
      expect(await tiles.nth(1).innerText()).toContain("0:42");

      await tiles.nth(1).getByRole("button", { name: "Move this item later" }).click();
      await page.waitForFunction(() => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).some((c) => c[0] === "reorderMedia"));
      const sent = await page.evaluate(
        () => ((window as unknown as { __calls: unknown[][] }).__calls.find((c) => c[0] === "reorderMedia")![1]) as { items: { kind: string }[] },
      );
      expect(sent.items.map((i) => i.kind)).toEqual(["photo", "photo", "video", "photo"]);
      await page.waitForFunction(() => document.querySelectorAll('.nf-lw-shot')[2]?.getAttribute("data-kind") === "video");
      expect(await kinds(page)).toEqual(["photo", "photo", "video", "photo"]);
    } finally {
      await close();
    }
  });

  it("counts videos toward the three needed, and nudges toward five", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(2, true), css: CSS });
    try {
      const count = await page.locator('[data-testid="media-count"]').innerText();
      expect(count).toContain("3 of 3 needed");
      expect(count).toContain("Add 2 more for a stronger listing.");
    } finally {
      await close();
    }
  });

  it("takes videos in the same picker as photos", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(1, false), css: CSS });
    try {
      const accept = await page.locator('input[type="file"]').getAttribute("accept");
      expect(accept).toBe("image/*,video/mp4,video/quicktime,video/webm");
      expect(await page.locator('[data-testid="media-count"]').innerText()).not.toContain("stronger");
    } finally {
      await close();
    }
  });
});
