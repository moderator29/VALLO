import { describe, expect, it } from "vitest";
import {
  CAC_NUMBER_RE,
  CONSENTS,
  DOCUMENT_SPECS,
  documentPathBelongsTo,
  emptyHostDraft,
  mergeServerDraft,
  missingFrom,
  progressLabel,
  rejectFile,
  stepsFor,
  type HostDraft,
} from "./onboarding";
import { HOST_AGREEMENT_VERSION, PAY_ON_VALLO_VERSION } from "../legal/versions";

/**
 * The host wizard's model, pinned.
 *
 * Two things here decide what a person SEES: how many steps they are told
 * they have, and what the review screen prints as missing. Both branch on
 * the host type, and a branch that quietly drops a step or a blocking rule is
 * how a restaurant ends up on the shelf with no service window.
 */
function complete(over: Partial<HostDraft> = {}): HostDraft {
  return {
    ...emptyHostDraft(),
    hostType: "individual",
    kind: "shortlet_operator",
    name: "Ada's Place",
    phone: "+2348031234567",
    address: "12 Admiralty Way",
    city: "Lagos",
    stateCode: "LA",
    representativeName: "Ada Obi",
    representativePhone: "+2348031234567",
    documents: { identity: true },
    accommodation: {
      id: "a",
      name: "Ada's Place",
      hasPin: true,
      photos: [
        { id: "p1", url: "/brand/photos/bedroom-01.jpg" },
        { id: "p2", url: "/brand/photos/bedroom-02.jpg" },
        { id: "p3", url: "/brand/photos/bedroom-03.jpg" },
      ],
      facilities: ["wifi", "generator"],
      starRating: null,
      checkInFrom: "14:00",
      checkOutBy: "11:00",
      houseRules: "",
      cancellationPolicyId: null,
    },
    roomTypeCount: 1,
    ratePlanCount: 1,
    roomTypes: [
      {
        id: "rt1",
        name: "The whole flat",
        sleeps: 4,
        unitsTotal: 1,
        rateCount: 1,
        category: "entire_flat",
        baseRateMinor: 8_500_000,
        rates: [{ id: "rp1", name: "Room only", mealPlan: "room_only", rateMinor: 8_500_000 }],
        beds: { bedrooms: 2, beds: 3 },
      },
    ],
    hasBankAccount: true,
    consents: {
      accuracy: "2026-09-18T08:00:00Z",
      terms: "2026-09-18T08:00:00Z",
      processing: "2026-09-18T08:00:00Z",
    },
    hostAgreementVersion: HOST_AGREEMENT_VERSION,
    payOnValloVersion: PAY_ON_VALLO_VERSION,
    arrivalCharges: {
      caution: { minor: 5_000_000, per: "stay" },
      power: { none: true },
      cleaning: { none: true },
      extra_guest: { none: true },
      visitor: { none: true },
    },
    ...over,
  };
}

describe("stepsFor", () => {
  it("shows the honest count before the branch is known", () => {
    expect(stepsFor(null).map((s) => s.id)).toEqual([
      "host-type",
      "business",
      "payout",
      "consent",
      "review",
    ]);
  });

  it("gives an individual host the hotel's drawn steps when no kind is known", () => {
    /* `GOVERNING-10` is the default because it is the branch that asks the
       most: somebody whose kind we have not been told yet is shown the fuller
       flow rather than the shorter one. */
    expect(stepsFor("individual").map((s) => s.id)).toEqual([
      "host-type",
      "business",
      "representative",
      "hotel",
      "room-types",
      "rates",
      "facilities",
      "extra-charges",
      "payout",
      "consent",
      "review",
    ]);
  });

  it("gives a shortlet operator the two screens GOVERNING-11 draws", () => {
    const ids = stepsFor("individual", "shortlet_operator").map((s) => s.id);
    expect(ids).toEqual([
      "host-type",
      "business",
      "representative",
      "place",
      "house-rules",
      "facilities",
      "extra-charges",
      "payout",
      "consent",
      "review",
    ]);
    /* A shortlet host is never asked a hotelier's questions. */
    expect(ids).not.toContain("hotel");
    expect(ids).not.toContain("room-types");
    expect(ids).not.toContain("rates");
  });

  it("branches on the kind and not on the host type alone", () => {
    /* A shortlet operator may be a registered company, and is still letting a
       flat rather than running a hotel. */
    const ids = stepsFor("business", "shortlet_operator").map((s) => s.id);
    expect(ids).toContain("registration");
    expect(ids).toContain("place");
    expect(ids).not.toContain("hotel");
  });

  it("gives a registered business one more step, the papers", () => {
    const ids = stepsFor("business").map((s) => s.id);
    expect(ids).toContain("registration");
    expect(ids.length).toBe(stepsFor("individual").length + 1);
  });

  it("gives a restaurant its two drawn screens instead of rooms", () => {
    const ids = stepsFor("restaurant").map((s) => s.id);
    expect(ids).toContain("restaurant");
    expect(ids).toContain("tables");
    expect(ids).not.toContain("hotel");
    expect(ids).not.toContain("place");
    expect(ids).not.toContain("room-types");
    expect(ids).not.toContain("registration");
  });

  it("always ends with payout, consent and review", () => {
    for (const type of ["individual", "business", "restaurant"] as const) {
      expect(stepsFor(type).slice(-3).map((s) => s.id)).toEqual(["payout", "consent", "review"]);
    }
  });
});

