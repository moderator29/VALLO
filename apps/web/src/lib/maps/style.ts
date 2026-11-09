import type { StyleSpecification } from "maplibre-gl";
import { MAP_PALETTE, type MapPalette } from "./palette";
import type { MapTheme } from "./tiles";

/**
 * OPENFREEMAP'S POSITRON, REPAINTED IN VALLO'S COLOURS, AT RUNTIME.
 *
 * The style is fetched from OpenFreeMap as published (its sources, glyphs and
 * sprite stay theirs, so their tile URLs and attribution are never copied
 * into this repository and go stale) and every layer's colour is replaced
 * from `MAP_PALETTE` by what the layer IS: water, park, a minor road, a
 * town's name. One base style serves both themes, so a theme switch is a
 * paint change on a map that is already drawn, not a new map.
 *
 * Rules are matched on the layer's id first and its source layer second, so
 * a layer OpenFreeMap adds or renames later still lands in a sensible family
 * instead of keeping a colour from somebody else's palette.
 *
 * Pure: no fetch, no MapLibre at runtime (the import above is a type), so it
 * is tested without a browser.
 */

type Layer = {
  id: string;
  type: string;
  "source-layer"?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};

type Role = keyof MapPalette | "hide";

/** The family a layer belongs to, from its id and source layer. */
export function roleOf(layer: Layer): Role {
  const id = layer.id.toLowerCase();
  const src = (layer["source-layer"] ?? "").toLowerCase();

  if (layer.type === "background") return "land";

  if (layer.type === "symbol") {
    /* Road shields are sprites in another product's colours: a calm map does
       without them, and the road's name still says which road it is. */
    if (/shield/.test(id)) return "hide";
    if (/oneway/.test(id)) return "hide";
    if (src === "water_name" || src === "waterway" || /water/.test(id)) return "waterLabel";
    if (/country|city|town|capital/.test(id)) return "labelStrong";
    return "label";
  }

  if (/dash/.test(id)) return "land";
  if (/pier/.test(id)) return "land";
  if (/ice|glacier/.test(id)) return "land";
  if (src === "water" || id === "water") return "water";
  if (src === "waterway" || /waterway/.test(id)) return "waterway";
  if (src === "park" || /park|wood|grass/.test(id)) return "park";
  if (/residential/.test(id) || src === "landuse") return "residential";
  if (src === "landcover") return "park";
  if (src === "building" || /building/.test(id)) return "building";
  if (src === "boundary" || /boundary/.test(id)) return "boundary";
  if (/rail/.test(id)) return "rail";
  if (src === "aeroway" || /aeroway/.test(id)) return "path";
  if (/motorway/.test(id)) {
    if (/casing|subtle/.test(id)) return "motorwayCasing";
    return "motorway";
  }
  if (/major|trunk|primary|secondary|tertiary/.test(id)) {
    if (/casing|subtle/.test(id)) return "majorCasing";
    return "major";
  }
  if (/path|track/.test(id)) return "path";
  if (src === "transportation" || /highway|road|minor|service/.test(id)) return "minor";
  return "residential";
}

function paintFor(layer: Layer, role: keyof MapPalette, palette: MapPalette): Record<string, unknown> {
  const paint = { ...(layer.paint ?? {}) };
  const colour = palette[role];
  switch (layer.type) {
    case "background":
      paint["background-color"] = colour;
      break;
    case "fill":
      paint["fill-color"] = colour;
      if (role === "building") paint["fill-outline-color"] = palette.buildingEdge;
      else delete paint["fill-outline-color"];
      break;
    case "line":
      paint["line-color"] = colour;
      break;
    case "symbol":
      paint["text-color"] = colour;
      paint["text-halo-color"] = palette.labelHalo;
      paint["text-halo-width"] = 1.4;
      paint["text-halo-blur"] = 0.4;
      break;
    default:
      break;
  }
  return paint;
}

/**
 * The base style with the theme's colours painted over it. Returns a new
 * object; the base is left untouched so it can be painted again in the other
 * theme.
 */
export function themedStyle(base: StyleSpecification, theme: MapTheme): StyleSpecification {
  const palette = MAP_PALETTE[theme];
  const layers = (base.layers as unknown as Layer[]).map((layer) => {
    const role = roleOf(layer);
    if (role === "hide") {
      return { ...layer, layout: { ...(layer.layout ?? {}), visibility: "none" } };
    }
    return { ...layer, paint: paintFor(layer, role, palette) };
  });
  return { ...base, layers: layers as unknown as StyleSpecification["layers"] };
}

/**
 * The base style, fetched once per page and shared by every map on it.
 * A failure is not cached, so the next map to open tries again.
 */
let basePromise: Promise<StyleSpecification> | null = null;

export function loadBaseStyle(url: string): Promise<StyleSpecification> {
  if (!basePromise) {
    basePromise = fetch(url, { credentials: "omit" })
      .then((response) => {
        if (!response.ok) throw new Error(`map style ${response.status}`);
        return response.json() as Promise<StyleSpecification>;
      })
      .catch((error: unknown) => {
        basePromise = null;
        throw error;
      });
  }
  return basePromise;
}
