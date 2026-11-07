import { describe, expect, it } from "vitest";

import { isNotLive } from "./degrade";

describe("not live yet", () => {
  it("absent tables, columns and functions are the expected state", () => {
    for (const code of ["42P01", "PGRST205", "42703", "PGRST204", "PGRST200", "42883", "PGRST202"]) {
      expect(isNotLive({ code })).toBe(true);
    }
  });
  it("a refusal or a broken query is a real fault", () => {
    expect(isNotLive({ code: "42501" })).toBe(false);
    expect(isNotLive({ code: "PGRST116" })).toBe(false);
    expect(isNotLive(null)).toBe(false);
    expect(isNotLive("boom")).toBe(false);
  });
});

describe("faults", () => {
  it("keeps real faults only", async () => {
    const { faults } = await import("./degrade");
    expect(faults(null, undefined, { code: "42P01" }, { code: "42501" })).toEqual([{ code: "42501" }]);
  });
});
