import { MAP_PALETTE } from "./palette";
import { drawLabels, paintVectorTile, placeLabels, type MapLabel } from "./paint";
import type { MapTheme } from "./tiles";
import { loadVectorTile } from "./vector-source";

/**
 * A STILL MAP OF AN AREA, PAINTED ONCE ONTO ONE CANVAS.
 *
 * The still area tiles (Home's stack, a chat's listing card, a listing's Map
 * tab) used to be four raster `<img>` tiles from CARTO. OpenFreeMap serves no
 * raster tiles, and loading a WebGL engine for a picture the size of a
 * thumbnail would be absurd on the phones this is built for, so the frame is
 * painted here from the vector tiles that cover it: usually one or two
 * (about 30 to 50 KB each), never more than four, then the area's place
 * names, clear of the pin.
 *
 * Pure geometry plus one async paint; the component owns when it runs.
 */

const TILE = 256;
const VECTOR = 512;

/** Web Mercator, in CSS pixels at Leaflet zoom `zoom` (256 px tiles). */
export function projectPx(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE * 2 ** zoom;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

/** The vector tiles (512 px, level zoom - 1) a frame centred on a point needs. */
export function tilesForFrame(
  lat: number,
  lng: number,
  zoom: number,
  w: number,
  h: number,
): { left: number; top: number; level: number; tiles: { x: number; y: number }[] } {
  const p = projectPx(lat, lng, zoom);
  const left = p.x - w / 2;
  const top = p.y - h / 2;
  const tiles: { x: number; y: number }[] = [];
  for (let y = Math.floor(top / VECTOR); y <= Math.floor((top + h - 1) / VECTOR); y++) {
    for (let x = Math.floor(left / VECTOR); x <= Math.floor((left + w - 1) / VECTOR); x++) tiles.push({ x, y });
  }
  return { left, top, level: Math.max(0, zoom - 1), tiles };
}

export async function paintStill(
  canvas: HTMLCanvasElement,
  input: { lat: number; lng: number; zoom: number; theme: MapTheme; width: number; height: number; tileJson: string; fontFamily: string },
): Promise<void> {
  const { width: w, height: h } = input;
  const lite = typeof document !== "undefined" && document.documentElement.dataset.motionLite === "on";
  const ratio = lite ? 1 : Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
  const frame = tilesForFrame(input.lat, input.lng, input.zoom, w, h);
  const loaded = await Promise.all(frame.tiles.map((t) => loadVectorTile(input.tileJson, frame.level, t.x, t.y).then((r) => ({ ...r, t }))));

  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const palette = MAP_PALETTE[input.theme];
  ctx.fillStyle = palette.land;
  ctx.fillRect(0, 0, w, h);

  const labels: MapLabel[] = [];
  for (const { tile, at, t } of loaded) {
    const target = {
      ctx,
      size: VECTOR * at.scale,
      ox: t.x * VECTOR - frame.left - at.col * VECTOR,
      oy: t.y * VECTOR - frame.top - at.row * VECTOR,
      zoom: input.zoom,
    };
    paintVectorTile(target, tile, palette);
    labels.push(...placeLabels(target, tile));
  }
  drawLabels(ctx, labels, palette, { w, h, keepClear: { x: w / 2, y: h / 2, r: 22 } }, input.fontFamily, w * h > 60_000 ? 4 : 2);
}