describe("progressLabel", () => {
  it("is one-based", () => {
    expect(progressLabel(0, 8)).toBe("Step 1 of 8");
  });
});

describe("missingFrom", () => {
  it("asks for the host type first and nothing else", () => {
    expect(missingFrom(emptyHostDraft())).toEqual(["What kind of host you are"]);
  });

  it("is empty for a complete individual host", () => {
    expect(missingFrom(complete())).toEqual([]);
  });

  /* Ruling 6 (13 October 2026): a host setup is not sent without the
     pay-on-Vallo statement, an older draft included. */
  it("asks for the pay-on-Vallo statement until it is on record at its version", () => {
    const want = "Your statement that every payment for a deal you make on Vallo happens inside Vallo";
    expect(missingFrom(complete({ payOnValloVersion: null }))).toEqual([want]);
    expect(missingFrom(complete({ payOnValloVersion: undefined }))).toEqual([want]);
    expect(missingFrom(complete({ payOnValloVersion: "2026-01-01" }))).toEqual([want]);
  });

  it("names the pin and the photos separately", () => {
    const missing = missingFrom(
      complete({
        accommodation: {
          id: "a",
          name: "x",
          hasPin: false,
          photos: [],
          facilities: [],
          starRating: null,
          checkInFrom: "14:00",
          checkOutBy: "11:00",
          houseRules: "",
          cancellationPolicyId: null,
        },
      }),
    );
    expect(missing).toContain("The pin on the map");
    expect(missing).toContain("At least one photo of the property");
  });

  it("demands the papers on the business branch only", () => {
    const business = missingFrom(complete({ hostType: "business" }));
    expect(business).toContain("Registered business name");
    expect(business).toContain("CAC registration number");
    expect(business).toContain(DOCUMENT_SPECS.registration.title);
    expect(missingFrom(complete({ hostType: "individual" }))).not.toContain(
      "CAC registration number",
    );
  });

  it("demands a window, a price band and the hygiene attestation from a restaurant", () => {
    const restaurant = missingFrom(
      complete({
        hostType: "restaurant",
        kind: "restaurant",
        accommodation: null,
        roomTypeCount: 0,
        ratePlanCount: 0,
      }),
    );
    expect(restaurant).toEqual([
      "A price band",
      "At least one service window",
      "The health permit attestation",
      "At least one photo of the restaurant",
    ]);
  });

  it("SUP-17: a restaurant is not submitted without a photograph, and is with one", () => {
    const base = {
      hostType: "restaurant" as const,
      kind: "restaurant" as const,
      accommodation: null,
      roomTypeCount: 0,
      ratePlanCount: 0,
      restaurant: { priceBand: 2, cuisineCount: 1, cuisines: ["nigerian"], sittingMinutes: null, holdMinutes: null, cancelNoticeHours: null },
      serviceWindowCount: 1,
      hygieneAttestedAt: "2026-09-18T08:00:00Z",
    };
    expect(missingFrom(complete({ ...base, businessPhotoCount: 0 }))).toEqual(["At least one photo of the restaurant"]);
    expect(missingFrom(complete({ ...base, businessPhotoCount: 1 }))).toEqual([]);
  });

  it("prints each missing consent by its own label, never one bundled line", () => {
    const missing = missingFrom(complete({ consents: { accuracy: "2026-09-18T08:00:00Z" } }));
    expect(missing).toEqual([CONSENTS[1]!.label, CONSENTS[2]!.label]);
  });

  it("blocks on the bank account, because the payout promise is structural", () => {
    expect(missingFrom(complete({ hasBankAccount: false }))).toEqual([
      "A bank account for payouts",
    ]);
  });
});

describe("CAC_NUMBER_RE", () => {
  it("accepts the shapes people actually type", () => {
    for (const value of ["RC1234567", "rc 1234567", "BN-123456", "1234567", "IT 12345"]) {
      expect(CAC_NUMBER_RE.test(value)).toBe(true);
    }
  });

  it("refuses letters in the number and too few digits", () => {
    for (const value of ["RC12AB567", "RC123", "hello", ""]) {
      expect(CAC_NUMBER_RE.test(value)).toBe(false);
    }
  });
});

