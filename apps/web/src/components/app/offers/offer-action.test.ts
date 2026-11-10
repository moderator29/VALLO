import { describe, expect, it } from "vitest";
import { offerActionFor } from "./offer-action";
import { FIXTURE_GATE_BLOCKED, FIXTURE_GATE_EXISTING, FIXTURE_GATE_OWN, gate } from "@/lib/offers/fixtures";

const base = { listingId: "lst-1" };

describe("offerActionFor", () => {
  it("offers Make an offer when the viewer may offer", () => {
    expect(offerActionFor({ ...base, signedIn: true, gate: gate() })).toEqual({ label: "Make an offer", href: "/listing/lst-1/offer" });
  });
  it("keeps Make an offer while a requirement is unmet, so the buyer can fix it", () => {
    expect(offerActionFor({ ...base, signedIn: true, gate: FIXTURE_GATE_BLOCKED })?.label).toBe("Make an offer");
  });
  it("sends the seller to offers received", () => {
    expect(offerActionFor({ ...base, signedIn: true, gate: FIXTURE_GATE_OWN })).toEqual({ label: "View offers", href: "/offers?tab=received" });
  });
  it("shows View your offer when one is live", () => {
    expect(offerActionFor({ ...base, signedIn: true, gate: FIXTURE_GATE_EXISTING })).toEqual({ label: "View your offer", href: "/offers/off-open" });
  });
  it("offers nothing when the listing cannot take offers", () => {
    expect(offerActionFor({ ...base, signedIn: true, gate: gate({ canOffer: false, canOpenForm: false, reason: "Offers are not turned on for this property." }) })).toBeNull();
  });
  it("shows Make an offer to a signed-out reader, and nothing to a signed-in one with no read", () => {
    expect(offerActionFor({ ...base, signedIn: false, gate: null })?.label).toBe("Make an offer");
    expect(offerActionFor({ ...base, signedIn: true, gate: null })).toBeNull();
  });
});
