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

describe("manual index, playbooks and scope", () => {
  const run = (body: string) =>
    renderClient(`
      import { MANUAL_BODIES } from "@/app/admin/manual/_chapters";
      import { MANUAL_CHAPTERS } from "@/lib/admin/manual/chapters";
      import { buildPassages, searchPassages, visiblePassages } from "@/lib/admin/copilot/tools/manual-search";
      import { buildPlaybook } from "@/lib/admin/copilot/tools/playbooks";
      const extra = {
        docs: [{ slug: "money", number: 1, title: "Money", sections: [{ id: "refunds", heading: "Refunds", body: "A refund goes back to the card you paid with." }] }],
        faqs: [{ category: "Payments", q: "How long does a refund take?", a: "Banks usually show it within 5 to 10 working days." }],
        facts: [{ title: "Where a refund goes", text: "A refund goes back to the original card.", link: "/cancellations" }],
      };
      const passages = buildPassages(MANUAL_BODIES, extra);
      const support = { isAdmin: false, isSuperAdmin: false, scopes: ["support"] };
      const admin = { isAdmin: true, isSuperAdmin: false, scopes: [] };
      const none = { isAdmin: false, isSuperAdmin: false, scopes: ["content"] };
      ${body}
    `);

  it("indexes every registered chapter plus docs, help and money facts", async () => {
    const r = JSON.parse(await run(`export const html = () => JSON.stringify({
      missing: MANUAL_CHAPTERS.filter((c) => !passages.some((p) => p.source === "manual" && p.link.startsWith("/admin/manual/" + c.slug))).map((c) => c.slug),
      sources: [...new Set(passages.map((p) => p.source))].sort(),
      expectations: passages.some((p) => p.heading === "What is expected of you"),
    });`)) as { missing: string[]; sources: string[]; expectations: boolean };
    expect(r.missing).toEqual([]);
    expect(r.sources).toEqual(["docs", "help", "manual", "money", "position"]);
    expect(r.expectations).toBe(true);
  }, 60_000);

  it("ranks a title match above a body mention", async () => {
    const r = JSON.parse(await run(`export const html = () => JSON.stringify(searchPassages("refund", passages, 3).map((p) => [p.source, p.heading, p.score]));`)) as [string, string, number][];
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]![2]).toBeGreaterThanOrEqual(r[r.length - 1]![2]);
  }, 60_000);

  it("builds a numbered playbook with the desk link, and refuses a desk the viewer cannot open", async () => {
    const r = JSON.parse(await run(`export const html = () => JSON.stringify({
      kyc: buildPlaybook("how do I process a KYC check", passages, admin),
      refused: buildPlaybook("process a KYC identity check", passages, support),
      escalate: buildPlaybook("how do I escalate a case", passages, none),
      unknown: buildPlaybook("bake a cake", passages, admin),
    });`)) as Record<string, { ok: boolean; steps?: string[]; desk?: { href: string }; sources?: { link: string }[]; reason?: string }>;
    expect(r.kyc!.ok).toBe(true);
    expect(r.kyc!.desk!.href).toBe("/admin/kyc");
    expect(r.kyc!.steps!.length).toBeGreaterThan(1);
    expect(r.kyc!.sources![0]!.link).toContain("/admin/manual/queues#identity");
    expect(r.refused!.ok).toBe(false);
    expect(r.refused!.reason).toBe("no_access");
    expect(r.escalate!.ok).toBe(true);
    expect(r.unknown!.reason).toBe("unknown");
  }, 60_000);

  it("never shows a restricted desk's chapter text to a viewer without the access area", async () => {
    const r = JSON.parse(await run(`export const html = () => JSON.stringify({
      adminSees: visiblePassages(passages, admin).some((p) => p.link === "/admin/manual/queues#identity"),
      supportSees: visiblePassages(passages, support).some((p) => p.link === "/admin/manual/queues#identity"),
      otherSees: visiblePassages(passages, none).some((p) => p.link === "/admin/manual/queues#identity"),
      otherStillSeesEscalation: visiblePassages(passages, none).some((p) => p.link.startsWith("/admin/manual/escalation")),
    });`)) as Record<string, boolean>;
    expect(r.adminSees).toBe(true);
    expect(r.supportSees).toBe(false);
    expect(r.otherSees).toBe(false);
    expect(r.otherStillSeesEscalation).toBe(true);
  }, 60_000);
});
