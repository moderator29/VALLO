/**
 * Where the map's imagery comes from, and who has to be credited for it.
 *
 * THIS IS A LICENSING MODULE BEFORE IT IS A RENDERING ONE.
 *
 * THE HISTORY, BECAUSE IT IS THE REASON THIS FILE EXISTS. The map used to draw
 * on CARTO's public basemaps, which are free and NON-COMMERCIAL USE ONLY, and
 * a marketplace taking a booking fee is a commercial use. MapTiler was wired
 * as the paid way out, and the founder did not approve the spend. His ruling
 * of 7 November 2026: move to a FREE provider that allows commercial use, with
 * no paid key and no account.
 *
 * THE PROVIDER NOW: OpenFreeMap (https://openfreemap.org). Checked against its
 * own pages on 9 November 2026 before a line of this was written:
 *   - "Is commercial usage allowed?" "Yes." (the FAQ on openfreemap.org)
 *   - "Using our public instance is completely free: there are no limits on
 *     the number of map views or requests." No registration, no API keys, no
 *     cookies.
 *   - "Attribution is required": MapLibre clients show the source's own
 *     credit; anything else must carry "© OpenMapTiles Data from
 *     OpenStreetMap". Naming OpenFreeMap is optional and done anyway.
 *   - Terms (https://openfreemap.org/tos/): provided as is, with no warranty
 *     and no SLA, and the public instance "may" be discontinued. That is why
 *     every map here still works with no imagery at all.
 *   - Bulk or offline downloading is limited (3,000 tiles or 50 MB per
 *     download). Nothing here downloads ahead; tiles are fetched as viewed.
 *
 * OpenFreeMap serves VECTOR tiles and MapLibre styles from one host,
 * `tiles.openfreemap.org` (styles, tiles, glyphs and sprites all live there).
 * It serves no raster tiles at street zoom, so nothing in this product can
 * point an `<img>` at it: the live maps draw it with MapLibre GL, and the
 * still maps and the lightweight fallback paint the same vector tiles on a 2D
 * canvas (`lib/maps/still.ts`, `lib/maps/lite-layer.ts`).
 *
 * THE MAPTILER PATH IS KEPT, UNCHANGED IN BEHAVIOUR. Set
 * `NEXT_PUBLIC_MAPTILER_KEY` and every map goes back to MapTiler's raster
 * `dataviz` tiles with MapTiler's credit, exactly as before. Nobody needs to
 * set it: it is there so a future paid decision is one variable, not a port.
 *
 * ATTRIBUTION IS NOT DECORATION. Both providers require it in their terms, and
 * it differs between them, so it travels WITH the provider here rather than
 * being hard-coded beside the map. A provider swap that silently kept the
 * wrong credit would replace one licence breach with another.
 */

export type MapTheme = "light" | "dark";

export type MapCreditLink = { label: string; href: string };

export type TileProvider = {
  /** `maptiler` once a key is present, `openfreemap` otherwise. */
  id: "maptiler" | "openfreemap";
  /**
   * How the provider's imagery is drawn. `vector`: a MapLibre style plus the
   * TileJSON its tiles are listed in, no `<img>` anywhere. `raster`: a
   * Leaflet URL template, `{z}/{x}/{y}` with `{r}` for retina.
   */
  kind: "vector" | "raster";
  /** The raster template, for a `raster` provider; null for a vector one. */
  url: string | null;
  /** The MapLibre style, for a `vector` provider; null for a raster one. */
  style: string | null;
  /** The TileJSON that names the current vector tile URLs; null for raster. */
  tileJson: string | null;
  /** Everyone who must be credited, in the order their terms ask for. */
  credits: MapCreditLink[];
  /** Deepest zoom the map may be taken to (vector tiles overzoom past 14). */
  maxZoom: number;
  /**
   * True while the map is on imagery that may not be used commercially. False
   * for both providers now; kept so a pre-launch check reads one boolean
   * instead of a URL, and so a future swap has to say what it is standing on.
   */
  nonCommercial: boolean;
};

const OSM: MapCreditLink = {
  label: "© OpenStreetMap contributors",
  href: "https://www.openstreetmap.org/copyright",
};

/**
 * OpenFreeMap's credit. The two marks its terms REQUIRE come first, in the
 * words its attribution note gives ("© OpenMapTiles Data from
 * OpenStreetMap", with OpenStreetMap's own "© OpenStreetMap contributors"
 * form); OpenFreeMap itself is optional and credited anyway, last.
 */
const OPENFREEMAP_CREDITS: MapCreditLink[] = [
  { label: "© OpenMapTiles", href: "https://www.openmaptiles.org/" },
  OSM,
  { label: "OpenFreeMap", href: "https://openfreemap.org" },
];

/** The one host OpenFreeMap serves styles, tiles, glyphs and sprites from. */
export const OPENFREEMAP_ORIGIN = "https://tiles.openfreemap.org";

/**
 * Positron is the calm base for BOTH themes: muted land, quiet roads, small
 * labels. Vallo's own night and day colours are painted over it at runtime
 * (`lib/maps/style.ts`), so the dark map is the brand's navy and not
 * OpenFreeMap's grey `dark` style, and the two themes share one layer list.
 */
const OPENFREEMAP_STYLE = `${OPENFREEMAP_ORIGIN}/styles/positron`;
const OPENFREEMAP_TILEJSON = `${OPENFREEMAP_ORIGIN}/planet`;

/**
 * MapTiler's `dataviz` styles: muted land, no shouting labels, a genuine dark
 * variant rather than an inverted light one.
 */
const MAPTILER_STYLE: Record<MapTheme, string> = {
  light: "dataviz-light",
  dark: "dataviz-dark",
};

/** Read once. A key that appears mid-session is not a case worth handling. */
const MAPTILER_KEY = (process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "").trim();

export function tileProvider(theme: MapTheme): TileProvider {
  if (MAPTILER_KEY.length > 0) {
    return {
      id: "maptiler",
      kind: "raster",
      url: `https://api.maptiler.com/maps/${MAPTILER_STYLE[theme]}/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`,
      style: null,
      tileJson: null,
      /* MapTiler's terms require both marks, theirs first. */
      credits: [{ label: "© MapTiler", href: "https://www.maptiler.com/copyright/" }, OSM],
      maxZoom: 20,
      nonCommercial: false,
    };
  }

  return {
    id: "openfreemap",
    kind: "vector",
    url: null,
    /* One style for both themes; the theme is applied as paint overrides. */
    style: OPENFREEMAP_STYLE,
    tileJson: OPENFREEMAP_TILEJSON,
    credits: OPENFREEMAP_CREDITS,
    maxZoom: 19,
    nonCommercial: false,
  };
}

/** True while every provider this build can pick allows commercial use. */
export function hasCommercialTiles(): boolean {
  return !tileProvider("light").nonCommercial && !tileProvider("dark").nonCommercial;
}

/**
 * Say it once, where somebody running the build will see it, IF the map is
 * ever moved back onto imagery that may not be used commercially. Silent for
 * both current providers. Not a thrown error: a map that renders and says
 * what it stands on beats one that refuses to render.
 */
let warned = false;

export function warnIfNonCommercialTiles(): void {
  if (warned || hasCommercialTiles()) return;
  warned = true;
  console.warn(
    "[maps] Drawing on map imagery licensed for NON-COMMERCIAL use only. " +
      "See lib/maps/tiles.ts before taking money through this deployment.",
  );
}
