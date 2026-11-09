import { setWorkerUrl, type StyleSpecification, type Map as GlMap } from "maplibre-gl";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import type * as Leaflet from "leaflet";

/**
 * MAPLIBRE GL, INSIDE LEAFLET, THROUGH THE OFFICIAL BRIDGE.
 *
 * THIS MODULE IS ONLY EVER REACHED THROUGH `import()` (from `base-layer.ts`),
 * so MapLibre and its worker are fetched by a screen that draws a live map
 * and by nothing else: never by a shared chunk, never by a route that only
 * links to a map.
 *
 * The bridge (`@maplibre/maplibre-gl-leaflet`) draws the vector map as one
 * Leaflet layer in the tile pane. Leaflet keeps the camera, the gestures, the
 * zoom buttons and `latLngToContainerPoint`, so every pin, cluster, docked
 * card and centre pin a map draws on top keeps working unchanged; MapLibre is
 * a non-interactive painter that follows Leaflet's view.
 *
 * THE WORKER. MapLibre 6 decodes tiles in a module worker it finds next to
 * its own script, which a bundler moves. `new URL(..., import.meta.url)`
 * makes the bundler emit the worker as a same-origin static file and hands
 * MapLibre that address, so `worker-src 'self'` covers it and no blob worker
 * is needed.
 */

let workerConfigured = false;

function configureWorker(): void {
  if (workerConfigured) return;
  workerConfigured = true;
  setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
}

export type GlLayer = { layer: Leaflet.Layer; gl: () => GlMap | null };

export function createGlLayer(style: StyleSpecification, options: { calm: boolean }): GlLayer {
  configureWorker();
  const layer = maplibreGL({
    style,
    interactive: false,
    /* No cross-fade of new tiles or labels for a reader who asked for calm. */
    fadeDuration: options.calm ? 0 : 200,
    /* A phone's third device pixel costs memory and frames for nothing a
       reader can see on a map this quiet. */
    pixelRatio: Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1)),
    maxTileCacheSize: 64,
    refreshExpiredTiles: false,
  });
  return {
    layer,
    gl: () => {
      try {
        return layer.getMaplibreMap() ?? null;
      } catch {
        return null;
      }
    },
  };
}
