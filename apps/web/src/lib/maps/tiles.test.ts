import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasCommercialTiles, tileProvider } from "./tiles";

/**
 * The licensing module's promises, in the unit suite (the fuller guard is
 * `tests/map-tiles.spec.mjs`, run by hand). OpenFreeMap is free, needs no key
 * and allows commercial use; its terms require the OpenMapTiles and
 * OpenStreetMap credit. Nothing in the environment may move the map off it.
 */
describe("the map's provider", () => {
  it("is OpenFreeMap in both themes, on one named host, with no key", () => {
    for (const theme of ["light", "dark"] as const) {
      const p = tileProvider(theme);
      expect(p.id).toBe("openfreemap");
      expect(p.kind).toBe("vector");
      expect(p).not.toHaveProperty("url");
      expect(p.style).toMatch(/^https:\/\/tiles\.openfreemap\.org\/styles\//);
      expect(p.tileJson).toMatch(/^https:\/\/tiles\.openfreemap\.org\//);
      expect(JSON.stringify(p)).not.toMatch(/key=|maptiler|cartocdn/i);
      expect(p.nonCommercial).toBe(false);
    }
    expect(hasCommercialTiles()).toBe(true);
  });

  it("credits OpenMapTiles and OpenStreetMap, as the terms require, with links", () => {
    const labels = tileProvider("dark").credits.map((c) => c.label);
    expect(labels.some((l) => l.includes("OpenMapTiles"))).toBe(true);
    expect(labels.some((l) => l.includes("OpenStreetMap"))).toBe(true);
    expect(labels).toContain("OpenFreeMap");
    expect(tileProvider("dark").credits.every((c) => c.href.startsWith("https://"))).toBe(true);
  });

  it("reads no provider key from the environment", () => {
    const source = readFileSync(new URL("./tiles.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/process\.env/);
  });
});
