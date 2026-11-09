import type { MapTheme } from "./tiles";

/**
 * VALLO'S TWO MAP GROUNDS, AS PLAIN COLOURS.
 *
 * A WebGL map and a 2D canvas cannot read a CSS custom property, so the map's
 * colours are written here once and shared by every painter: the MapLibre
 * style overrides (`style.ts`), the lightweight canvas layer
 * (`lite-layer.ts`) and the still area tiles (`still.ts`). They are chosen
 * against the design tokens rather than copied from them, and the anchors are
 * named beside each so a token change has somewhere to be checked.
 *
 * NIGHT IS THE DEFAULT, AND IT IS NAVY, NEVER GREY. The page is `#000612`
 * (`--nf-surface-canvas`), a raised surface is about `#0b1838`, the accent is
 * `#0066FF`. The land sits one breath above the page, water is the deepest
 * clear blue on the map, and the roads are lit in the brand's blue family so
 * the whole ground reads as one lit navy sheet with the pins on top. Nothing
 * here is a neutral grey: every value carries the brand's hue.
 *
 * DAY IS CALM AND CLEAN. Near-white land, soft blue water, a whisper of green
 * for parks, white roads with hairline casings and quiet slate labels: the
 * paper the pins stand on, not a picture competing with them.
 */
export type MapPalette = {
  land: string;
  residential: string;
  park: string;
  water: string;
  waterway: string;
  building: string;
  buildingEdge: string;
  path: string;
  minor: string;
  majorCasing: string;
  major: string;
  motorwayCasing: string;
  motorway: string;
  rail: string;
  boundary: string;
  /** Ordinary labels: suburbs, roads, airports. */
  label: string;
  /** The names a reader steers by: towns, cities, countries. */
  labelStrong: string;
  labelHalo: string;
  waterLabel: string;
};

export const MAP_PALETTE: Record<MapTheme, MapPalette> = {
  dark: {
    land: "#020b1f",
    residential: "#041029",
    park: "#03182f",
    water: "#071d4d",
    waterway: "#0a2766",
    building: "#06122e",
    buildingEdge: "#0b1838",
    path: "#0b1838",
    minor: "#0e1e48",
    majorCasing: "#0b1838",
    major: "#173270",
    motorwayCasing: "#0d2456",
    motorway: "#1f4ea8",
    rail: "#10224f",
    boundary: "#23468f",
    label: "#8fa8dc",
    labelStrong: "#c8d7ff",
    labelHalo: "#000612",
    waterLabel: "#6a90e0",
  },
  light: {
    land: "#f5f6f8",
    residential: "#eff1f4",
    park: "#e3eee4",
    water: "#cfe0f4",
    waterway: "#b9d1ee",
    building: "#e8ebf0",
    buildingEdge: "#dde1e8",
    path: "#eceef2",
    minor: "#e3e7ee",
    majorCasing: "#dfe3ea",
    major: "#ffffff",
    motorwayCasing: "#d3d9e4",
    motorway: "#fdfdfe",
    rail: "#d9dde4",
    boundary: "#b4bccb",
    label: "#5b6371",
    labelStrong: "#262c36",
    labelHalo: "#ffffff",
    waterLabel: "#45689a",
  },
};
