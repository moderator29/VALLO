import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EscalationBoard } from "./EscalationBoard";
import type { CooEscalation } from "@/lib/admin/overview/reads";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }) }));

function escalation(over: Partial<CooEscalation>): CooEscalation {
  return {
    id: "e1",
    raisedBy: null,
    sourceDesk: "support",
    subject: "Angry refund",
    detail: "Needs a call back today.",
    status: "open",
    resolvedBy: null,
    resolutionNote: null,
    createdAt: "2026-11-01T00:00:00Z",
    resolvedAt: null,
    ...over,
  };
}

describe("EscalationBoard", () => {
  it("shows an open escalation with resolve controls when the viewer may resolve", () => {
    const html = renderToStaticMarkup(<EscalationBoard escalations={[escalation({})]} canResolve />);
    expect(html).toContain("Angry refund");
    expect(html).toContain("Support");
    expect(html).toContain("Resolve");
  });

  it("hides resolve controls for a viewer who may not resolve", () => {
    const html = renderToStaticMarkup(<EscalationBoard escalations={[escalation({})]} canResolve={false} />);
    expect(html).toContain("Angry refund");
    expect(html).not.toContain("Resolve");
  });

  it("says there are no open escalations and lists resolved history underneath", () => {
    const html = renderToStaticMarkup(
      <EscalationBoard
        escalations={[escalation({ id: "e2", status: "resolved", resolvedAt: "2026-11-02T00:00:00Z", resolutionNote: "Called back, refunded." })]}
        canResolve
      />,
    );
    expect(html).toContain("No open escalations");
    expect(html).toContain("Called back, refunded.");
  });
});
