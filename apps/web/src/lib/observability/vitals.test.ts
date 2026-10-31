import { describe, expect, it } from "vitest";
import { routeTemplate, sanitiseVitals } from "./vitals";

describe("routeTemplate (V-80)", () => {
  it("stores the route pattern and drops ids, queries and fragments", () => {
    expect(routeTemplate("/listing/3653d202-e498-4db0-ab71-882649f7f446?x=1#top")).toBe("/listing/[id]");
    expect(routeTemplate("/search")).toBe("/search");
    expect(routeTemplate("/")).toBe("/");
  });
  it("never keeps whose profile or which slug was read, digits or not", () => {
    expect(routeTemplate("/u/adaokafor")).toBe("/u/[handle]");
    expect(routeTemplate("/u/ada-okafor-2291")).toBe("/u/[handle]");
    expect(routeTemplate("/docs/getting-started")).toBe("/docs/[slug]");
  });
  it("stores a path the route map does not know as one bucket, never as itself", () => {
    expect(routeTemplate("/some/person/typed/this")).toBe("/[other]");
    expect(routeTemplate("/adaokafor")).toBe("/[other]");
  });
});

describe("sanitiseVitals", () => {
  it("reads good metrics into rows", () => {
    const rows = sanitiseVitals({
      path: "/search",
      effectiveType: "3g",
      saveData: true,
      transferKb: 812.4,
      metrics: { LCP: 4200, CLS: 0.03, INP: 180 },
    });
    expect(rows?.map((r) => r.metric).sort()).toEqual(["CLS", "INP", "LCP"]);
    expect(rows?.[0]).toMatchObject({ route: "/search", effective_type: "3g", save_data: true, transfer_kb: 812 });
  });
  it("reads the cold-start figures and labels (fast-start plan item 1)", () => {
    const rows = sanitiseVitals({
      path: "/home",
      cold: true,
      startKind: "instant",
      metrics: { LCP: 900, BOOT_HIDE: 210, BOOT_OPEN: 640 },
    });
    expect(rows?.map((r) => r.metric).sort()).toEqual(["BOOT_HIDE", "BOOT_OPEN", "LCP"]);
    expect(rows?.[0]).toMatchObject({ cold: true, start_kind: "instant" });
  });
  it("ignores a start kind or cold flag it does not know", () => {
    const rows = sanitiseVitals({ path: "/home", cold: "yes", startKind: "teleport", metrics: { LCP: 5 } });
    expect(rows?.[0]).toMatchObject({ cold: null, start_kind: null });
  });
  it("drops what it cannot trust", () => {
    expect(sanitiseVitals({ path: "https://evil.example", metrics: { LCP: 1 } })).toBeNull();
    expect(sanitiseVitals({ path: "/x", metrics: { LCP: -1, CLS: Number.NaN, TTFB: 9e9 } })).toBeNull();
    expect(sanitiseVitals({ path: "/x", effectiveType: "5g", metrics: { LCP: 10 } })?.[0]?.effective_type).toBeNull();
    expect(sanitiseVitals(null)).toBeNull();
  });
});

describe("the launch sampling window (C13)", () => {
  it("reports every view until 15 October 2026, then one in ten", async () => {
    const { sampleRateAt, SAMPLE_RATE } = await import("./vitals");
    expect(sampleRateAt(Date.parse("2026-10-01T12:00:00Z"))).toBe(1);
    expect(sampleRateAt(Date.parse("2026-10-15T12:00:00Z"))).toBe(SAMPLE_RATE);
  });
});
