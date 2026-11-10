import { describe, expect, it } from "vitest";
import { identityOnFile, listingVerificationOwed } from "./listing-verification-rule";

const base = { flagOn: true, qa: false, tier: 0, identity: "none" as const };

/* 10 November 2026: this rule says when identity is OWED BEFORE PUBLISHING (it drives the
   "Verify your identity to publish" notes). It no longer refuses a submit: see
   `submit-without-identity.test.ts`; the block is at approval. */
describe("identity owed before publishing", () => {
  it("is owed by a lister with nothing on file or only refused documents", () => {
    expect(listingVerificationOwed(base)).toBe(true);
    expect(listingVerificationOwed({ ...base, identity: "refused" })).toBe(true);
  });

  it("is not owed once a check is pending or approved", () => {
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