describe("documentPathBelongsTo", () => {
  it("accepts only the caller's own folder", () => {
    expect(documentPathBelongsTo("u1", "u1/batch/id.jpg")).toBe(true);
    expect(documentPathBelongsTo("u1", "u2/batch/id.jpg")).toBe(false);
    expect(documentPathBelongsTo("u1", "u10/batch/id.jpg")).toBe(false);
    expect(documentPathBelongsTo("u1", "")).toBe(false);
  });

  it("refuses a path that walks out of the person's own folder", () => {
    expect(documentPathBelongsTo("u1", "u1/../u2/id.jpg")).toBe(false);
    expect(documentPathBelongsTo("u1", "u1/./id.jpg")).toBe(false);
    expect(documentPathBelongsTo("u1", "u1//id.jpg")).toBe(false);
    expect(documentPathBelongsTo("u1", "u1/batch/")).toBe(false);
    expect(documentPathBelongsTo("u1", "u1/..\\u2\\id.jpg")).toBe(false);
    expect(documentPathBelongsTo("u1", "u1/batch/id\u0000.jpg")).toBe(false);
  });
});

describe("rejectFile", () => {
  it("names the limit before anything is uploaded", () => {
    expect(rejectFile({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(rejectFile({ type: "image/gif", size: 1024 })).toContain("JPG, PNG, WEBP, HEIC or PDF");
    expect(rejectFile({ type: "image/jpeg", size: 9 * 1024 * 1024 })).toContain("8MB");
  });
});

describe("mergeServerDraft", () => {
  /* The wizard's own copy, as it stood before a save: the business row exists
     and the person is typing, but nothing below the business is on record. */
  const local = (over: Partial<HostDraft> = {}): HostDraft => ({
    ...emptyHostDraft(),
    businessId: "biz-1",
    status: "DRAFT",
    hostType: "business",
    kind: "hotel",
    name: "Eko Suites typed after the save",
    phone: "+2348031234567",
    documents: { identity: true },
    ...over,
  });
  /* What `router.refresh()` brings back once the property and a room are saved. */
  const server = (over: Partial<HostDraft> = {}): HostDraft =>
    complete({
      businessId: "biz-1",
      status: "DRAFT",
      hostType: "business",
      kind: "hotel",
      name: "Eko Suites",
      documents: { registration: true },
      hygieneAttestedAt: "2026-10-12T09:00:00Z",
      businessPhotoCount: 1,
      businessPhotos: [{ id: "bp1", url: "/brand/photos/dining-01.jpg" }],
      reviewNotes: "The CAC certificate is blurry, please upload it again.",
      ...over,
    });

  it("takes what only the server writes: the property, its rooms and rates, photographs, attestations and the note", () => {
    const merged = mergeServerDraft(local(), server());
    expect(merged.accommodation?.id).toBe("a");
    expect(merged.roomTypes.map((room) => room.id)).toEqual(["rt1"]);
    expect(merged.roomTypeCount).toBe(1);
    expect(merged.ratePlanCount).toBe(1);
    expect(merged.businessPhotos).toHaveLength(1);
    expect(merged.hygieneAttestedAt).toBe("2026-10-12T09:00:00Z");
    expect(merged.reviewNotes).toContain("blurry");
    expect(missingFrom(merged)).not.toContain("At least one room type");
  });

  it("keeps the words the person is typing, which are newer than the read", () => {
    const merged = mergeServerDraft(local(), server());
    expect(merged.name).toBe("Eko Suites typed after the save");
    expect(merged.hostType).toBe("business");
  });

  it("only ever adds documents and the bank account, and takes consents from the record", () => {
    const merged = mergeServerDraft(
      local({ hasBankAccount: true, consents: { terms: "2026-10-12T09:00:00Z" } }),
      server({ hasBankAccount: false, consents: {}, consentWithdrawals: [{ id: "terms", at: "2026-10-12T10:00:00Z" }] }),
    );
    expect(merged.documents).toEqual({ identity: true, registration: true });
    expect(merged.hasBankAccount).toBe(true);
    /* A withdrawal is a write now, so the read is the truth. */
    expect(merged.consents).toEqual({});
    expect(merged.consentWithdrawals).toHaveLength(1);
  });

  it("asks a stay for its charges at the door before it can be sent", () => {
    expect(missingFrom(complete({ arrivalCharges: null }))).toEqual(["The charges at the door, all five answered"]);
  });

  it("changes nothing when the read came back empty, so a failed refresh cannot wipe the screen", () => {
    const before = local({ roomTypeCount: 2 });
    expect(mergeServerDraft(before, emptyHostDraft())).toBe(before);
  });

  it("changes nothing when the read is somebody else's application", () => {
    const before = local();
    expect(mergeServerDraft(before, server({ businessId: "biz-2" }))).toBe(before);
  });

  it("adopts the business id the first save created", () => {
    const merged = mergeServerDraft(local({ businessId: null }), server());
    expect(merged.businessId).toBe("biz-1");
  });
});
