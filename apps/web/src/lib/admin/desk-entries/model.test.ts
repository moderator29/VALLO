import { describe, expect, it } from "vitest";

import { ENTRY_DESKS, KIND_DEFS, checkCounts, countEntries, entryCopyText, entryRef, expiringSoon, isEntryEditable, isEntryOverdue, kindDef, kindsOfDesk, parseEntry, startStatus, stepsOf, type Entry } from "./model";

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: "1a2b3c4d-0000-0000-0000-000000000000", desk: "technical", kind: "reminder", title: "Domain", body: "", status: "open", dueOn: "2026-12-01", linkUrl: null, subjectUser: null,
  fields: {}, reviewNote: null, approvedBy: null, approvedAt: null, ownerId: null, createdBy: null, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", ...over,
});
const blank = { title: "", body: "", dueOn: "", linkUrl: "", subjectUser: "", fields: {} };

describe("the kinds", () => {
  it("gives every desk at least four tools and every kind a unique name and reference prefix", () => {
    for (const desk of ENTRY_DESKS) expect(kindsOfDesk(desk).length, desk).toBeGreaterThanOrEqual(4);
    expect(new Set(KIND_DEFS.map((d) => d.kind)).size).toBe(KIND_DEFS.length);
    expect(new Set(KIND_DEFS.map((d) => d.ref)).size).toBe(KIND_DEFS.length);
    for (const d of KIND_DEFS) expect(d.kind).toMatch(/^[a-z][a-z_]{1,39}$/);
  });

  it("never asks for a secret and never uses an em dash", () => {
    const words = JSON.stringify(KIND_DEFS);
    expect(words).not.toContain("—");
    expect(KIND_DEFS.some((d) => d.fields.some((f) => /password|secret|api key/i.test(f.label)))).toBe(false);
  });

  it("starts approval kinds as drafts and plain kinds as open", () => {
    expect(startStatus(kindDef("macro")!)).toBe("draft");
    expect(startStatus(kindDef("runbook")!)).toBe("open");
  });
});

describe("parseEntry", () => {
  const brief = kindDef("creative_brief")!;
  it("needs a title and the words the kind requires", () => {
    const r = parseEntry(brief, blank);
    expect(r).toMatchObject({ error: expect.any(String) });
    expect("fieldErrors" in r && Object.keys(r.fieldErrors)).toEqual(expect.arrayContaining(["title", "body"]));
  });

  it("keeps only declared fields, drops blanks, and checks a select against its options", () => {
    const ab = kindDef("ab_test")!;
    const ok = parseEntry(ab, { ...blank, title: "Price first?", fields: { variant_a: "A", result: "a_won", sneaky: "x" } });
    expect(ok).toMatchObject({ value: { fields: { variant_a: "A", result: "a_won" } } });
    const bad = parseEntry(ab, { ...blank, title: "Q", fields: { result: "won" } });
    expect("fieldErrors" in bad && bad.fieldErrors["fields.result"]).toBeTruthy();
  });

  it("refuses a date or a link a kind does not have, a bad date and a bad link", () => {
    expect("fieldErrors" in parseEntry(kindDef("style_note")!, { ...blank, title: "T", body: "b", dueOn: "2026-12-01" })).toBe(true);
    expect("fieldErrors" in parseEntry(kindDef("reminder")!, { ...blank, title: "T" })).toBe(true);
    expect("fieldErrors" in parseEntry(kindDef("reminder")!, { ...blank, title: "T", dueOn: "2026-02-31" })).toBe(true);
    expect("fieldErrors" in parseEntry(kindDef("seo_check")!, { ...blank, title: "T", linkUrl: "javascript:alert(1)" })).toBe(true);
    expect(parseEntry(kindDef("seo_check")!, { ...blank, title: "T", linkUrl: "https://vallospaces.com/help" })).toMatchObject({ value: { link_url: "https://vallospaces.com/help" } });
  });

  it("requires a person for a coaching note and refuses one for any other kind", () => {
    const coaching = kindDef("coaching_note")!;
    expect("fieldErrors" in parseEntry(coaching, { ...blank, title: "T", body: "b" })).toBe(true);
    expect("fieldErrors" in parseEntry(coaching, { ...blank, title: "T", body: "b", subjectUser: "not-a-uuid" })).toBe(true);
    expect("fieldErrors" in parseEntry(kindDef("macro")!, { ...blank, title: "T", body: "b", subjectUser: "11111111-1111-1111-1111-111111111111" })).toBe(true);
    expect(parseEntry(coaching, { ...blank, title: "T", body: "b", subjectUser: "11111111-1111-1111-1111-111111111111" })).toMatchObject({ value: { subject_user: "11111111-1111-1111-1111-111111111111" } });
  });

  it("stores a ticked box as yes and nothing else", () => {
    const seo = kindDef("seo_check")!;
    const r = parseEntry(seo, { ...blank, title: "T", fields: { title_ok: "yes", meta_ok: "true" } });
    expect(r).toMatchObject({ value: { fields: { title_ok: "yes" } } });
    expect(checkCounts(seo, { title_ok: "yes" })).toEqual({ done: 1, total: 6 });
  });
});

describe("helpers", () => {
  it("makes a short quotable reference", () => {
    expect(entryRef("runbook", "1a2b3c4d-0000-0000-0000-000000000000")).toBe("RB-1A2B3C");
    expect(entryRef("incident", "1a2b3c4d-0000-0000-0000-000000000000")).toBe("INC-1A2B3C");
  });

  it("copies the title, the text and the filled fields", () => {
    const def = kindDef("translation")!;
    const text = entryCopyText(def, entry({ kind: "translation", title: "Deposits", body: "Notes", fields: { en: "live", ha: "drafting" } }));
    expect(text).toContain("Deposits");
    expect(text).toContain("Hausa: Drafting");
    expect(text).not.toContain("Yoruba");
  });

  it("splits steps by line", () => {
    expect(stepsOf("a\n\n  b \n")).toEqual(["a", "b"]);
  });

  it("edits plain kinds while open or done and approval kinds only as draft or sent back", () => {
    expect(isEntryEditable({ flow: "plain" }, "open")).toBe(true);
    expect(isEntryEditable({ flow: "plain" }, "retired")).toBe(false);
    expect(isEntryEditable({ flow: "approval" }, "submitted")).toBe(false);
    expect(isEntryEditable({ flow: "approval" }, "approved")).toBe(false);
    expect(isEntryEditable({ flow: "approval" }, "sent_back")).toBe(true);
  });

  it("counts overdue, waiting and done, and finds reminders running out", () => {
    const list = [entry({ id: "a" }), entry({ id: "b", status: "submitted", dueOn: null }), entry({ id: "c", status: "done" }), entry({ id: "d", status: "retired" }), entry({ id: "e", dueOn: "2026-10-01" })];
    expect(countEntries(list, "2026-11-10")).toEqual({ open: 2, overdue: 1, waitingApproval: 1, done: 1 });
    expect(isEntryOverdue(entry({ dueOn: "2026-11-01" }), "2026-11-10")).toBe(true);
    expect(expiringSoon(list, 30, "2026-11-10").map((e) => e.id)).toEqual(["e", "a"]);
    expect(expiringSoon(list, 10, "2026-11-10").map((e) => e.id)).toEqual(["e"]);
  });
});
