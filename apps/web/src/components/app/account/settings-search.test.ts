import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { matchSettings, settingsSections } from "./settings-search";

const t = getDictionary("en");

describe("settings search on the hub", () => {
  it("sends every match to the screen that holds the control", () => {
    for (const entry of settingsSections(t)) {
      expect(entry.href.startsWith("/settings/")).toBe(true);
    }
  });

  it("finds the language control by a language's own name", () => {
    const hits = matchSettings(settingsSections(t), "Hausa");
    expect(hits.map((entry) => entry.href)).toContain("/settings/appearance#settings-appearance");
  });

  it("finds notifications under the word a person would type", () => {
    const hits = matchSettings(settingsSections(t), "notif");
    expect(hits.some((entry) => entry.href.startsWith("/settings/notifications"))).toBe(true);
  });

  it("finds the currency control by a currency's name or code", () => {
    for (const query of ["currency", "pounds", "cedi", "GBP", "square feet"]) {
      const hits = matchSettings(settingsSections(t), query);
      expect(hits.map((entry) => entry.href), query).toContain("/settings/region#settings-money-display");
    }
  });

  it("returns everything for an empty query and nothing for nonsense", () => {
    const all = settingsSections(t);
    expect(matchSettings(all, "   ")).toHaveLength(all.length);
    expect(matchSettings(all, "zzqx-nothing")).toHaveLength(0);
  });
});
