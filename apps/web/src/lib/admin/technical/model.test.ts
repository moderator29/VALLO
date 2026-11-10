import { describe, expect, it } from "vitest";

import { canMoveIncident, dailyCounts, deploymentInfo, jobHealth, looksLikeSecret, parseCronAction, parseIncident, parseUpdateBody, summariseIncidents, trendWords, type Incident } from "./model";

const inc = (over: Partial<Incident> = {}): Incident => ({
  id: "i", title: "Slow", severity: "sev3", status: "open", startedAt: "2026-11-09T08:00:00Z", resolvedAt: null, summary: "", resolutionSummary: null, createdBy: null,
  createdAt: "x", updatedAt: "x", ...over,
});

describe("secrets never reach the log", () => {
  it.each([
    "the key is sk_live_abcdef1234567890",
    "token: abcdef123456",
    "password = hunter2hunter2",
    "postgres://admin:pass@db.example.com/postgres",
    "-----BEGIN PRIVATE KEY-----",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def",
  ])("refuses %s", (text) => {
    expect(looksLikeSecret(text)).toBe(true);
    expect("error" in parseUpdateBody(text)).toBe(true);
    expect("fieldErrors" in parseIncident({ title: "x", severity: "sev3", summary: text })).toBe(true);
  });
  it("lets ordinary words about keys through", () => {
    expect(looksLikeSecret("Bookings are slow and the token refresh job is late")).toBe(false);
    expect(looksLikeSecret("We rotated the key last week")).toBe(false);
  });
});

describe("incidents", () => {
  it("moves along the allowed moves and reopens a resolved one only to investigating", () => {
    expect(canMoveIncident("open", "resolved")).toBe(true);
    expect(canMoveIncident("resolved", "open")).toBe(false);
    expect(canMoveIncident("resolved", "investigating")).toBe(true);
    expect(canMoveIncident("mitigated", "open")).toBe(false);
  });
  it("needs a title and a real severity", () => {
    expect("fieldErrors" in parseIncident({ title: " ", severity: "sev9", summary: "" })).toBe(true);
    expect(parseIncident({ title: "Slow bookings", severity: "sev2", summary: "since 8am" })).toMatchObject({ value: { severity: "sev2" } });
  });
  it("summarises open, severe, resolved this month and the median hours", () => {
    const now = Date.parse("2026-11-10T12:00:00Z");
    const s = summariseIncidents([inc({ severity: "sev1" }), inc({ status: "resolved", startedAt: "2026-11-05T00:00:00Z", resolvedAt: "2026-11-05T04:00:00Z" }), inc({ status: "resolved", startedAt: "2026-11-06T00:00:00Z", resolvedAt: "2026-11-06T08:00:00Z" })], now);
    expect(s).toMatchObject({ open: 1, sev1or2Open: 1, resolvedThisMonth: 2, medianHoursToResolve: 6 });
    expect(summariseIncidents([], now).medianHoursToResolve).toBeNull();
  });
});

describe("job health", () => {
  const specs = [{ name: "canary", schedule: "Every 5 minutes", maxGapHours: 1 }, { name: "purge", schedule: "Daily", maxGapHours: 26 }, { name: "ghost", schedule: "Daily", maxGapHours: 26 }, { name: "bad", schedule: "Hourly", maxGapHours: 3 }];
  const now = Date.parse("2026-11-10T12:00:00Z");
  it("separates on time, late, failing and never seen, and counts outcomes", () => {
    const runs = [
      { job: "canary", outcome: "ok" as const, at: "2026-11-10T11:50:00Z" },
      { job: "canary", outcome: "attention" as const, at: "2026-11-10T10:00:00Z" },
      { job: "purge", outcome: "ok" as const, at: "2026-11-08T00:00:00Z" },
      { job: "bad", outcome: "failed" as const, at: "2026-11-10T11:00:00Z" },
    ];
    const h = jobHealth(specs, runs, now);
    expect(h.map((j) => j.state)).toEqual(["on_time", "late", "no_run_seen", "failing"]);
    expect(h[0]).toMatchObject({ ok: 1, attention: 1, failed: 0 });
  });
  it("reads an audit action", () => {
    expect(parseCronAction("cron.new-match-alerts.failed")).toEqual({ job: "new-match-alerts", outcome: "failed" });
    expect(parseCronAction("listing.approve")).toBeNull();
  });
});

describe("error trends and deployment", () => {
  it("counts per Lagos day over the window, oldest first", () => {
    const series = dailyCounts(["2026-11-10T10:00:00Z", "2026-11-10T11:00:00Z", "2026-11-09T23:30:00Z", "2020-01-01T00:00:00Z"], 3, "2026-11-10");
    expect(series).toEqual([{ day: "2026-11-08", count: 0 }, { day: "2026-11-09", count: 0 }, { day: "2026-11-10", count: 3 }]);
  });
  it("compares the last seven days with the seven before, in words", () => {
    const flat = (n: number) => Array.from({ length: 14 }, (_, i) => ({ day: String(i), count: i >= 7 ? n : 1 }));
    expect(trendWords(flat(2))).toMatch(/14 in the last seven days, 100% more/);
    expect(trendWords(flat(0))).toMatch(/0 in the last seven days, 100% fewer/);
    expect(trendWords([])).toBeNull();
    expect(trendWords(Array.from({ length: 14 }, (_, i) => ({ day: String(i), count: 0 })))).toMatch(/No errors/);
  });
  it("says only the environment, a short release code and the runtime", () => {
    expect(deploymentInfo({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: "abcdef1234567890", NODE_ENV: "production" })).toEqual({ environment: "production", release: "abcdef1", runtime: "production" });
    expect(deploymentInfo({ VERCEL_GIT_COMMIT_SHA: "not a sha" }).release).toBeNull();
  });
});
