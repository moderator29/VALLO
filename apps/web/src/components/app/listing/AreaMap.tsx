"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { useAppliedTheme } from "@/lib/theme/theme-client";
import { tileProvider, warnIfNonCommercialTiles } from "@/lib/maps/tiles";
import "./area-map.css";

/**
 * THE AREA, NOT THE DOOR: a place's Map tab (the travel-app reference's map
 * card). A calm map with a soft circle over the neighbourhood the place is in.
 *
 * PRIVACY BY CONSTRUCTION. The caller hands in coordinates already rounded to
 * about a kilometre on the server, so the exact position never reaches the
 * browser; the circle is drawn wide enough that nobody reads it as a pin. The
 * exact address arrives with a confirmed booking, as the line above it says.
 *
 * The tiles carry their provider's credit (`lib/maps/tiles.ts` is a licensing
 * module before a rendering one). Without tiles the frame says so in words
 * and names the area, rather than drawing a grey void with a circle in it.
 * The map does not take the page's scroll: one finger scrolls the page, the
 * map pans with a drag once it has been tapped.
 */
export function AreaMap({
  lat,
  lng,
  label,
  unavailable,
}: {
  /** Rounded on the server; never the exact position. */
  lat: number;
  lng: number;
  /** The area's name, for assistive technology and the offline line. */
  label: string;
  unavailable: string;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const theme = useAppliedTheme();
  const [offline, setOffline] = useState(false);
  const credits = tileProvider(theme).credits;

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    const frame = frameRef.current;
    if (!frame) return;
    warnIfNonCommercialTiles();
    void (async () => {
      let leaflet: typeof import("leaflet");
      try {
        leaflet = await import("leaflet");
      } catch {
        if (!cancelled) setOffline(true);
        return;
      }
      if (cancelled) return;
      map = leaflet.map(frame, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
        tap: false,
      } as import("leaflet").MapOptions);
      const provider = tileProvider(theme);
      const tiles = leaflet.tileLayer(provider.url, {
        maxZoom: provider.maxZoom,
        updateWhenIdle: true,
        keepBuffer: 1,
      });
      tiles.on("tileerror", () => {
        if (!cancelled) setOffline(true);
      });
      tiles.addTo(map);
      leaflet
        .circle([lat, lng], { radius: 650, className: "nf-areamap__circle", interactive: false })
        .addTo(map);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, theme]);

  if (offline) {
    return (
      <div className="nf-areamap nf-areamap--offline" role="img" aria-label={label}>
        <p>{unavailable}</p>
      </div>
    );
  }
  return (
    <div className="nf-areamap" role="img" aria-label={label}>
      <div ref={frameRef} className="nf-areamap__canvas" />
      <p className="nf-areamap__credit">
        {credits.map((credit) => (
          <a key={credit.label} href={credit.href} rel="noreferrer noopener" target="_blank">
            {credit.label}
          </a>
        ))}
      </p>
    </div>
  );
}
