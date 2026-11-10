import { describe, expect, it } from "vitest";
import { renderClient } from "@/lib/testing/render-client";

/** search_manual over the REAL chapters, bundled the way the manual's own tests render them. */
describe("search_manual", () => {
  it("finds real chapter passages with chapter links", async () => {
    const out = await renderClient(`
      import { MANUAL_BODIES } from "@/app/admin/manual/_chapters";
      import { buildPassages, searchPassages } from "@/lib/admin/copilot/tools/manual-search";
      const passages = buildPassages(MANUAL_BODIES);
      const claim = searchPassages("how do I take a ticket claim before I work it", passages);
      const escalate = searchPassages("where do I take something I cannot decide", passages);
      const job = searchPassages("what is a support agent responsible for", passages);
      export const html = () => JSON.stringify({ n: passages.length, claim, escalate, job });
    `);
    const r = JSON.parse(out) as { n: number; claim: { link: string; text: string; source: string }[]; escalate: { link: string }[]; job: { source: string }[] };
    expect(r.n).toBeGreaterThan(40);
    expect(r.claim[0]!.link).toMatch(/^\/admin\/manual\/[a-z-]+/);
    expect(r.claim.map((p) => p.text).join(" ").toLowerCase()).toContain("claim");
    expect(r.escalate.length).toBeGreaterThan(0);
    expect(r.job.some((p) => p.source === "position")).toBe(true);
  }, 60_000);
});
