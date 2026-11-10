"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { useAppliedTheme } from "@/lib/theme/theme-client";
import { tileProvider } from "@/lib/maps/tiles";
import type { BaseLayer } from "@/lib/maps/base-layer";
import { prefersCalm } from "@/lib/ui/calm";
import "@/app/css/map.css";
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
 * The ground is OpenFreeMap's, drawn by `lib/maps/base-layer.ts` (MapLibre
 * on a capable device, plain canvases on a budget one) and it carries its
 * provider's credit (`lib/maps/tiles.ts` is a licensing module before a
 * rendering one). Without imagery the frame says so in words
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
  const baseRef = useRef<BaseLayer | null>(null);
  /* The theme as of the latest render, read when the ground is first built;
     later changes repaint the ground in place rather than rebuilding the map. */
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
    baseRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    const frame = frameRef.current;
    if (!frame) return;
    void (async () => {
      let leaflet: typeof import("leaflet");
      let ground: typeof import("@/lib/maps/base-layer");
      try {
        /* Both by import(): no map code in the page's first load. */
        [leaflet, ground] = await Promise.all([import("leaflet"), import("@/lib/maps/base-layer")]);
      } catch {
        if (!cancelled) setOffline(true);
        return;
      }
      if (cancelled) return;
      const calm = prefersCalm();
      map = leaflet.map(frame, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
        tap: false,
        zoomAnimation: !calm,
        fadeAnimation: !calm,
      } as import("leaflet").MapOptions);
      let painted = false;
      baseRef.current = ground.addBaseLayer(leaflet, map, themeRef.current, {
        onLoad: () => {
          painted = true;
        },
        onError: () => {
          if (!cancelled && !painted) setOffline(true);
        },
      });
      leaflet
        .circle([lat, lng], { radius: 650, className: "nf-areamap__circle", interactive: false })
        .addTo(map);
    })();
    return () => {
      cancelled = true;
      baseRef.current?.remove();
      baseRef.current = null;
      map?.remove();
    };
  }, [lat, lng]);

  if (offline) {
    return (
      <div className="nf-areamap nf-areamap--offline" role="img" aria-label={label}>
        <p>{unavailable}</p>
      </div>
    );
  }
  return (
    <div className="nf-areamap">
      {/* The picture is named; the credit beside it stays a set of links a
          screen reader can reach (inside a role="img" they would be hidden). */}
      <div ref={frameRef} className="nf-areamap__canvas" role="img" aria-label={label} />
      <p className="nf-areamap__credit">
        {credits.map((credit, index) => (
          <span key={credit.label}>
            {index > 0 ? " · " : null}
            <a href={credit.href} rel="noreferrer noopener" target="_blank">
              {credit.label}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}
