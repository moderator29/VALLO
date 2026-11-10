import { decodeTile, type MvtTile } from "./mvt";

/**
 * OPENFREEMAP'S VECTOR TILES, FETCHED AND DECODED FOR THE 2D PAINTERS.
 *
 * Used by the still area tiles and the lightweight fallback map only; the
 * MapLibre map fetches its own tiles in its worker. The tile URLs are not
 * written down here: OpenFreeMap publishes a new planet build every week
 * under a dated path, and the TileJSON (`tileProvider().tileJson`) is where
 * the current one is named. It is read once per page.
 *
 * Fetched with `fetch`, so the host belongs in `connect-src`, not `img-src`
 * (`lib/security/csp.ts`). Cross-origin and anonymous: OpenFreeMap sets no
 * cookies and needs no key, and none is ever sent.
 */

/** The layers the 2D painters draw. Everything else in a tile is skipped. */
const LAYERS: ReadonlySet<string> = new Set([
  "water",
  "waterway",
  "landcover",
  "landuse",
  "park",
  "building",
  "transportation",
  "place",
]);

/** The properties they read. Translated names are never decoded. */
const KEYS: ReadonlySet<string> = new Set(["class", "subclass", "brunnel", "name", "name:latin", "name_en", "name:en"]);

type Source = { template: string; maxzoom: number };

let sourcePromise: Promise<Source> | null = null;

function loadSource(tileJson: string): Promise<Source> {
  if (!sourcePromise) {
    sourcePromise = fetch(tileJson, { credentials: "omit" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`tilejson ${response.status}`);
        const json = (await response.json()) as { tiles?: unknown; maxzoom?: unknown };
        const template = Array.isArray(json.tiles) && typeof json.tiles[0] === "string" ? json.tiles[0] : null;
        if (!template) throw new Error("tilejson: no tile url");
        return { template, maxzoom: typeof json.maxzoom === "number" ? json.maxzoom : 14 };
      })
      .catch((error: unknown) => {
        sourcePromise = null;
        throw error;
      });
  }
  return sourcePromise;
}

/**
 * Where a requested tile's data really lives. Past the source's deepest zoom
 * the data is the ancestor tile, drawn larger: `scale` is how many times, and
 * `col`/`row` say which square of the ancestor the requested tile shows.
 */
export type SourceTile = { z: number; x: number; y: number; scale: number; col: number; row: number };

export function sourceTileFor(level: number, x: number, y: number, maxzoom: number): SourceTile {
  const z = Math.max(0, Math.min(level, maxzoom));
  const scale = 2 ** (level - z);
  const n = 2 ** level;
  const wrapped = ((x % n) + n) % n;
  const ax = Math.floor(wrapped / scale);
  const ay = Math.floor(y / scale);
  return { z, x: ax, y: ay, scale, col: wrapped - ax * scale, row: y - ay * scale };
}

const MAX_CACHED = 48;
const cache = new Map<string, Promise<MvtTile>>();

/**
 * One decoded tile, by its source coordinates. Recently used tiles are kept
 * (a pan back, a theme switch, two still tiles of one area) and the oldest
 * dropped past `MAX_CACHED`; a failed fetch is never cached.
 */
export async function loadVectorTile(tileJson: string, level: number, x: number, y: number): Promise<{ tile: MvtTile; at: SourceTile }> {
  const source = await loadSource(tileJson);
  const at = sourceTileFor(level, x, y, source.maxzoom);
  if (at.y < 0 || at.y >= 2 ** at.z) return { tile: new Map(), at };
  const key = `${at.z}/${at.x}/${at.y}`;
  let pending = cache.get(key);
  if (pending) {
    cache.delete(key);
    cache.set(key, pending);
  } else {
    const url = source.template.replace("{z}", String(at.z)).replace("{x}", String(at.x)).replace("{y}", String(at.y));
    pending = fetch(url, { credentials: "omit" }).then(async (response) => {
      if (response.status === 204) return new Map() as MvtTile;
      if (!response.ok) throw new Error(`tile ${response.status}`);
      return decodeTile(new Uint8Array(await response.arrayBuffer()), LAYERS, KEYS);
    });
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
    while (cache.size > MAX_CACHED) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }
  return { tile: await pending, at };
}
