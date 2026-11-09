import type * as Leaflet from "leaflet";
import { prefersCalm } from "@/lib/ui/calm";
import { createLiteLayer, type LiteLayer } from "./lite-layer";
import { loadBaseStyle, themedStyle } from "./style";
import { tileProvider, warnIfNonCommercialTiles, type MapTheme } from "./tiles";

/**
 * THE GROUND UNDER EVERY LIVE MAP, CHOSEN ONCE PER MAP.
 *
 * Every Leaflet map in the product (search, a stay's area, the price check
 * pin) asks this module for its basemap and gets one of three:
 *
 *   gl     OpenFreeMap's vector tiles drawn by MapLibre GL through the
 *          official Leaflet bridge, in Vallo's colours (`style.ts`). The
 *          default on any device that can carry it. MapLibre is fetched by
 *          `import()` here, so only a screen that draws a live map pays for
 *          it.
 *   lite   The same tiles painted on 2D canvases by Leaflet itself
 *          (`lite-layer.ts`). Chosen when WebGL 2 is missing (MapLibre needs
 *          it), on a budget device (`data-motion-lite`, set before paint in
 *          the root layout for two cores or two gigabytes or less), on a data
 *          saver connection (`data-save-data`), and whenever MapLibre fails to
 *          load or to start. No engine download, no worker, no WebGL.
 *   raster MapTiler's raster tiles, only while `NEXT_PUBLIC_MAPTILER_KEY` is
 *          set: the paid path, kept exactly as it was (`tiles.ts`).
 *
 * The caller hears `onLoad` when imagery has painted and `onError` when a
 * tile could not be had, the same two signals a Leaflet tile layer gave, so
 * no map had to learn a new life cycle. `setTheme` repaints in place: the
 * reader's pan, zoom and pin survive a theme switch on every path.
 */

type LeafletModule = typeof import("leaflet");

export type BaseLayerKind = "gl" | "lite" | "raster";

export type BaseLayer = {
  kind(): BaseLayerKind;
  setTheme(theme: MapTheme): void;
  remove(): void;
};

export type BaseLayerOptions = {
  onLoad?: () => void;
  onError?: () => void;
  minZoom?: number;
  /** Extra options for the raster path's tile layer (MapTiler only). */
  raster?: Leaflet.TileLayerOptions;
};

let webgl2: boolean | null = null;

/** Whether this browser can give MapLibre the WebGL 2 context it needs. Asked once. */
export function webgl2Available(): boolean {
  if (webgl2 !== null) return webgl2;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    webgl2 = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

/** The device or the reader asked for the light path. */
export function liteMapWanted(): boolean {
  if (typeof document === "undefined") return true;
  const root = document.documentElement.dataset;
  return root.motionLite === "on" || root.saveData === "on" || !webgl2Available();
}

/** How long MapLibre may take to show a first frame before the lite map takes over. */
const GL_START_TIMEOUT = 12_000;

export function addBaseLayer(L: LeafletModule, map: Leaflet.Map, initialTheme: MapTheme, options: BaseLayerOptions = {}): BaseLayer {
  warnIfNonCommercialTiles();
  let theme = initialTheme;
  let kind: BaseLayerKind = "lite";
  let current: Leaflet.Layer | null = null;
  let disposed = false;
  let glStyleFor: ((next: MapTheme) => void) | null = null;
  let startTimer: number | null = null;

  const provider = tileProvider(theme);

  const clearTimer = () => {
    if (startTimer !== null) window.clearTimeout(startTimer);
    startTimer = null;
  };

  const detach = () => {
    clearTimer();
    const layer = current;
    current = null;
    glStyleFor = null;
    if (!layer) return;
    try {
      map.removeLayer(layer);
    } catch {
      /* A layer that failed half way through onAdd cannot always remove itself. */
      try {
        map.off((layer as Leaflet.Layer & { getEvents?: () => Leaflet.LeafletEventHandlerFnMap }).getEvents?.() ?? {}, layer);
      } catch {
        /* nothing left to undo */
      }
    }
  };

  const watchTiles = (layer: Leaflet.GridLayer) => {
    layer.on("tileload", () => options.onLoad?.());
    layer.on("tileerror", () => options.onError?.());
  };

  const useRaster = () => {
    kind = "raster";
    const tiles = tileProvider(theme);
    if (!tiles.url) return;
    const layer = L.tileLayer(tiles.url, {
      maxZoom: tiles.maxZoom,
      minZoom: options.minZoom ?? 0,
      detectRetina: true,
      updateWhenIdle: true,
      ...options.raster,
    });
    watchTiles(layer);
    layer.addTo(map);
    current = layer;
  };

  const useLite = () => {
    if (disposed) return;
    detach();
    kind = "lite";
    const tiles = tileProvider(theme);
    if (!tiles.tileJson) return;
    const layer: LiteLayer = createLiteLayer(L, { tileJson: tiles.tileJson, theme, maxZoom: tiles.maxZoom, minZoom: options.minZoom });
    watchTiles(layer);
    layer.addTo(map);
    current = layer;
  };

  const useGl = async () => {
    const tiles = tileProvider(theme);
    if (!tiles.style) return useLite();
    try {
      const [{ createGlLayer }, base] = await Promise.all([import("./gl-layer"), loadBaseStyle(tiles.style)]);
      if (disposed) return;
      const { layer, gl } = createGlLayer(themedStyle(base, theme), { calm: prefersCalm() });
      kind = "gl";
      current = layer;
      layer.addTo(map);
      const glMap = gl();
      if (!glMap) throw new Error("maplibre did not start");
      glStyleFor = (next) => glMap.setStyle(themedStyle(base, next));
      let loaded = false;
      glMap.once("load", () => {
        loaded = true;
        clearTimer();
        options.onLoad?.();
      });
      glMap.on("error", () => {
        if (loaded) options.onError?.();
      });
      /* A context lost for good, or a style that never finishes: hand the
         map to the lite layer rather than leave the reader on a blank ground. */
      startTimer = window.setTimeout(() => {
        if (!loaded) useLite();
      }, GL_START_TIMEOUT);
    } catch {
      useLite();
    }
  };

  if (provider.kind === "raster") useRaster();
  else if (liteMapWanted()) useLite();
  else void useGl();

  return {
    kind: () => kind,
    setTheme(next) {
      if (next === theme || disposed) return;
      theme = next;
      if (kind === "gl" && glStyleFor) glStyleFor(next);
      else if (kind === "lite" && current) (current as LiteLayer).setTheme(next);
      else if (kind === "raster") {
        detach();
        useRaster();
      }
    },
    remove() {
      disposed = true;
      detach();
    },
  };
}
