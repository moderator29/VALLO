// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IdentityNotice } from "./IdentityNotice";

describe("the lister's identity notice", () => {
  it("says verify to publish, with the way in, when no ID is on file", () => {
    const html = renderToStaticMarkup(<IdentityNotice status="none" />);
    expect(html).toContain("Verify your identity to publish");
    expect(html).toContain('href="/verification"');
  });
  it("says the ID is waiting, and that a failed one needs a new ID", () => {
    expect(renderToStaticMarkup(<IdentityNotice status="pending" />)).toContain("waiting for review");
    expect(renderToStaticMarkup(<IdentityNotice status="failed" />)).toContain("Send a new ID");
  });
  it("draws nothing for an approved lister", () => {
    expect(renderToStaticMarkup(<IdentityNotice status="approved" />)).toBe("");
  });
});
