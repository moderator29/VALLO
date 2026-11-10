import { describe, expect, it } from "vitest";

import { contentRows, marketingRows, supportLeadRows, technicalRows } from "./prefill";

/** The weekly report's prefill for the four desks: real counts only, each marked as the desk's own. */
const WEEK = "2026-11-09";
const IN = "2026-11-10T09:00:00Z";
const OUT = "2026-11-01T09:00:00Z";
const entry = (kind: string, createdAt: string) => ({ id: kind + createdAt, desk: "marketing", kind, title: "T", body: "", status: "open", dueOn: null, linkUrl: null, subjectUser: null, fields: {}, reviewNote: null, approvedBy: null, approvedAt: null, ownerId: null, createdBy: null, createdAt, updatedAt: createdAt }) as never;
const value = (rows: { label: string; value: number }[], label: string) => rows.find((r) => r.label === label)?.value;

describe("prefill for the four desks", () => {
  it("counts a marketing week from campaigns, results and notes", () => {
    const campaigns = [{ createdAt: IN, approvedAt: IN, status: "planned", startsOn: "2026-11-11" }, { createdAt: OUT, approvedAt: null, status: "draft", startsOn: null }] as never[];
    const results = [{ createdAt: IN, voidedAt: null }, { createdAt: IN, voidedAt: IN }] as never[];
    const rows = marketingRows(campaigns, results, [entry("creative_brief", IN), entry("ab_test", OUT)], WEEK);
    expect(value(rows, "Campaigns planned")).toBe(1);
    expect(value(rows, "Campaigns approved")).toBe(1);
    expect(value(rows, "Campaigns started")).toBe(1);
    expect(value(rows, "Results logged")).toBe(1);
    expect(value(rows, "Creative briefs written")).toBe(1);
    expect(value(rows, "A/B tests logged")).toBe(0);
    expect(rows.every((r) => r.source === "desk" && r.deskValue === r.value && r.target === null)).toBe(true);
  });

  it("counts a content week", () => {
    const items = [{ createdAt: IN, approvedAt: IN, status: "published", publishedAt: IN }, { createdAt: OUT, approvedAt: null, status: "draft", publishedAt: null }] as never[];
    const rows = contentRows(items, [entry("content_request", IN), entry("seo_check", IN), entry("publish_check", IN)], WEEK);
    expect([value(rows, "Items started"), value(rows, "Items approved"), value(rows, "Items published"), value(rows, "Requests received"), value(rows, "Checklists run")]).toEqual([1, 1, 1, 1, 2]);
  });

  it("counts a technical week from incidents declared and resolved", () => {
    const incidents = [{ startedAt: IN, resolvedAt: IN }, { startedAt: OUT, resolvedAt: null }] as never[];
    const rows = technicalRows(incidents, [entry("runbook", IN), entry("incident_review", IN)], WEEK);
    expect([value(rows, "Incidents declared"), value(rows, "Incidents resolved"), value(rows, "Runbooks written"), value(rows, "Post-incident reviews written")]).toEqual([1, 1, 1, 1]);
  });

  it("counts a support lead week", () => {
    const rows = supportLeadRows([{ createdAt: IN }, { createdAt: OUT }] as never[], [{ createdAt: IN, approvedAt: IN }] as never[], [entry("macro", IN), entry("coaching_note", IN), entry("kb_gap", OUT)], WEEK);
    expect([value(rows, "Quality reviews written"), value(rows, "Policy notes written"), value(rows, "Policy notes approved"), value(rows, "Canned replies written"), value(rows, "Coaching notes written"), value(rows, "Knowledge-base gaps logged")]).toEqual([1, 1, 1, 1, 1, 0]);
  });
});
