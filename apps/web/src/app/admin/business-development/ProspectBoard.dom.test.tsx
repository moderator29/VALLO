import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProspectBoard } from "./ProspectBoard";
import type { BdProspect } from "@/lib/admin/business-development/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }) }));

function prospect(over: Partial<BdProspect>): BdProspect {
  return {
    id: "p1",
    contactName: "Ada",
    businessName: "Ada Lets",
    category: "landlord",
    email: "ada@example.com",
    phone: null,
    location: "Lekki, Lagos",
    stage: "new",
    notes: null,
    assignedTo: null,
    createdBy: null,
    listingId: null,
    onboardedAt: null,
    nextFollowUpAt: null,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    ...over,
  };
}

describe("ProspectBoard", () => {
  it("lists a prospect with its category and contact route", () => {
    const html = renderToStaticMarkup(<ProspectBoard prospects={[prospect({})]} />);
    expect(html).toContain("Ada Lets");
    expect(html).toContain("Landlord");
    expect(html).toContain("Lekki, Lagos");
    expect(html).toContain("ada@example.com");
  });

  it("marks an onboarded business separately from any linked listing", () => {
    const onboarded = prospect({ id: "p2", stage: "onboarded", onboardedAt: "2026-11-05T00:00:00Z", listingId: null });
    const html = renderToStaticMarkup(<ProspectBoard prospects={[onboarded]} />);
    expect(html).toContain("Onboarded");
    expect(html).toContain("No listing linked yet");
  });

  it("says nothing is at a stage with no prospects", () => {
    const html = renderToStaticMarkup(<ProspectBoard prospects={[prospect({ stage: "new" })]} />);
    expect(html).toContain("1)");
  });
});
