"use client";

import { useAppliedTheme } from "@/lib/theme/theme-client";
import { useCallback, useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "@/app/css/map.css";
import { tileProvider } from "@/lib/maps/tiles";
import type { BaseLayer } from "@/lib/maps/base-layer";
import { prefersCalm } from "@/lib/ui/calm";
import { NIGERIA_CENTRE, withinNigeria } from "@/lib/price-check/address";

/**
 * RUNG FOUR OF THE LADDER: A MAP, NOT A TEXT FIELD.
 *
 * ---------------------------------------------------------------------------
 * WHY A PIN AT ALL.
 *
 * There is no geocoder in this tree. `lib/maps` is a tile licensing module
 * and the painters for its imagery, nothing more. A geocoder for Nigeria is a
 * licensing decision, a cost and a dependency, and it would be wrong more
 * often than a person dragging a pin. More to the point, many Nigerian
 * properties have no formal address at all, so a field demanding one refuses
 * those people and a parser guessing at one invents a building.
 *
 * A pin is more accurate than any Nigerian street address, it needs no parser,
 * it needs no normaliser, and it is the exact input `ST_DWithin` wants.
 *
 * ---------------------------------------------------------------------------
 * THE PIN DOES NOT MOVE. THE MAP DOES.
 *
 * The marker is a div fixed at the centre of the frame and the map pans under
 * it, which is the pattern every ride-hailing and delivery application in
 * Nigeria uses, and it is better than a draggable marker for two reasons that
 * are both about a thumb. A draggable marker on a phone is under the finger
 * that is dragging it, so the thing being placed is the thing being hidden.
 * And a marker has a hit area of about forty pixels while the map has the
 * whole frame, so a centre pin turns a fiddly drag into an ordinary pan.
 *
 * `MapCanvas.tsx` projects its marks onto the frame every frame for the
 * discovery map, for reasons its own header gives. This surface has ONE mark
 * and it never moves relative to the frame, so it needs none of that: the pin
 * is a static element and the coordinate is read off the map's centre.
 *
 * ---------------------------------------------------------------------------
 * AND IT WORKS WITH NO TILES AT ALL.
 *
 * If the tile engine or the tile servers cannot be reached, the frame says so
 * and the rest of the screen keeps working, because the pin is a COORDINATE
 * and not a picture. A grey void with a marker floating in it would be worse
 * than a sentence: the reader would not know whether the pin was anywhere.
 */

type LeafletModule = typeof import("leaflet");
type LeafletMap = import("leaflet").Map;

export type PinMapCopy = {
  help: string;
  placed: string;
  missing: string;
  outsideNigeria: string;
  unavailable: string;
};

export function PinMap({
  lat,
  lng,
  onMove,
  copy,
  /** Where to look when no pin has been dropped: the chosen area, or Nigeria. */
  centreOn,
}: {
  lat: number | null;
  lng: number | null;
  onMove(next: { lat: number; lng: number }): void;
  copy: PinMapCopy;
  centreOn?: { lat: number; lng: number } | null;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  /* The latest `onMove` without re-creating the map when it changes identity.
     Written in an effect rather than during render: a ref assignment in a
     render body is not safe under concurrent rendering, and `react-hooks/refs`
     is right to say so. The map is mounted once and reads this on `moveend`,
     which is always after paint. */
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  const [imagery, setImagery] = useState<"loading" | "ready" | "offline">("loading");
  /* THE MAP FOLLOWS THE PAGE'S THEME, live (track L; light mode came back on
     25 September 2026). Vallo's navy at night, paper on the light theme. The
     map is built once below with the theme it opened in, and the effect after
     it repaints only the ground when the theme changes
     (`lib/maps/base-layer.ts`), so the reader's pan, zoom and pin are never
     lost to a switch. */
  const theme = useAppliedTheme();
  const baseRef = useRef<BaseLayer | null>(null);
  /* The theme as of the latest render. The first render after hydration
     answers the server's "dark", and Leaflet loads asynchronously, so the map
     reads this ref at the moment it adds its tiles rather than the value it
     was mounted with; `tilesReady` then lets the swap below catch any change
     that landed while Leaflet was still loading. */
  const themeRef = useRef(theme);
  const [tilesReady, setTilesReady] = useState(false);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  /* The credit belongs to whichever provider is actually serving tiles, and it
     travels WITH the tile URL rather than being written beside the map: a
     provider swap that silently kept the wrong credit would replace one
     licence breach with another. */
  const credits = tileProvider(theme).credits;

  useEffect(() => {
    let cancelled = false;
    const frame = frameRef.current;
    if (!frame) return;

    void (async () => {
      let leaflet: LeafletModule;
      let ground: typeof import("@/lib/maps/base-layer");
      try {
        /* Both by import(): no map code in the page's first load. */
        [leaflet, ground] = await Promise.all([import("leaflet"), import("@/lib/maps/base-layer")]);
      } catch {
        if (!cancelled) setImagery("offline");
        return;
      }
      if (cancelled) return;

      const start = lat !== null && lng !== null ? { lat, lng } : (centreOn ?? NIGERIA_CENTRE);
      const map = leaflet.map(frame, {
        center: [start.lat, start.lng],
        /* 16 with a pin already placed, because the reader is checking a
           building; 6 with nothing placed, because the reader is finding a
           city and a country-wide view is the only honest starting point when
           we do not know where they are. */
        zoom: lat !== null ? 16 : 6,
        zoomControl: true,
        attributionControl: false,
        /* Reduced motion: zooms jump instead of gliding. */
        zoomAnimation: !prefersCalm(),
        fadeAnimation: !prefersCalm(),
      });
      mapRef.current = map;

      let painted = false;
      baseRef.current = ground.addBaseLayer(leaflet, map, themeRef.current, {
        onLoad: () => {
          painted = true;
          if (!cancelled) setImagery("ready");
        },
        onError: () => {
          if (!cancelled && !painted) setImagery("offline");
        },
      });
      if (!cancelled) setTilesReady(true);

      /* `moveend` and not `move`: one coordinate per gesture rather than one
         per frame, so a pan does not fire sixty server-bound state updates. */
      map.on("moveend", () => {
        const centre = map.getCenter();
        onMoveRef.current({ lat: centre.lat, lng: centre.lng });
      });

      if (!cancelled) setImagery((was) => (was === "offline" ? was : "ready"));
    })();

    return () => {
      cancelled = true;
      baseRef.current?.remove();
      baseRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    /* Mounted once. The pin's position is an OUTPUT of this map, so reacting
       to it here would fight the user's own pan. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The ground's repaint for a theme change, in place. `tilesReady` catches a
     change that landed while Leaflet was still loading. */
  useEffect(() => {
    baseRef.current?.setTheme(theme);
  }, [theme, tilesReady]);

  const recentre = useCallback(() => {
    const map = mapRef.current;
    if (!map || !centreOn) return;
    map.setView([centreOn.lat, centreOn.lng], 13, { animate: !prefersCalm() });
  }, [centreOn]);

  useEffect(() => {
    if (lat === null && centreOn) recentre();
  }, [centreOn, lat, recentre]);

  const placed = lat !== null && lng !== null;
  const outside = placed && !withinNigeria(lat, lng);

  return (
    <div>
      <div className={`nf-pc-map${imagery === "offline" ? " nf-pc-map--offline" : ""}`}>
        {imagery === "offline" ? (
          <p className="nf-body-sm text-[var(--nf-content-muted)]">{copy.unavailable}</p>
        ) : (
          <>
            <div ref={frameRef} className="nf-pc-map__canvas" aria-hidden="true" />
            {/* The pin is decorative to assistive technology: the coordinate it
                stands for is announced by the status line below, which is text
                a screen reader can actually read. */}
            <div className="nf-pc-pin" aria-hidden="true">
              <div className="nf-pc-pin__head" />
              <div className="nf-pc-pin__stem" />
            </div>
            <p className="nf-pc-map__credit">
              {credits.map((credit, index) => (
                <span key={credit.label}>
                  {index > 0 ? " · " : null}
                  <a href={credit.href} rel="noreferrer noopener" target="_blank" className="nf-tap">
                    {credit.label}
                  </a>
                </span>
              ))}
            </p>
          </>
        )}
      </div>
      <p className="mt-inline nf-body-sm text-[var(--nf-content-muted)]">{copy.help}</p>
      <p className="mt-inline-tight nf-caption" role="status">
        {outside ? copy.outsideNigeria : placed ? copy.placed : copy.missing}
      </p>
    </div>
  );
}
