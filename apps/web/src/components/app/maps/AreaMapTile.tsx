"use client";

import { useAppliedTheme } from "@/lib/theme/theme-client";
import { tileProvider, warnIfNonCommercialTiles, type MapTheme } from "@/lib/maps/tiles";
import { useCallback, useEffect, useRef, useState } from "react";
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
 * HOW IT DRAWS. From the same provider the live map uses (`tileProvider`):
 * OpenFreeMap, the free commercial-use provider. The frame is ONE canvas
 * painted from the vector tiles that cover it (`lib/maps/still.ts`): no map
 * engine, no WebGL, usually one or two tiles, in the same palette as the
 * live map, with the area's names kept clear of the pin. It paints when it
 * comes near the screen, not before. The credit line is the caller's to show
 * once per screen. On a data-saver connection, or if a tile fails, the frame
 * keeps its quiet ground and the pin, which still says where on the screen's
 * own terms.
 */

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

/** The vector still: one canvas, painted once it is near the screen and again on a theme change. */
function VectorSheet({ lat, lng, zoom, theme, tileJson, onFail }: { lat: number; lng: number; zoom: number; theme: MapTheme; tileJson: string; onFail(): void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  /* Without IntersectionObserver (an old webview) the sheet paints at once. */
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || typeof IntersectionObserver === "undefined") return;
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
    /* The painter arrives by import(), so a page with a still map carries none
       of it until a tile nears the screen. */
    import("@/lib/maps/still")
      .then(({ paintStill }) => paintStill(canvas, { lat, lng, zoom, theme, width, height, tileJson, fontFamily }))
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
     and the vector sheet fetches nothing. */
  useEffect(() => {
    warnIfNonCommercialTiles();
  }, []);
  const mapTheme: MapTheme = theme === "light" ? "light" : "dark";
  const provider = tileProvider(mapTheme);

  const sheet = quiet ? null : (
    <VectorSheet lat={lat} lng={lng} zoom={zoom} theme={mapTheme} tileJson={provider.tileJson} onFail={goQuiet} />
  );

  return (
    <span className={["nf-area-tile", className ?? ""].filter(Boolean).join(" ")}>
      {sheet}
      {/* The pin carries the name, so the credit links beside it stay links. */}
      <span className="nf-area-tile__pin" role="img" aria-label={label} />
      {credits && !quiet ? <MapCredits className="nf-area-tile__credits" /> : null}
    </span>
  );
}
