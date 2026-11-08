import { describe, expect, it } from "vitest";

import { CASE_ACTIONS, ACTION_LABEL, caseFiltersQuery, caseNumber, readCaseFilters, restrictionIsHeavy, RESTRICTION_KINDS, RESTRICTION_LABEL, type CaseFilters } from "./model";

const params = (query: string) => Object.fromEntries(new URLSearchParams(query.replace(/^\?/, "")));

describe("case filters in the address", () => {
  it("opens on the open cases, anyone's, with nothing else set", () => {
    expect(readCaseFilters({})).toEqual({ status: "open", module: null, severity: null, assigned: "any", overdue: false, q: "", offset: 0 });
    expect(caseFiltersQuery(readCaseFilters({}))).toBe("");
  });

  it("round-trips every filter through the address", () => {
    const f: CaseFilters = { status: "escalated", module: "roommates", severity: "high", assigned: "me", overdue: true, q: "deposit scam", offset: 40 };
    expect(readCaseFilters(params(caseFiltersQuery(f)))).toEqual(f);
  });

  it("writes every status as status=all and reads it back as null", () => {
    const f = { ...readCaseFilters({}), status: null };
    expect(caseFiltersQuery(f)).toBe("?status=all");
    expect(readCaseFilters(params(caseFiltersQuery(f))).status).toBeNull();
  });

  it("drops what it does not know, and never a negative page", () => {
    const f = readCaseFilters({ status: "lost", module: "crypto", severity: "extreme", assigned: "everyone", offset: "-20", q: "x".repeat(200) });
    expect(f.status).toBeNull();
    expect(f.module).toBeNull();
    expect(f.severity).toBeNull();
    expect(f.assigned).toBe("any");
    expect(f.offset).toBe(0);
    expect(f.q).toHaveLength(80);
  });
});

describe("case numbers", () => {
  it("pads to six digits behind VC-", () => {
    expect(caseNumber(1)).toBe("VC-000001");
    expect(caseNumber(123456)).toBe("VC-123456");
    expect(caseNumber(1234567)).toBe("VC-1234567");
  });
});

describe("which restrictions need Trust and Safety", () => {
  it("never treats a warning as heavy", () => {
    expect(restrictionIsHeavy("warning", null)).toBe(false);
    expect(restrictionIsHeavy("warning", 365)).toBe(false);
  });

  it("treats a suspension, an open-ended restriction or one over 30 days as heavy", () => {
    expect(restrictionIsHeavy("suspended", 1)).toBe(true);
    expect(restrictionIsHeavy("messaging", null)).toBe(true);
    expect(restrictionIsHeavy("posting", 31)).toBe(true);
    expect(restrictionIsHeavy("roommates", 90)).toBe(true);
  });

  it("lets a moderator give a short restriction", () => {
    expect(restrictionIsHeavy("messaging", 7)).toBe(false);
    expect(restrictionIsHeavy("roommates", 30)).toBe(false);
  });
});

describe("the desk's words", () => {
  it("names every restriction and every action it can offer", () => {
    for (const k of RESTRICTION_KINDS) expect(RESTRICTION_LABEL[k]).toBeTruthy();
    for (const list of Object.values(CASE_ACTIONS)) for (const a of list) expect(ACTION_LABEL[a]).toBeTruthy();
  });
});
