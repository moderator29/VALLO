import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * An unverified lister can SUBMIT a listing for review (founder, 10 November
 * 2026); the block is at approval and publish. The approval refusal and its
 * banner cause are tested in `lib/admin/listing-review-decisions.test.ts`
 * ("the identity gate on a new approval"). Here: the submit action no longer
 * consults the identity gate, and keeps its other validation.
 */
const src = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8");

describe("submitting for review without a verified identity", () => {
  const actions = src("lib/agent/listings-actions.ts");
  it("no longer refuses a submit for identity reasons", () => {
    expect(actions).not.toContain("listingVerificationGate");
  });
  it("still checks the phone gate, the broadcast figures, photos and the editable state", () => {
    expect(actions).toContain("phoneGateFor(gate.supabase, gate.user.id, \"listing\")");
    expect(actions).toContain("readBroadcastMarks");
    expect(actions).toContain("listing_photos");
    expect(actions).toContain("EDITABLE.includes(listing.status)");
  });
  it("the wizard says it can be sent now and cannot go live until identity is approved", () => {
    const wizard = src("app/agent/list/ListingWizard.tsx");
    expect(wizard).toContain("You can send this now. It cannot go live until your identity is approved.");
    expect(wizard).toContain("Submitted. It cannot go live until your identity is approved.");
  });
  it("the lister's own row says Waiting on identity", () => {
    expect(src("app/agent/listings/ListingsWorkspace.tsx")).toContain("Waiting on identity");
  });
});
