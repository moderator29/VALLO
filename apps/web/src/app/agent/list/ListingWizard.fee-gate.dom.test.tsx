import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@vallo/i18n";
import type { WizardDraft } from "@/lib/agent/listings-queries";
import type { ListerFeePolicy } from "@/lib/money/lister-fee";
import { AMENITY_CHOICES, STATE_CODES } from "@/lib/agent/listings-model";
import { SCENE_PHOTOGRAPHS } from "@/lib/listings/scene-photographs.generated";
import { ClientCopyProvider } from "@/lib/i18n/client-copy";
import { clientCopyOf } from "@/lib/i18n/client-copy-of";

/* The wizard's server actions and router, stubbed: this draws the last step,
   it never saves or sends. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined, back: () => undefined }),
  usePathname: () => "/agent/list",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/agent/listings-actions", () => {
  const refused = async () => ({ ok: false, error: "stub" });
  return {
    addPhoto: refused,
    removePhoto: refused,
    reorderPhotos: refused,
    saveDraft: refused,
    setAmenities: refused,
    setListingAccess: refused,
    submitListing: refused,
  };
});
vi.mock("@/lib/money/lister-fee-actions", () => ({
  fetchListerFeePolicy: async () => null,
  recordListerFeeAcceptance: async () => ({ ok: false, error: "stub" }),
}));

import { ListingWizard } from "./ListingWizard";

const t = getDictionary("en");

/* A complete tenancy, derived from the f5 harness's RENTAL_DRAFT
   (app/(dev)/preview/f5/agent-list/page.tsx). Example content, never written
   anywhere. The rent is D61's worked example. */
const DRAFT: WizardDraft = {
  id: "00000000-0000-4000-8000-000000000001",
  status: "DRAFT",
  title: "Bright 2 bedroom flat in Lekki Phase 1",
  description:
    "A bright two bedroom flat on a quiet street in Lekki Phase 1, with a fitted kitchen, a balcony off the sitting room and parking inside the compound. The estate is gated with security at the gate day and night.",
  propertyType: "rental",
  stateCode: "LA",
  city: "Lagos",
  area: "Lekki Phase 1",
  address: "12 Admiralty Way",
  landmark: "Opposite the Lekki roundabout",
  bedrooms: 3,
  bathrooms: 3,
  toilets: "4",
  parkingSpaces: "2",
  floor: "2",
  totalFloors: "5",
  sizeSqm: "150",
  intent: "rent",
  rentNaira: "1800000",
  rentPeriod: "year",
  rentNegotiable: true,
  cautionDepositNaira: "1800000",
  serviceChargeNaira: "150000",
  serviceChargePeriod: "month",
  agencyFeeNaira: "0",
  legalFeeNaira: "",
  agreementFeeNaira: "",
  totalMoveInNaira: "",
  minimumTenancyMonths: "12",
  availableFrom: "",
  furnished: "fully_furnished",
  rateNaira: "",
  ratePeriod: "",
  salePriceNaira: "",
  saleAgencyFeeNaira: "",
  saleLegalFeeNaira: "",
  governorsConsentFeeNaira: "",
  stampDutyNaira: "",
  surveyRegistrationFeeNaira: "",
  totalPurchaseNaira: "",
  priceNegotiable: false,
  tenure: "",
  saleStatus: "",
  yearBuilt: "2021",
  condition: "newly_built",
  powerGrid: "BAND_A",
  powerBackup: "GENERATOR",
  powerBackupHours: "6",
  waterSupply: "TREATED_MAINS",
  prepaidMeter: true,
  access: {
    estateName: "Alagomeji Court",
    gateDirections: "Second gate off Admiralty Way. Tell security you are visiting flat 4B.",
    securityPhone: "",
    accessCode: "",
  },
  /* The shape is answered, so the only thing that could hold Send for review
     here is the fee gate. */
  unit: { shape: "flat", ensuite: "", bq: "" },
  amenityCodes: ["wifi", "ac", "kitchen", "parking", "security", "generator", "water", "balcony"],
  photos: Object.entries(SCENE_PHOTOGRAPHS)
    .slice(0, 5)
    .map(([name, url], i) => ({ id: `preview-${name}`, path: url, url, position: i })),
  videos: [],
  reviewNotes: null,
} as WizardDraft;

/* D61's worked example as a policy row: a test value, not a read. */
const POLICY: ListerFeePolicy = { rateVersion: "v-test", valloBps: 200, escrowProtectionBps: 200, directProcessorFeeCapMinor: 0, capMinor: null };

function lastStep(feeGateBlocking: boolean | undefined, initialFeePolicy: ListerFeePolicy | null = POLICY): string {
  /* Inside the root layout's copy provider, as it is in the app. */
  return renderToStaticMarkup(
    <ClientCopyProvider copy={clientCopyOf(t)}>
    <ListingWizard
      copy={t.agentListings}
      reference={t.listingReference}
      moveInCopy={t.moveIn}
      compoundCopy={t.shape.compound}
      serviceCopy={t.shape.service}
      unitCopy={t.shape.unit}
      floodCopy={t.shape.neighbours}
      locale="en"
      userId={null}
      states={STATE_CODES.map((code) => ({ code, name: code }))}
      amenities={AMENITY_CHOICES}
      initial={DRAFT}
      canPersist={false}
      startAt="check"
      {...(feeGateBlocking === undefined ? {} : { feeGateBlocking })}
      initialFeePolicy={initialFeePolicy}
    />
    </ClientCopyProvider>,
  );
}

/** The Send for review button's opening tag. */
function sendButton(html: string): string {
  const match = html.match(/<button[^>]*data-testid="listing-send"[^>]*>/);
  expect(match).not.toBeNull();
  return match![0];
}

describe("the listing wizard reaches the fee screen before Send for review (D60)", () => {
  it("draws the screen above Send for review, with the flag off by default", () => {
    const html = lastStep(undefined);
    expect(html).toContain('data-testid="fee-gate"');
    expect(html).toContain('data-mode="preview"');
    expect(html.indexOf('data-testid="fee-gate"')).toBeLessThan(html.indexOf('data-testid="listing-send"'));
    expect(html).toMatch(/nf-feegate__headline">₦1,728,000</);
  });

  it("with the flag off, does not block: Send for review is enabled with nothing accepted, and no accept is offered", () => {
    const html = lastStep(false);
    expect(sendButton(html)).not.toMatch(/\sdisabled/);
    expect(html).not.toContain("fee-gate-accept");
    expect(html).toContain("Nothing is recorded yet.");
  });

  it("with the flag off and the rates unreadable, still does not block", () => {
    const html = lastStep(false, null);
    expect(html).toContain('data-state="unreadable"');
    expect(sendButton(html)).not.toMatch(/\sdisabled/);
  });

  it("with the flag on, blocks Send for review until the figures are accepted", () => {
    const html = lastStep(true);
    expect(html).toContain('data-mode="blocking"');
    expect(html).toContain("fee-gate-accept");
    expect(sendButton(html)).toMatch(/\sdisabled/);
  });
});

describe("the page hands the wizard the flag, read fail closed", () => {
  it("reads lister_fee_gate_blocking through lib/flags/read.ts", () => {
    const page = readFileSync(fileURLToPath(new URL("./page.tsx", import.meta.url)), "utf8");
    expect(page).toMatch(/feeGateBlocking=\{await flagIsOn\(LISTER_FEE_GATE_BLOCKING_FLAG\)\}/);
  });
});
