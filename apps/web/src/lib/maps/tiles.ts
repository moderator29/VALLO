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
 * THERE IS NO PAID PATH. MapTiler was wired in September as the paid way
 * out, read from `NEXT_PUBLIC_MAPTILER_KEY`, and that key is set in the
 * production environment. Kept, it would have put production straight back
 * on MapTiler, the spend the founder declined, the moment this shipped. So the switch was
 * removed with CARTO on 9 November 2026: no variable can move the map onto a
 * provider the founder did not approve, and the policy names one map host.
 *
 * ATTRIBUTION IS NOT DECORATION. The provider's terms require it, so it
 * travels WITH the provider here rather than being hard-coded beside the
 * map. A future provider swap that silently kept the old credit would
 * replace one licence breach with another.
 */

export type MapTheme = "light" | "dark";

export type MapCreditLink = { label: string; href: string };

export type TileProvider = {
  id: "openfreemap";
  /**
   * How the imagery is drawn: a MapLibre style plus the TileJSON its tiles
   * are listed in. There is no `<img>` anywhere.
   */
  kind: "vector";
  /**
   * A raster tile template. ALWAYS EMPTY: OpenFreeMap serves no raster tiles
   * at street zoom. Kept as an empty string (rather than removed) for the
   * staff review panel's mosaic (`app/admin/_review/map-tiles.ts`), which
   * lays out nothing for an empty template, until that panel draws the still
   * area map instead.
   */
  url: string;
  /** The MapLibre style. */
  style: string;
  /** The TileJSON that names the current vector tile URLs. */
  tileJson: string;
  /** Everyone who must be credited, in the order their terms ask for. */
  credits: MapCreditLink[];
  /** Deepest zoom the map may be taken to (vector tiles overzoom past 14). */
  maxZoom: number;
  /**
   * True while the map is on imagery that may not be used commercially.
   * False: kept so a pre-launch check reads one boolean instead of a URL, and
   * so a future swap has to say what it is standing on.
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

const OPENFREEMAP: TileProvider = {
  id: "openfreemap",
  kind: "vector",
  url: "",
  /* One style for both themes; the theme is applied as paint overrides. */
  style: OPENFREEMAP_STYLE,
  tileJson: OPENFREEMAP_TILEJSON,
  credits: OPENFREEMAP_CREDITS,
  maxZoom: 19,
  nonCommercial: false,
};

/**
 * The provider for a theme. One provider and one style serve both themes
 * (`style.ts` repaints it), so the theme does not change the answer; it is
 * taken so callers say which map they are drawing, and so a provider with
 * per-theme styles could be added without touching them.
 */
export function tileProvider(_theme?: MapTheme): TileProvider {
  return OPENFREEMAP;
}

/** True while every provider this build can pick allows commercial use. */
export function hasCommercialTiles(): boolean {
  return !tileProvider("light").nonCommercial && !tileProvider("dark").nonCommercial;
}

/**
 * Say it once, where somebody running the build will see it, IF the map is
 * ever moved back onto imagery that may not be used commercially. Silent on
 * OpenFreeMap. Not a thrown error: a map that renders and says
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
