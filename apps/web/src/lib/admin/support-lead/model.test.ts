import { describe, expect, it } from "vitest";

import { medianHoursToFinish, parsePolicy, parseQa, qualityByAgent, reviewsThisWeek, topTopics, workload, type QaReview, type TeamRow } from "./model";

const AGENT = "11111111-1111-1111-1111-111111111111";
const qa = (over: Partial<QaReview> = {}): QaReview => ({ id: "q", ticketRef: "VAL-1", reviewedAgent: AGENT, reviewerId: null, tone: 4, accuracy: 4, speed: 4, policy: 4, notes: "", createdAt: "2026-11-09T00:00:00Z", ...over });
const row = (over: Partial<TeamRow> = {}): TeamRow => ({ id: "t", reference: "VAL-1", topic: "payments", lane: "new", breached: false, slaLabel: "Due in 3h", holder: null, holderIsMe: false, escalated: false, createdAt: "2026-11-10T00:00:00Z", lastActivityAt: "2026-11-10T00:00:00Z", ...over });
const input = { ticketRef: " val-9 ", agentId: AGENT, tone: "5", accuracy: "4", speed: "3", policy: "2", notes: " clearer " };

describe("parseQa", () => {
  it("upper-cases the reference and keeps four whole scores", () => {
    expect(parseQa(input)).toMatchObject({ value: { ticket_ref: "VAL-9", tone: 5, accuracy: 4, speed: 3, policy: 2, notes: "clearer" } });
  });
  it("refuses a missing reference, an unknown agent, and a score outside 1 to 5 or not whole", () => {
    const r = parseQa({ ...input, ticketRef: "", agentId: "x", tone: "0", accuracy: "6", speed: "2.5", policy: "" });
    expect("fieldErrors" in r && Object.keys(r.fieldErrors).sort()).toEqual(["accuracy", "agentId", "policy", "speed", "ticketRef", "tone"]);
  });
});

describe("quality by agent", () => {
  it("averages each score, names the lowest and puts the lowest overall first", () => {
    const out = qualityByAgent([qa({ tone: 5, speed: 1 }), qa({ tone: 3, speed: 1 }), qa({ reviewedAgent: "b", tone: 5, accuracy: 5, speed: 5, policy: 5 }), qa({ reviewedAgent: null })]);
    expect(out.map((a) => a.agentId)).toEqual([AGENT, "b"]);
    expect(out[0]).toMatchObject({ reviews: 2, tone: 4, speed: 1, lowest: "speed" });
  });
  it("leaves out an agent with no review rather than scoring zero", () => {
    expect(qualityByAgent([])).toEqual([]);
    expect(reviewsThisWeek([qa(), qa({ createdAt: "2026-10-01T00:00:00Z" })], Date.parse("2026-11-10T00:00:00Z"))).toBe(1);
  });
});

describe("parsePolicy", () => {
  it("needs a title and words, and caps the length", () => {
    expect("fieldErrors" in parsePolicy({ title: " ", body: "" })).toBe(true);
    expect("fieldErrors" in parsePolicy({ title: "T", body: "x".repeat(8001) })).toBe(true);
    expect(parsePolicy({ title: " Deposits ", body: " Say this " })).toEqual({ value: { title: "Deposits", body: "Say this" } });
  });
});

describe("workload", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  it("counts open work, who nobody holds, late and escalated, and ignores done tickets", () => {
    const w = workload([row({ holder: "Ada", breached: true }), row({ holder: "Ada" }), row({ holder: null }), row({ lane: "waiting_on_member" }), row({ lane: "done", holder: "Bo" }), row({ escalated: true, holder: "Bo" })], now);
    expect(w).toMatchObject({ open: 5, unassigned: 1, late: 1, escalated: 1 });
    expect(w.byHolder).toEqual([{ name: "Ada", open: 2, late: 1 }, { name: "Bo", open: 1, late: 0 }]);
    expect(w.oldestOpenHours).toBe(12);
  });
  it("is empty and honest with no tickets", () => {
    expect(workload([], now)).toMatchObject({ open: 0, oldestOpenHours: null, byHolder: [] });
  });
});

describe("the repeated-issue tracker", () => {
  it("counts topics case-insensitively with shares, putting not stated last among equals", () => {
    const t = topTopics(["Payments", "payments", null, "account", "payments"]);
    expect(t[0]).toEqual({ topic: "payments", count: 3, share: 60 });
    expect(t.map((x) => x.topic)).toEqual(["payments", "account", "not stated"]);
    expect(topTopics([])).toEqual([]);
  });
  it("finds the median finishing time or says nothing", () => {
    expect(medianHoursToFinish([{ createdAt: "2026-11-01T00:00:00Z", lastActivityAt: "2026-11-01T02:00:00Z" }, { createdAt: "2026-11-01T00:00:00Z", lastActivityAt: "2026-11-01T06:00:00Z" }])).toBe(4);
    expect(medianHoursToFinish([])).toBeNull();
  });
});
