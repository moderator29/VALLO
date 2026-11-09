import type * as Leaflet from "leaflet";
import { MAP_PALETTE } from "./palette";
import { paintVectorTile } from "./paint";
import type { MapTheme } from "./tiles";
import { loadVectorTile } from "./vector-source";

/**
 * THE LIGHTWEIGHT MAP: OpenFreeMap's vector tiles, painted by Leaflet onto
 * plain 2D canvases (the founder's brief: "Low-end Android must stay smooth:
 * keep a lightweight fallback").
 *
 * This is the "raster" fallback, made from the same free, commercial-use
 * source as the WebGL map rather than from a second provider. There is no
 * free raster basemap that allows commercial use at street zoom: CARTO's are
 * non-commercial, MapTiler's cost money, and OpenStreetMap's own tile servers
 * forbid an app from relying on them. So the fallback is made here: each
 * 512 px tile is fetched once (about 30 to 50 KB), decoded on the main thread
 * reading only the eight layers it draws, and painted in one pass. No WebGL,
 * no worker, no MapLibre download.
 *
 * Leaflet's tile events are kept (`tileload`, `tileerror`), so a map treats
 * this layer exactly as it treated a raster tile layer.
 */

type LeafletModule = typeof import("leaflet");

export type LiteLayer = Leaflet.GridLayer & { setTheme(theme: MapTheme): void };

/** Device pixels per CSS pixel for a lite tile: 1 on a budget device. */
function tileRatio(): number {
  const root = typeof document === "undefined" ? undefined : document.documentElement;
  if (root?.dataset.motionLite === "on" || root?.dataset.saveData === "on") return 1;
  return Math.min(2, Math.max(1, Math.round(globalThis.devicePixelRatio || 1)));
}

export function createLiteLayer(
  L: LeafletModule,
  options: { tileJson: string; theme: MapTheme; maxZoom: number; minZoom?: number },
): LiteLayer {
  let theme = options.theme;

  type Grid = Leaflet.GridLayer & { getTileSize(): Leaflet.Point };
  const Lite = L.GridLayer.extend({
    createTile(this: Grid, coords: Leaflet.Coords, done: Leaflet.DoneCallback): HTMLElement {
      const size = this.getTileSize();
      const ratio = tileRatio();
      const canvas = document.createElement("canvas");
      canvas.className = "nf-map-lite-tile";
      canvas.width = size.x * ratio;
      canvas.height = size.y * ratio;
      const ctx = canvas.getContext("2d");
      const palette = MAP_PALETTE[theme];
      if (!ctx) {
        window.setTimeout(() => done(new Error("no 2d context"), canvas), 0);
        return canvas;
      }
      ctx.scale(ratio, ratio);
      ctx.fillStyle = palette.land;
      ctx.fillRect(0, 0, size.x, size.y);

      /* A 512 px Leaflet tile at zoom z is exactly the standard tile at z - 1. */
      loadVectorTile(options.tileJson, coords.z - 1, coords.x, coords.y)
        .then(({ tile, at }) => {
          paintVectorTile({ ctx, size: size.x * at.scale, ox: -at.col * size.x, oy: -at.row * size.y, zoom: coords.z }, tile, palette);
          done(undefined, canvas);
        })
        .catch((error: unknown) => done(error instanceof Error ? error : new Error("tile"), canvas));
      return canvas;
    },
  }) as unknown as new (opts: Leaflet.GridLayerOptions) => Grid;

  const layer = new Lite({
    tileSize: 512,
    maxZoom: options.maxZoom,
    minZoom: options.minZoom ?? 0,
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 1,
    className: "nf-map-lite",
  }) as Grid & Partial<LiteLayer>;

  layer.setTheme = (next: MapTheme) => {
    if (next === theme) return;
    theme = next;
    layer.redraw();
  };
  return layer as LiteLayer;
}
