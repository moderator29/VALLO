import { describe, expect, it } from "vitest";
import { identityOnFile, listingVerificationOwed } from "./listing-verification-rule";

const base = { flagOn: true, qa: false, tier: 0, identity: "none" as const };

describe("verified before a deal (Grade 1, P0.3)", () => {
  it("refuses a lister with nothing on file or only refused documents", () => {
    expect(listingVerificationOwed(base)).toBe(true);
    expect(listingVerificationOwed({ ...base, identity: "refused" })).toBe(true);
  });

  it("lets a pending or approved identity send the listing for review", () => {
    expect(listingVerificationOwed({ ...base, identity: "pending" })).toBe(false);
    expect(listingVerificationOwed({ ...base, identity: "approved" })).toBe(false);
    expect(listingVerificationOwed({ ...base, tier: 1 })).toBe(false);
  });

  it("never asks a QA account, and the switch turns it off", () => {
    expect(listingVerificationOwed({ ...base, qa: true })).toBe(false);
    expect(listingVerificationOwed({ ...base, flagOn: false })).toBe(false);
  });

  it("reads the best of the documents on file", () => {
    expect(identityOnFile([])).toBe("none");
    expect(identityOnFile(["rejected"])).toBe("refused");
    expect(identityOnFile(["rejected", "pending"])).toBe("pending");
    expect(identityOnFile([null])).toBe("pending");
    expect(identityOnFile(["pending", "approved"])).toBe("approved");
  });
});
