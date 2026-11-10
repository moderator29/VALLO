import { describe, expect, it } from "vitest";

import {
  IDENTITY_REASON,
  decideIdentityStatus,
  describeIdentity,
  identityRefusal,
  listerIdentityStatus,
} from "./lister-identity";

describe("decideIdentityStatus", () => {
  const none = { tier: 0, checks: [], documents: [] };
  it("nothing on file is none", () => expect(decideIdentityStatus(none)).toBe("none"));
  it("an agent who passed verification counts as approved", () => expect(decideIdentityStatus({ ...none, tier: 1 })).toBe("approved"));
  it("an approved Dojah check or document is approved", () => {
    expect(decideIdentityStatus({ ...none, checks: ["approved"] })).toBe("approved");
    expect(decideIdentityStatus({ ...none, checks: ["passed"] })).toBe("approved");
    expect(decideIdentityStatus({ ...none, documents: ["approved"] })).toBe("approved");
  });
  it("waiting, review and retry are pending", () => {
    for (const s of ["waiting", "review", "retry"]) expect(decideIdentityStatus({ ...none, checks: [s] })).toBe("pending");
    expect(decideIdentityStatus({ ...none, documents: ["pending"] })).toBe("pending");
  });
  it("refused and rejected are failed", () => {
    expect(decideIdentityStatus({ ...none, checks: ["refused"] })).toBe("failed");
    expect(decideIdentityStatus({ ...none, documents: ["rejected"] })).toBe("failed");
  });
  it("the best state wins: a new pending after a refusal is pending, an approval beats both", () => {
    expect(decideIdentityStatus({ ...none, checks: ["refused"], documents: ["pending"] })).toBe("pending");
    expect(decideIdentityStatus({ ...none, checks: ["refused", "approved"], documents: ["pending"] })).toBe("approved");
  });
});

describe("the words", () => {
  it("each status has a reason, and the refusal names the cause", () => {
    expect(identityRefusal(describeIdentity("pending", "u1"))).toBe("Cannot approve: identity check not approved. The ID is still waiting for review.");
    expect(identityRefusal(describeIdentity("none", "u1"))).toContain(IDENTITY_REASON.none);
    expect(identityRefusal(describeIdentity("failed", "u1"))).toContain("failed");
  });
  it("links to the person's verification case", () => {
    expect(describeIdentity("pending", "u 1").caseHref).toBe("/admin/kyc?q=u%201");
  });
});

function fake(rows: { agents?: unknown[]; identity_checks?: unknown[]; agent_documents?: unknown[]; fail?: string }) {
  return {
    from(table: string) {
      const result = { data: (rows as Record<string, unknown[]>)[table] ?? [], error: rows.fail === table ? { message: "x" } : null };
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
      return chain;
    },
  } as never;
}

describe("listerIdentityStatus", () => {
  it("reads the three sources", async () => {
    expect((await listerIdentityStatus("u1", fake({ agents: [{ verification_tier: 2 }] }))).status).toBe("approved");
    expect((await listerIdentityStatus("u1", fake({ identity_checks: [{ status: "review" }] }))).status).toBe("pending");
    expect((await listerIdentityStatus("u1", fake({ agent_documents: [{ review_status: "rejected" }] }))).status).toBe("failed");
    expect((await listerIdentityStatus("u1", fake({}))).status).toBe("none");
  });
  it("fails closed when a read fails", async () => {
    const answer = await listerIdentityStatus("u1", fake({ fail: "identity_checks", agents: [{ verification_tier: 2 }] }));
    expect(answer.status).toBe("none");
    expect(answer.readFailed).toBe(true);
  });
});
