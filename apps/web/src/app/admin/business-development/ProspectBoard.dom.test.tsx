import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProspectBoard } from "./ProspectBoard";
import type { BdActivity, BdProspect } from "@/lib/admin/business-development/types";

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

  it("draws a table: a header row, the stage, the follow-up mark and the last thing said", () => {
    const log: BdActivity[] = [
      { id: "a1", prospectId: "p1", kind: "contact", body: "Called the owner", outcome: "Wants a visit", actorId: null, createdAt: "2026-11-10T09:00:00Z" },
    ];
    const html = renderToStaticMarkup(
      <ProspectBoard prospects={[prospect({ stage: "interested", nextFollowUpAt: "2026-11-12" })]} activity={log} today="2026-11-14" />,
    );
    for (const column of ["Business", "Contact", "Stage", "Next follow-up", "Last activity"]) expect(html).toContain(column);
    expect(html).toContain("Interested");
    expect(html).toContain("12 Nov 2026");
    expect(html).toContain("Overdue");
    expect(html).toContain("Called the owner (Wants a visit)");
    expect(html).toContain("10 Nov 2026");
    expect(html).toContain("Download as a spreadsheet");
  });

  it("opens on the prospects still being worked, and on everything when none is", () => {
    const open = prospect({ id: "p3", businessName: "Open Homes", stage: "contacted" });
    const closed = prospect({ id: "p4", businessName: "Closed Homes", stage: "rejected" });
    const working = renderToStaticMarkup(<ProspectBoard prospects={[open, closed]} />);
    expect(working).toContain("Open Homes");
    expect(working).not.toContain("Closed Homes");
    const done = renderToStaticMarkup(<ProspectBoard prospects={[closed]} />);
    expect(done).toContain("Closed Homes");
  });

  it("says the pipeline is empty before the first prospect is added", () => {
    const html = renderToStaticMarkup(<ProspectBoard prospects={[]} />);
    expect(html).toContain("Your pipeline is empty");
  });

  it("says nothing is at a stage with no prospects", () => {
    const html = renderToStaticMarkup(<ProspectBoard prospects={[prospect({ stage: "new" })]} />);
    expect(html).toContain("1)");
  });
});
