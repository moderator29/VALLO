"use client";

import { useAppliedTheme } from "@/lib/theme/theme-client";
import { tileProvider, warnIfNonCommercialTiles, type MapTheme } from "@/lib/maps/tiles";
import { paintStill } from "@/lib/maps/still";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import "@/app/css/map.css";

/**
 * A STILL MAP OF THE AREA, WITH ITS PIN (the founder's travel-app set, 7
 * October: "a small map tile with a pin"; the listing's Map tab).
 *
 * WHERE THE PIN STANDS. At the AREA, never at the address. The search map
 * already places every listing at its locality's centroid and says "Pins show
 * the area, not the address"; the exact place is a separate read that only a
 * party with a confirmed viewing or an agreement may make (`ExactPlace`). A
 * still tile that put the pin on the listing's own coordinate would publish
 * what the live map deliberately does not, so the caller passes the area's
 * centroid (`areaPoint`) and nothing else.
 *
 * HOW IT DRAWS. From the same provider the live map uses (`tileProvider`).
 * On OpenFreeMap, the free commercial-use provider, the frame is ONE canvas
 * painted from the vector tiles that cover it (`lib/maps/still.ts`): no map
 * engine, no WebGL, usually one or two tiles, in the same palette as the
 * live map, with the area's names kept clear of the pin. It paints when it
 * comes near the screen, not before. With a MapTiler key set (the paid path,
 * kept as it was) it is four raster tiles laid so the point sits at the
 * centre. The credit line is the caller's to show once per screen. On a
 * data-saver connection, or if a tile fails, the frame keeps its quiet ground
 * and the pin, which still says where on the screen's own terms.
 */
const TILE = 256;

/** The map data credit for whichever provider is drawing, as links. */
export function MapCredits({ className }: { className?: string }) {
  const theme = useAppliedTheme();
  const provider = tileProvider(theme === "light" ? "light" : "dark");
  return (
    <span className={className}>
      {provider.credits.map((credit, index) => (
        <span key={credit.href}>
          {index > 0 ? " · " : null}
          <a href={credit.href} target="_blank" rel="noreferrer">
            {credit.label}
          </a>
        </span>
      ))}
    </span>
  );
}

function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/** The vector still: one canvas, painted once it is near the screen and again on a theme change. */
function VectorSheet({ lat, lng, zoom, theme, tileJson, onFail }: { lat: number; lng: number; zoom: number; theme: MapTheme; tileJson: string; onFail(): void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!near || !canvas) return;
    /* A data-saver reader asked for no map imagery (map.css hides the
       sheet too); nothing is fetched. */
    if (document.documentElement.dataset.saveData === "on") return;
    const box = canvas.getBoundingClientRect();
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    if (width < 8 || height < 8) return;
    let cancelled = false;
    const fontFamily = getComputedStyle(canvas).fontFamily || "system-ui, sans-serif";
    paintStill(canvas, { lat, lng, zoom, theme, width, height, tileJson, fontFamily })
      .then(() => {
        if (!cancelled) setPainted(true);
      })
      .catch(() => {
        if (!cancelled) onFail();
      });
    return () => {
      cancelled = true;
    };
  }, [near, lat, lng, zoom, theme, tileJson, onFail]);

  return <canvas ref={ref} className="nf-area-tile__canvas" data-loaded={painted ? "" : undefined} aria-hidden="true" />;
}

export function AreaMapTile({
  lat,
  lng,
  zoom = 14,
  className,
  label,
  credits = false,
}: {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
  /** What the tile shows, for a screen reader: "Map of Lekki Phase 1". */
  label: string;
  /** Draw the map data credit inside the frame (a large tile); a small one
      leaves it to a single credit line elsewhere on the screen. */
  credits?: boolean;
}) {
  const theme = useAppliedTheme();
  const [quiet, setQuiet] = useState(false);
  const goQuiet = useCallback(() => setQuiet(true), []);
  /* Data saver hides the imagery in CSS (`[data-save-data="on"]`, map.css),
     and neither a hidden lazy image nor the vector sheet fetches anything. */
  useEffect(() => {
    warnIfNonCommercialTiles();
  }, []);
  const mapTheme: MapTheme = theme === "light" ? "light" : "dark";
  const provider = tileProvider(mapTheme);

  let sheet: ReactNode = null;
  if (!quiet && provider.kind === "vector" && provider.tileJson) {
    sheet = <VectorSheet lat={lat} lng={lng} zoom={zoom} theme={mapTheme} tileJson={provider.tileJson} onFail={goQuiet} />;
  } else if (!quiet && provider.url) {
    const template = provider.url;
    const point = project(lat, lng, zoom);
    /* The 2 x 2 block whose middle is nearest the point. */
    const tx = Math.round(point.x / TILE) - 1;
    const ty = Math.round(point.y / TILE) - 1;
    const left = point.x - tx * TILE;
    const top = point.y - ty * TILE;
    const tiles = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const;
    sheet = (
      <span className="nf-area-tile__sheet" style={{ transform: `translate(${-left}px, ${-top}px)` }} aria-hidden="true">
        {tiles.map(([dx, dy]) => (
          // eslint-disable-next-line @next/next/no-img-element -- a raster map tile, not content: next/image would proxy and resize every tile for nothing
          <img
            key={`${dx}${dy}`}
            src={template
              .replace("{z}", String(zoom))
              .replace("{x}", String(tx + dx))
              .replace("{y}", String(ty + dy))
              .replace("{r}", "@2x")}
            alt=""
            width={TILE}
            height={TILE}
            loading="lazy"
            decoding="async"
            className="nf-area-tile__img"
            style={{ left: dx * TILE, top: dy * TILE }}
            /* A tile shows only once it has loaded, so a failed one is the
               quiet ground rather than a broken-image glyph. */
            ref={(img) => {
              if (img && img.complete && img.naturalWidth > 0) img.dataset.loaded = "";
            }}
            onLoad={(event) => {
              event.currentTarget.dataset.loaded = "";
            }}
            onError={() => setQuiet(true)}
          />
        ))}
      </span>
    );
  }

  return (
    <span className={["nf-area-tile", className ?? ""].filter(Boolean).join(" ")}>
      {sheet}
      {/* The pin carries the name, so the credit links beside it stay links. */}
      <span className="nf-area-tile__pin" role="img" aria-label={label} />
      {credits && !quiet ? <MapCredits className="nf-area-tile__credits" /> : null}
    </span>
  );
}
