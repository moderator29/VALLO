/* eslint-disable nf/no-raw-colour -- fixture: OpenFreeMap's own published colours, as data the test replaces */
import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import { MAP_PALETTE } from "./palette";
import { roleOf, themedStyle } from "./style";

/* The shape of OpenFreeMap's Positron, cut down to one layer of each family. */
const BASE = {
  version: 8,
  sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
  layers: [
    { id: "background", type: "background", paint: { "background-color": "rgb(242,243,240)" } },
    { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park", paint: { "fill-color": "rgb(230, 233, 229)" } },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": "rgb(194, 200, 202)" } },
    { id: "building", type: "fill", source: "openmaptiles", "source-layer": "building", paint: { "fill-color": "#eee" } },
    { id: "highway_minor", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#ddd" } },
    { id: "highway_major_casing", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#ccc" } },
    { id: "highway_major_inner", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#fff" } },
    { id: "highway_motorway_inner", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": ["interpolate", ["linear"], ["zoom"], 5.8, "#ddd", 6, "#fff"] } },
    { id: "railway_dashline", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#fafafa" } },
    { id: "highway-shield-non-us", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name", layout: { "icon-image": "x" } },
    { id: "label_city", type: "symbol", source: "openmaptiles", "source-layer": "place", paint: { "text-color": "#000", "text-halo-color": "#fff" } },
    { id: "label_other", type: "symbol", source: "openmaptiles", "source-layer": "place", paint: { "text-color": "#333" } },
    { id: "water_name_point_label", type: "symbol", source: "openmaptiles", "source-layer": "water_name", paint: { "text-color": "#495e91" } },
  ],
} as unknown as StyleSpecification;

type L = { id: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> };
const byId = (style: StyleSpecification, id: string) => (style.layers as unknown as L[]).find((l) => l.id === id);

describe("the map style in Vallo's colours", () => {
  it("sorts layers into families by what they are", () => {
    const layers = BASE.layers as unknown as Parameters<typeof roleOf>[0][];
    const roles = Object.fromEntries(layers.map((l) => [l.id, roleOf(l)]));
    expect(roles).toMatchObject({
      background: "land",
      park: "park",
      water: "water",
      building: "building",
      highway_minor: "minor",
      highway_major_casing: "majorCasing",
      highway_major_inner: "major",
      highway_motorway_inner: "motorway",
      railway_dashline: "land",
      "highway-shield-non-us": "hide",
      label_city: "labelStrong",
      label_other: "label",
      water_name_point_label: "waterLabel",
    });
  });

  it("paints night as Vallo's navy, never OpenFreeMap's grey, with readable labels", () => {
    const dark = themedStyle(BASE, "dark");
    const p = MAP_PALETTE.dark;
    expect(byId(dark, "background")?.paint?.["background-color"]).toBe(p.land);
    expect(byId(dark, "water")?.paint?.["fill-color"]).toBe(p.water);
    expect(byId(dark, "highway_motorway_inner")?.paint?.["line-color"]).toBe(p.motorway);
    expect(byId(dark, "label_city")?.paint?.["text-color"]).toBe(p.labelStrong);
    expect(byId(dark, "label_city")?.paint?.["text-halo-color"]).toBe(p.labelHalo);
    /* Every fill and line colour on the night map carries blue: B > R and B > G. */
    for (const colour of [p.land, p.residential, p.park, p.water, p.minor, p.major, p.motorway, p.building]) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16)) as [number, number, number];
      expect(b, colour).toBeGreaterThan(r);
      expect(b, colour).toBeGreaterThan(g);
    }
  });

  it("paints day calm and light, and hides road shields in both", () => {
    const light = themedStyle(BASE, "light");
    expect(byId(light, "background")?.paint?.["background-color"]).toBe(MAP_PALETTE.light.land);
    expect(byId(light, "highway-shield-non-us")?.layout?.visibility).toBe("none");
    expect(byId(themedStyle(BASE, "dark"), "highway-shield-non-us")?.layout?.visibility).toBe("none");
  });

  it("keeps the provider's sources, glyphs and sprite, and leaves the base untouched", () => {
    const before = JSON.stringify(BASE);
    const dark = themedStyle(BASE, "dark");
    expect(dark.sources).toBe(BASE.sources);
    expect(dark.glyphs).toBe(BASE.glyphs);
    expect(dark.sprite).toBe(BASE.sprite);
    expect(JSON.stringify(BASE)).toBe(before);
  });
});
