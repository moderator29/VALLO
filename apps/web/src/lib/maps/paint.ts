import type { MvtFeature, MvtTile } from "./mvt";
import type { MapPalette } from "./palette";

/**
 * ONE VECTOR TILE, PAINTED ON A 2D CANVAS IN VALLO'S COLOURS.
 *
 * The lightweight map: no WebGL, no worker, no 300 KB engine. Land, parks,
 * water, roads in four weights and (close in) buildings, in the same palette
 * the MapLibre map is repainted with, so a budget phone and a flagship show
 * the same calm ground at the same place. Place names are drawn separately
 * (`drawLabels`), only where a whole name fits its frame: the still tiles
 * (`still.ts`) see their whole frame at once, and the lite map draws a name
 * only inside the one tile that holds all of it. A label cut in half at a
 * tile edge is worse than no label.
 *
 * Every group of shapes is ONE path and ONE fill or stroke call, so a dense
 * city tile is a few dozen canvas calls rather than thousands.
 */

export type PaintTarget = {
  ctx: CanvasRenderingContext2D;
  /** CSS pixels the WHOLE data tile spans as drawn (larger when overzoomed). */
  size: number;
  /** Where the data tile's top left lands on the canvas, in CSS pixels. */
  ox: number;
  oy: number;
  /** The zoom the map is displayed at, in Leaflet's (256 px) zoom levels. */
  zoom: number;
};

type Pick = (feature: MvtFeature) => boolean;

function trace(target: PaintTarget, tile: MvtTile, layerName: string, pick: Pick, polygons: boolean): boolean {
  const layer = tile.get(layerName);
  if (!layer) return false;
  const { ctx, size, ox, oy } = target;
  const k = size / layer.extent;
  let any = false;
  for (const feature of layer.features) {
    if (polygons ? feature.type !== 3 : feature.type !== 2) continue;
    if (!pick(feature)) continue;
    for (const part of feature.parts) {
      if (part.length < 4) continue;
      ctx.moveTo(ox + (part[0] ?? 0) * k, oy + (part[1] ?? 0) * k);
      for (let i = 2; i + 1 < part.length; i += 2) ctx.lineTo(ox + (part[i] ?? 0) * k, oy + (part[i + 1] ?? 0) * k);
      any = true;
    }
  }
  return any;
}

function fill(target: PaintTarget, tile: MvtTile, layer: string, colour: string, pick: Pick = () => true): void {
  const { ctx } = target;
  ctx.beginPath();
  if (trace(target, tile, layer, pick, true)) {
    ctx.fillStyle = colour;
    ctx.fill();
  }
}

