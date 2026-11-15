import { describe, expect, it } from "vitest";
import { renderClient } from "@/lib/testing/render-client";
import { KYC_CROSS_CHECKS_NOTE, kycContext } from "../contexts/kyc";
import { PLAYBOOKS, findPlaybook } from "./playbooks";

/**
 * THE "SUSPECTED FORGED ID" PLAYBOOK (15 November 2026), over the REAL manual:
 * its steps are the Business Development chapter's own sentences, it opens
 * only for people who hold the KYC desk, and the desk assistant is told what
 * the Cross-checks panel is and is not.
 */
describe("the playbook's entry", () => {
  const playbook = PLAYBOOKS.find((p) => p.key === "forged_id")!;

  it("is scoped to the KYC desk and built from the manual section written for it", () => {
    expect(playbook).toMatchObject({ title: "Suspected forged ID", deskHref: "/admin/kyc", deskName: "KYC review", scopes: ["kyc_review"] });
    expect(playbook.from).toEqual(["/admin/manual/business-development#forged-id"]);
  });

  it("is found by the words a reviewer would use", () => {
    for (const query of [
      "suspected forged ID",
      "I think this ID is fake",
      "how do I know the ID was forged",
      "the same ID number is on another account",
      "how can I cross check that a BVN is correct",
      "this passport looks tampered",
      "what do the check digits mean",
    ]) {
      expect(findPlaybook(query)?.key, query).toBe("forged_id");
    }
  });

  it("does not take over the questions other playbooks answer, or everyday words", () => {
    expect(findPlaybook("how do I process a KYC check")?.key).toBe("kyc_check");
    expect(findPlaybook("process a KYC identity check")?.key).toBe("kyc_check");
    expect(findPlaybook("how do I escalate a case")?.key).toBe("escalate_case");
    expect(findPlaybook("approve a listing")?.key).toBe("approve_listing");
    for (const query of ["good morning", "what is running this evening", "opening a meeting", "bake a cake"]) {
      expect(findPlaybook(query)?.key, query).not.toBe("forged_id");
    }
    /* No word short enough to sit inside another word. */
    for (const word of playbook.words) expect(word.length, word).toBeGreaterThanOrEqual(3);
    expect(playbook.words).not.toContain("nin");
    expect(playbook.words).not.toContain("id");
  });
});

describe("the playbook, built from the real manual", () => {
  const run = (body: string) =>
    renderClient(`
      import { MANUAL_BODIES } from "@/app/admin/manual/_chapters";
      import { buildPassages } from "@/lib/admin/copilot/tools/manual-search";
      import { buildPlaybook } from "@/lib/admin/copilot/tools/playbooks";
      const passages = buildPassages(MANUAL_BODIES);
      const reviewer = { isAdmin: false, isSuperAdmin: false, scopes: ["kyc_review", "listing_approval", "business_development"] };
      const support = { isAdmin: false, isSuperAdmin: false, scopes: ["support"] };
      const admin = { isAdmin: true, isSuperAdmin: false, scopes: [] };
      ${body}
    `);

  it("reads out the steps in order, with the desk link, to a person who holds the KYC desk", async () => {
    const r = JSON.parse(
      await run(`export const html = () => JSON.stringify({ reviewer: buildPlaybook("suspected forged ID", passages, reviewer), admin: buildPlaybook("is this ID fake", passages, admin) });`),
    ) as Record<string, { ok: boolean; title: string; steps: string[]; desk: { href: string; name: string }; sources: { link: string; section: string }[] }>;
    const answer = r.reviewer!;
    expect(answer.ok).toBe(true);
    expect(answer.title).toBe("Suspected forged ID");
    expect(answer.desk).toEqual({ name: "KYC review", href: "/admin/kyc" });
    expect(answer.sources).toEqual([expect.objectContaining({ link: "/admin/manual/business-development#forged-id", section: "Before you escalate a possible fake ID" })]);
    expect(answer.steps).toHaveLength(10);
    const steps = answer.steps.join(" | ");
    const order = [
      "not enough to approve on when something feels wrong",
      "Read the Cross-checks list from the top",
      "one ID belongs to one person",
      "type the two lines at the bottom of the photo page",
      "Compare with other accounts",
      "What a real one looks like",
      "Ask for a selfie holding their ID",
      "do not approve",
      "Escalate to Trust and Safety",
    ];
    let at = -1;
    for (const part of order) {
      const next = steps.indexOf(part, at + 1);
      expect(next, part).toBeGreaterThan(at);
      at = next;
    }
    expect(r.admin!.ok).toBe(true);
  }, 60_000);

  it("is not read out to somebody who cannot open the KYC desk", async () => {
    const r = JSON.parse(await run(`export const html = () => JSON.stringify(buildPlaybook("suspected forged ID", passages, support));`)) as { ok: boolean; reason: string; message: string };
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no_access");
    expect(r.message).toContain("KYC review");
  }, 60_000);

  it("the chapter answers the question plainly: what to check, what never to do, and the CAC search", async () => {
    const text = JSON.parse(
      await run(`export const html = () => JSON.stringify(passages.filter((p) => p.link === "/admin/manual/business-development#forged-id").map((p) => p.text).join(" "));`),
    ) as string;
    for (const part of [
      "A name and a photo can both be copied",
      "Never take a member's information outside Vallo",
      "There is no free public place to look up a NIN or a BVN",
      "do not type an ID number, a name or a date of birth into any outside website, app or chat",
      "Never tell the person, or anyone close to them, that you suspect them",
      "None of the Cross-checks proves an ID is genuine",
      "Corporate Affairs Commission's public search",
      "Search by the business name or the RC number only",
      "a public record of a company, not a person's private information",
      "Escalating a doubt is the right call, not a failure",
    ]) {
      expect(text, part).toContain(part);
    }
  }, 60_000);
});

describe("what the desk assistant is told about the panel", () => {
  it("is in the context whether or not the figures were read, and carries no figure and no person", () => {
    const live = kycContext({ awaiting: 3, awaitingLastWeek: 5, passedToday: 2, failedToday: 1, decisionsThisWeek: 0, medianDecisionMinutesThisWeek: null, selfieChecksWaiting: null });
    expect(live).toContain("3 documents waiting for a decision");
    expect(live).toContain(KYC_CROSS_CHECKS_NOTE);
    expect(kycContext(null)).toContain(KYC_CROSS_CHECKS_NOTE);
    expect(KYC_CROSS_CHECKS_NOTE).not.toMatch(/\d/);
  });

  it("says what each level means, that nothing is proof, that nothing leaves Vallo, and where the steps are", () => {
    for (const part of [
      "Stop means do not approve and escalate",
      "Nothing in it proves an ID is genuine",
      "There is no free lookup of a NIN or a BVN",
      "never typed into any outside website, app or chat",
      "never tells the member what is suspected",
      "the playbook Suspected forged ID",
    ]) {
      expect(KYC_CROSS_CHECKS_NOTE).toContain(part);
    }
  });
});