function stroke(target: PaintTarget, tile: MvtTile, layer: string, colour: string, width: number, pick: Pick): void {
  if (width <= 0) return;
  const { ctx } = target;
  ctx.beginPath();
  if (trace(target, tile, layer, pick, false)) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

const cls = (feature: MvtFeature): string => String(feature.props.class ?? "");
const open = (feature: MvtFeature): boolean => feature.props.brunnel !== "tunnel";
const among = (set: readonly string[]): Pick => (feature) => open(feature) && set.includes(cls(feature));

const PATHS = ["path", "track"];
const SERVICE = ["service"];
const MINOR = ["minor"];
const MAJOR = ["primary", "secondary", "tertiary", "trunk"];
const MOTORWAY = ["motorway"];
const RAIL = ["rail", "transit"];

/** A road's weight at this zoom: thin far out, fuller close in, never fat. */
export function roadScale(zoom: number): number {
  return Math.min(2.6, Math.max(0.45, 2 ** ((zoom - 14) * 0.6)));
}

export function paintVectorTile(target: PaintTarget, tile: MvtTile, palette: MapPalette): void {
  const { ctx, zoom } = target;
  /* Each tile paints inside its own square. Tiles carry a margin of shapes
     beyond their edge, and without the clip a neighbour's land would be
     painted over this tile's roads along the seam. */
  ctx.save();
  ctx.beginPath();
  ctx.rect(target.ox, target.oy, target.size, target.size);
  ctx.clip();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const f = roadScale(zoom);

  fill(target, tile, "landuse", palette.residential, (feature) => ["residential", "suburb", "neighbourhood"].includes(cls(feature)));
  fill(target, tile, "landcover", palette.park, (feature) => ["wood", "grass", "park"].includes(cls(feature)));
  fill(target, tile, "park", palette.park);
  fill(target, tile, "water", palette.water, open);
  stroke(target, tile, "waterway", palette.waterway, zoom >= 12 ? 1.4 * f : 0.8, (feature) => open(feature) && cls(feature) === "river");
  if (zoom >= 14) stroke(target, tile, "waterway", palette.waterway, 0.8, (feature) => open(feature) && cls(feature) !== "river");
  if (zoom >= 15) fill(target, tile, "building", palette.building);

  if (zoom >= 15) stroke(target, tile, "transportation", palette.path, 0.9, among(PATHS));
  if (zoom >= 14) stroke(target, tile, "transportation", palette.minor, 1.1 * f, among(SERVICE));
  if (zoom >= 12) stroke(target, tile, "transportation", palette.minor, 1.8 * f, among(MINOR));
  stroke(target, tile, "transportation", palette.rail, 1, among(RAIL));

  const casing = zoom >= 12 ? 1.6 : 0;
  if (casing) {
    stroke(target, tile, "transportation", palette.majorCasing, 3 * f + casing, among(MAJOR));
    stroke(target, tile, "transportation", palette.motorwayCasing, 4 * f + casing, among(MOTORWAY));
  }
  stroke(target, tile, "transportation", palette.major, 3 * f, among(MAJOR));
  stroke(target, tile, "transportation", palette.motorway, 4 * f, among(MOTORWAY));
  ctx.restore();
}

export type MapLabel = { x: number; y: number; text: string; strong: boolean };

const PLACE_ORDER = ["city", "town", "suburb", "village", "quarter", "neighbourhood"];

/** The place names in a tile, positioned on the canvas the tile is painted on. */
export function placeLabels(target: PaintTarget, tile: MvtTile): MapLabel[] {
  const layer = tile.get("place");
  if (!layer) return [];
  const k = target.size / layer.extent;
  const out: (MapLabel & { order: number })[] = [];
  for (const feature of layer.features) {
    if (feature.type !== 1) continue;
    const order = PLACE_ORDER.indexOf(cls(feature));
    if (order < 0) continue;
    const name = feature.props["name:latin"] ?? feature.props["name:en"] ?? feature.props.name_en ?? feature.props.name;
    const point = feature.parts[0];
    if (typeof name !== "string" || name.length === 0 || !point) continue;
    out.push({
      x: target.ox + (point[0] ?? 0) * k,
      y: target.oy + (point[1] ?? 0) * k,
      text: name,
      strong: order < 2,
      order,
    });
  }
  return out.sort((a, b) => a.order - b.order);
}

/**
 * Names, drawn once over the whole frame: the most important first, none
 * overlapping another, none over the pin, none hanging off the edge.
 */
export function drawLabels(
  ctx: CanvasRenderingContext2D,
  labels: readonly MapLabel[],
  palette: MapPalette,
  frame: { w: number; h: number; keepClear?: { x: number; y: number; r: number } },
  fontFamily: string,
  limit = 4,
): void {
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  let drawn = 0;
  for (const label of labels) {
    if (drawn >= limit) break;
    ctx.font = `${label.strong ? 600 : 500} ${label.strong ? 12 : 11}px ${fontFamily}`;
    const w = ctx.measureText(label.text).width + 6;
    const h = label.strong ? 16 : 14;
    const box = { x0: label.x - w / 2, y0: label.y - h / 2, x1: label.x + w / 2, y1: label.y + h / 2 };
    if (box.x0 < 2 || box.y0 < 2 || box.x1 > frame.w - 2 || box.y1 > frame.h - 2) continue;
    const clear = frame.keepClear;
    if (clear) {
      const nx = Math.max(box.x0, Math.min(clear.x, box.x1));
      const ny = Math.max(box.y0, Math.min(clear.y, box.y1));
      if ((nx - clear.x) ** 2 + (ny - clear.y) ** 2 < clear.r ** 2) continue;
    }
    if (placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) continue;
    placed.push(box);
    ctx.strokeStyle = palette.labelHalo;
    ctx.lineWidth = 3;
    ctx.strokeText(label.text, label.x, label.y);
    ctx.fillStyle = label.strong ? palette.labelStrong : palette.label;
    ctx.fillText(label.text, label.x, label.y);
    drawn += 1;
  }
}
