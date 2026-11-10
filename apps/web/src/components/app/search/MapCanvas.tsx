"use client";

import { Money } from "@/components/ui/Money";
import { useAppliedTheme } from "@/lib/theme/theme-client";
import { tileProvider } from "@/lib/maps/tiles";
import type { BaseLayer } from "@/lib/maps/base-layer";
import { prefersCalm } from "@/lib/ui/calm";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@vallo/i18n/core";
import "leaflet/dist/leaflet.css";
/* C12: the pins and the zoom control, out of `globals.css`. */
import "@/app/css/map.css";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { toggleSave } from "@/lib/saved/actions";
import { addLocalSave, readLocalSaves, removeLocalSave } from "@/lib/saved/local";
import Image from "next/image";
import { MapDock } from "./MapDock";
import { MapCredit } from "./MapCredit";
import { readViewport, writeViewport } from "./map-viewport";
import {
  clusterByGrid,
  fitProjector,
  inBox,
  type GeoBox,
  type LatLng,
  type PinGroup,
  type ScreenPoint,
} from "./mapGeo";
import type { MapCopy, MapListing } from "./mapTypes";
import { countOf, formatNumber } from "@vallo/i18n/core";
import { BrandIcon } from "@/design-system/icons/BrandIcon";
import "./discovery.css";
import "./search-v2.css";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/* What a save on the map did, said by the one banner (founder, 7 November 2026);
   the same words the cards use (components/app/SaveControl.tsx). */
const MAP_SAVE_WORDS = { saved: "Saved to your list", savedOnDevice: "Saved on this device", removed: "Removed from your saved list" };

/**
 * The discovery map.
 *
 * Leaflet is used for exactly one thing: the ground, pan and zoom. Every mark on
 * top of it is an ordinary React button positioned by projecting the listing's
 * coordinate into container space on each frame. That buys three things a
 * divIcon cannot: the pins are real focusable controls with real keyboard
 * behaviour, they carry brand classes rather than injected HTML strings, and
 * the whole surface still works when the tile engine or the tile servers
 * cannot be reached, because the same marks are then projected by a local
 * bounds fitting projector over a branded canvas instead of over a grey void.
 *
 * The docked card is `absolute` inside this frame rather than `fixed`: the map
 * is mounted inside `.nf-card`, whose `backdrop-filter` would become the
 * containing block for any fixed descendant.
 */

/*
 * The tile URLs used to be two constants here, on CARTO's free basemaps, which
 * are NON-COMMERCIAL USE ONLY - and a marketplace taking a booking fee is a
 * commercial use. `lib/maps/tiles.ts` owns the provider now (OpenFreeMap's
 * free, commercial-use vector tiles, no key) and the attribution its terms
 * require; `lib/maps/base-layer.ts` decides how the
 * ground is drawn: MapLibre GL through the Leaflet bridge on a capable
 * device, OpenFreeMap's tiles painted on plain canvases on a budget one or
 * when WebGL or MapLibre cannot be had. Either way Leaflet still owns the
 * camera, so every mark below is projected exactly as before.
 */

/** Grid cell for clustering, in CSS pixels. Roughly two pin widths. */
const CELL = 76;
/** Hard ceiling on drawn marks, so a huge result set cannot stall a phone. */
const MAX_MARKS = 80;
/**
 * The light on the map's marks, from the shared layer (the platform sweep, 23
 * September): a chosen pin and a cluster are the selected state, a resting pin
 * is the glass door, the reader's own dot takes the panel halo. Applied inline
 * because a bare custom property in an arbitrary Tailwind shadow is ambiguous
 * with a shadow colour.
 */
const SELECTED_FILL = "var(--nf-selected-fill)";
const SELECTED_SHADOW = "var(--nf-selected-shadow-inline)";
const HALO = "var(--nf-panel-halo)";

/** Space kept clear at the foot of the frame for the docked card. */
const DOCK_ROOM = 96;

/** Platform listing ids are uuids; catalogue ids are not. Mirrors the save action. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LeafletModule = typeof import("leaflet");
type LeafletMap = import("leaflet").Map;
/** The ground module, loaded with Leaflet by `import()`, never in the route's first load. */
type GroundModule = typeof import("@/lib/maps/base-layer");

type LocatePhase = "idle" | "working" | "located" | "denied" | "unavailable" | "failed";
type Locate = { phase: LocatePhase; at?: LatLng };

export type MapCity = { city: string; lat: number; lng: number; count: number };

export function MapCanvas({
  listings,
  cities,
  active,
  locale,
  copy,
  wholeMapHref,
  unplaced = 0,
  listHref,
  fill = false,
}: {
  /**
   * Fill the parent's height instead of the map's own: the desktop list's
   * sticky map beside the results, whose column sets the height.
   */
  fill?: boolean;
  listings: MapListing[];
  cities: MapCity[];
  /** The text query behind these results. Sets the opening view when it names a city. */
  active?: string;
  locale: Locale;
  copy: MapCopy;
  /** Where "show every place" goes when a query has emptied the map. */
  wholeMapHref: string;
  /** Results with no honest place on the map (their city has no coordinate). */
  unplaced?: number;
  /** The same results as a list, where an unplaced place is still drawn. */
  listHref?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const baseRef = useRef<BaseLayer | null>(null);
  const groundRef = useRef<GroundModule | null>(null);
  const rafRef = useRef(0);
  const tilesLoaded = useRef(0);
  const tilesFailed = useRef(0);
  const locateTimer = useRef<number | null>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tick, setTick] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const [imagery, setImagery] = useState<"loading" | "ready" | "offline">("loading");
  /* THE MAP FOLLOWS THE PAGE'S THEME, live: Vallo's navy at night, paper on
     the light theme (reintroduced 25 September 2026). The effect below
     repaints the ground in place when this changes. */
  const theme = useAppliedTheme();
  /* The credit line belongs to the provider actually serving the map data
     (`lib/maps/tiles.ts`); the same names whatever the theme. */
  const credits = tileProvider(theme).credits;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [soloIds, setSoloIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [areaBox, setAreaBox] = useState<GeoBox | null>(null);
  const [panned, setPanned] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [locate, setLocate] = useState<Locate>({ phase: "idle" });

  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [savePending, startSave] = useSafeTransition();

  /*
   * The city the search landed on. Computed once, from the props the page
   * mounted with, never recomputed as the visitor pans or filters: it marks
   * where the search opened, not whatever happens to be nearest later. Empty
   * when there is no active query or it names a city we have no pin for, so
   * the bloom simply never fires rather than guessing.
   */
  const heroId = useMemo(() => {
    if (!active) return null;
    const city = cities.find((c) => c.city.toLowerCase() === active.trim().toLowerCase());
    if (!city) return null;
    let best: string | null = null;
    let bestDist = Infinity;
    for (const l of listings) {
      const d = (l.lat - city.lat) ** 2 + (l.lng - city.lng) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = l.id;
      }
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------ measurement
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const read = () =>
      setSize({ w: frame.clientWidth, h: frame.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // ------------------------------------------------------------ map engine
  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | undefined;

    const bump = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0;
        setTick((value) => value + 1);
      });
    };

    void (async () => {
      try {
        const [leaflet, ground] = await Promise.all([
          import("leaflet").then((module) => module.default),
          import("@/lib/maps/base-layer"),
        ]);
        if (disposed || !canvasRef.current) return;
        groundRef.current = ground;
        const calm = prefersCalm();
        map = leaflet.map(canvasRef.current, {
          zoomControl: false,
          /* Reduced motion: zooms jump instead of gliding, tiles appear
             instead of fading in. */
          zoomAnimation: !calm,
          fadeAnimation: !calm,
          // Attribution is rendered by this component instead, so it can sit
          // clear of the docked card rather than underneath it.
          attributionControl: false,
          scrollWheelZoom: true,
        });
        map.setView([9.05, 7.5], 5);
        map.on("move zoom resize", bump);
        map.on("dragend", () => setPanned(true));
        /* Every settled move puts the view back in the address, so the link in
           the address bar is always a link to what is on screen. `moveend`
           fires once a pan or a zoom has come to rest, not per frame. */
        map.on("moveend", () => {
          const centre = map?.getCenter();
          const zoom = map?.getZoom();
          if (!centre || typeof zoom !== "number") return;
          writeViewport({ lat: centre.lat, lng: centre.lng, zoom });
        });
        leafletRef.current = leaflet;
        mapRef.current = map;
        setEngineReady(true);
        bump();
      } catch {
        // The engine itself could not load. Nothing is broken: the marks fall
        // back to the local projector over the branded canvas, and the notice
        // says what was lost.
        setImagery("offline");
      }
    })();

    return () => {
      disposed = true;
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      baseRef.current?.remove();
      baseRef.current = null;
      map?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  // The ground follows the active theme: Vallo's navy at night, paper by day.
  // Built once, then repainted in place, so a theme switch never resets the view.
  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    const ground = groundRef.current;
    if (!map || !leaflet || !ground) return;
    if (baseRef.current) {
      baseRef.current.setTheme(theme);
      return;
    }
    baseRef.current = ground.addBaseLayer(leaflet, map, theme, {
      minZoom: 4,
      onLoad: () => {
        tilesLoaded.current += 1;
        setImagery("ready");
      },
      onError: () => {
        tilesFailed.current += 1;
        if (tilesLoaded.current === 0 && tilesFailed.current >= 3) setImagery("offline");
      },
    });
  }, [theme, engineReady]);

  // No tile has painted after a fair wait: say so rather than wait forever.
  // While MapLibre is still arriving (a slow connection, a first visit) the
  // wait is the ground's own: it hands over to the lite map at twelve
  // seconds, and the note is only shown once neither has painted.
  useEffect(() => {
    if (imagery !== "loading") return;
    let timer = 0;
    const check = (after: number, waited: number) => {
      timer = window.setTimeout(() => {
        if (tilesLoaded.current > 0) return;
        if (baseRef.current?.kind() === "gl" && waited < 18_000) check(3000, waited + 3000);
        else setImagery("offline");
      }, after);
    };
    check(6000, 6000);
    return () => window.clearTimeout(timer);
  }, [imagery]);

  /**
   * Opening view: the places themselves.
   *
   * Fitting the results rather than centring on a city coordinate is what
   * makes a city search land on price pins instead of count bubbles. A search
   * for Lagos returns places in Victoria Island, Lekki and Ikoyi, which sit
   * about ten kilometres from the city's own point; centring on the point
   * would push half of them off the frame. Padding keeps the lowest pins clear
   * of the docked card. With nothing to fit, the named city carries the view,
   * and Nigeria carries it when even that is unknown.
   */
  const fitToPlaces = useCallback(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet) return;
    const first = listings[0];
    /* Under reduced motion the view arrives; it never glides to the results. */
    const animate = !prefersCalm();
    if (!first) {
      const focus = active
        ? cities.find((city) => city.city.toLowerCase() === active.trim().toLowerCase())
        : undefined;
      map.setView(focus ? [focus.lat, focus.lng] : [9.05, 7.5], focus ? 12 : 5, { animate });
      return;
    }
    if (listings.length === 1) {
      map.setView([first.lat, first.lng], 13, { animate });
      return;
    }
    map.fitBounds(
      leaflet.latLngBounds(listings.map((l) => [l.lat, l.lng] as [number, number])),
      { paddingTopLeft: [48, 56], paddingBottomRight: [48, DOCK_ROOM + 40], animate },
    );
  }, [listings, cities, active]);

  /**
   * An address that names a viewport is an instruction, and it outranks
   * fitting to the results. That is the whole point of a shared map link: the
   * person who sent it chose that view, and re-fitting to the results on
   * arrival would throw their choice away and show the recipient something
   * different from what the sender was looking at.
   *
   * Read once, on the first fit only. Later fits (a new query, a category
   * change) are the results genuinely changing underneath, and at that point
   * the URL's opening position is stale and must not keep reasserting itself.
   */
  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (!engineReady) return;
    if (!openedFromUrl.current) {
      openedFromUrl.current = true;
      const asked = readViewport(window.location.search);
      if (asked) {
        mapRef.current?.setView([asked.lat, asked.lng], asked.zoom, { animate: false });
        return;
      }
    }
    fitToPlaces();
  }, [engineReady, fitToPlaces]);

  // ------------------------------------------------------------ device saves
  useEffect(() => {
    setSavedIds(new Set(readLocalSaves().map((save) => save.id)));
  }, []);

  useEffect(
    () => () => {
      if (locateTimer.current !== null) window.clearTimeout(locateTimer.current);
    },
    [],
  );

  // ------------------------------------------------------------- projection
  const visible = useMemo(
    () => (areaBox ? listings.filter((l) => inBox(l, areaBox)) : listings),
    [listings, areaBox],
  );

  const points = useMemo<(MapListing & ScreenPoint)[]>(() => {
    // `tick` is the reprojection signal: the engine moved, so every screen
    // position is stale even though not one listing changed.
    void tick;
    const map = mapRef.current;
    if (map && engineReady) {
      return visible.map((l) => {
        const at = map.latLngToContainerPoint([l.lat, l.lng]);
        return { ...l, x: at.x, y: at.y };
      });
    }
    const project = fitProjector(
      visible,
      { w: size.w, h: Math.max(size.h - DOCK_ROOM, 80) },
      56,
    );
    return visible.map((l) => ({ ...l, ...project(l) }));
  }, [visible, engineReady, size.w, size.h, tick]);

  const marks = useMemo(() => {
    const loose: (MapListing & ScreenPoint)[] = [];
    const grouped: (MapListing & ScreenPoint)[] = [];
    for (const point of points) {
      if (soloIds.has(point.id) || point.id === selectedId) loose.push(point);
      else grouped.push(point);
    }

    const bubbles: PinGroup<MapListing & ScreenPoint>[] = [];
    for (const group of clusterByGrid(grouped, CELL)) {
      const only = group.items.length === 1 ? group.items[0] : undefined;
      if (only) loose.push(only);
      else bubbles.push(group);
    }

    // The ceiling is applied to single pins only: a count bubble stands for
    // many listings, so dropping one would hide more than it saves.
    const room = Math.max(MAX_MARKS - bubbles.length, 0);
    if (loose.length <= room) return { pins: loose, bubbles, hidden: 0 };
    const kept = [...loose].sort((a, b) => b.rating - a.rating).slice(0, room);
    return { pins: kept, bubbles, hidden: loose.length - kept.length };
  }, [points, soloIds, selectedId]);

  const selected = useMemo(
    () => visible.find((l) => l.id === selectedId) ?? null,
    [visible, selectedId],
  );

  const userPoint = useMemo<ScreenPoint | null>(() => {
    void tick;
    const at = locate.at;
    const map = mapRef.current;
    if (!at || !map || !engineReady) return null;
    const point = map.latLngToContainerPoint([at.lat, at.lng]);
    return { x: point.x, y: point.y };
  }, [locate.at, engineReady, tick]);

  // ----------------------------------------------------------------- actions
  /*
   * `setSelectedId` is listed here, and again on `fitAll` below, even though a
   * `useState` setter never changes identity and the dependency is therefore a
   * no-op at runtime. It is listed because the React Compiler cannot prove the
   * stability in this particular component: the setter is also captured by the
   * inline `onDismiss` closure handed to `MapDock` at the foot of the tree, and
   * once a setter is captured by a closure the compiler has to hoist out of a
   * conditional branch, it stops treating that identifier as one of its stable
   * values and treats it as an ordinary reactive dependency everywhere. The
   * consequence of leaving it out is not a stale closure, it is that the
   * compiler refuses to optimise the whole of MapCanvas, and this component
   * reprojects every mark on every frame the map moves, so that optimisation is
   * worth more than a tidy dependency array. Nothing about the behaviour of
   * `choose` changes either way.
   */
  const choose = useCallback(
    (listing: MapListing) => {
      setSelectedId(listing.id);
      mapRef.current?.panTo([listing.lat, listing.lng], { animate: !prefersCalm() });
    },
    [setSelectedId],
  );

  const expand = useCallback((group: PinGroup<MapListing & ScreenPoint>) => {
    setSoloIds((previous) => {
      const next = new Set(previous);
      for (const item of group.items) next.add(item.id);
      return next;
    });
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet) return;
    const bounds = leaflet.latLngBounds(group.items.map((item) => [item.lat, item.lng] as [number, number]));
    const fit = { paddingTopLeft: [56, 56] as [number, number], paddingBottomRight: [56, DOCK_ROOM + 24] as [number, number], maxZoom: 16 };
    /* No flight under reduced motion: the view simply arrives. */
    if (prefersCalm()) map.fitBounds(bounds, { ...fit, animate: false });
    else map.flyToBounds(bounds, fit);
  }, []);

  const searchThisArea = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    setAreaBox({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
    setPanned(false);
    setSoloIds(new Set<string>());
  }, []);

  const clearArea = useCallback(() => {
    setAreaBox(null);
    setPanned(false);
    setSoloIds(new Set<string>());
  }, []);

  /**
   * Zoom, as buttons rather than as a gesture only.
   *
   * `zoomControl: false` turns off Leaflet's own pair because they are drawn
   * in Leaflet's styling rather than ours, and nothing replaced them. That
   * left pinch and the scroll wheel as the only way to zoom, which is no way
   * at all on a laptop trackpad in a browser that treats the gesture as page
   * zoom, and nothing whatsoever for somebody using a keyboard or a switch.
   *
   * Leaflet does bind +/- on the focused container, but an invisible shortcut
   * is not an affordance: nothing on screen says it exists.
   */
  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom(map.getZoom() + delta);
  }, []);

  const locateMe = useCallback(() => {
    if (locate.phase === "working") return;
    const geolocation =
      typeof navigator === "undefined" ? undefined : navigator.geolocation;
    if (!geolocation) {
      setLocate({ phase: "unavailable" });
      return;
    }
    setLocate({ phase: "working" });
    if (locateTimer.current !== null) window.clearTimeout(locateTimer.current);
    // A guaranteed end to the wait. A control that spins for ever is a lie.
    locateTimer.current = window.setTimeout(() => {
      setLocate((previous) => (previous.phase === "working" ? { phase: "failed" } : previous));
    }, 11_000);

    geolocation.getCurrentPosition(
      (position) => {
        if (locateTimer.current !== null) window.clearTimeout(locateTimer.current);
        const at = { lat: position.coords.latitude, lng: position.coords.longitude };
        setLocate({ phase: "located", at });
        mapRef.current?.setView([at.lat, at.lng], 13, { animate: !prefersCalm() });
      },
      (error) => {
        if (locateTimer.current !== null) window.clearTimeout(locateTimer.current);
        setLocate({ phase: error.code === error.PERMISSION_DENIED ? "denied" : "failed" });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [locate.phase]);

  const fitAll = useCallback(() => {
    setSoloIds(new Set<string>());
    setSelectedId(null);
    setPanned(false);
    fitToPlaces();
    // `setSelectedId` is here for the reason given at `choose` above: it is a
    // stable setter, so this costs nothing at runtime, and without it the React
    // Compiler bails out of optimising the component.
  }, [fitToPlaces, setSelectedId]);

  const save = useCallback(
    (listing: MapListing) => {
      const wasSaved = savedIds.has(listing.id);
      const onDevice = !UUID_RE.test(listing.id);
      setSavedIds((previous) => {
        const next = new Set(previous);
        if (wasSaved) next.delete(listing.id);
        else next.add(listing.id);
        return next;
      });
      if (onDevice) {
        if (wasSaved) removeLocalSave(listing.id);
        else addLocalSave(listing.id);
      }

      startSave(async () => {
        try {
          const result = await toggleSave({ listingId: listing.id });
          if (result.ok) {
            if (result.data.mode === "db") {
              // The database, not the tap, decides what the shortlist holds.
              const truth = result.data.saved;
              setSavedIds((previous) => {
                const next = new Set(previous);
                if (truth) next.add(listing.id);
                else next.delete(listing.id);
                return next;
              });
              banner(truth ? MAP_SAVE_WORDS.saved : MAP_SAVE_WORDS.removed, { tone: "success", "data-testid": "save-banner" });
            } else {
              banner(wasSaved ? MAP_SAVE_WORDS.removed : MAP_SAVE_WORDS.savedOnDevice, { tone: "success", "data-testid": "save-banner" });
            }
            return;
          }
          if (onDevice) {
            if (wasSaved) addLocalSave(listing.id);
            else removeLocalSave(listing.id);
          }
          setSavedIds((previous) => {
            const next = new Set(previous);
            if (wasSaved) next.add(listing.id);
            else next.delete(listing.id);
            return next;
          });
          /* Said by the one banner at the top of the screen (founder, 7 November 2026). */
          banner.error(result.error, { retry: () => save(listing) });
        } catch (error) {
          if (!tapFailedOffline(error)) throw error;
        }
      });
    },
    [savedIds],
  );

  // -------------------------------------------------------------------- copy
  const counted = countOf(visible.length, "places", locale);
  const countLabel = areaBox ? `${counted} in this area` : `${counted} on this map`;
  const hiddenLabel = marks.hidden > 0 ? ` (${marks.hidden} not drawn at this zoom)` : "";
  // Without the engine there is nothing to recentre, so the success line must
  // not claim the map moved.
  const locateMessage =
    locate.phase === "located" && !engineReady
      ? "Your location was found, but the map cannot recentre without imagery."
      : LOCATE_MESSAGES[locate.phase];
  const approximate = listings.some((l) => !l.byArea);

  return (
    <div
      ref={frameRef}
      id="map-view"
      data-testid="map-view"
      role="region"
      /* Focusable, because a region nobody can reach with a keyboard has no
         keyboard controls no matter what it binds. The Leaflet container
         itself is aria-hidden on purpose (the pins are the real controls and
         they are separate buttons), which means Leaflet's own arrow handling
         sits behind a hidden element. So the panning lives here instead, on
         the element a keyboard actually lands on. */
      tabIndex={0}
      aria-label="Map of places. Every pin is a button, and the list control opens the same places as text. Arrow keys pan, plus and minus zoom."
      className={`relative isolate w-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[var(--nf-brand-primary)] ${
        fill ? "h-full" : "h-[max(26rem,calc(100svh-18rem))] sm:h-[640px]"
      }`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && selectedId) {
          event.stopPropagation();
          setSelectedId(null);
          return;
        }
        const map = mapRef.current;
        if (!map) return;

        /* A fifth of the shorter side per press: far enough that holding the
           key crosses a city at a useful rate, small enough that one press is
           a nudge rather than a jump to somewhere unrecognisable. */
        const box = frameRef.current?.getBoundingClientRect();
        const step = box ? Math.max(40, Math.min(box.width, box.height) / 5) : 80;
        const pan: Record<string, [number, number]> = {
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
        };
        const move = pan[event.key];
        if (move) {
          event.preventDefault();
          map.panBy(move, { animate: !prefersCalm() });
          return;
        }
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          zoomBy(1);
        } else if (event.key === "-" || event.key === "_") {
          event.preventDefault();
          zoomBy(-1);
        }
      }}
    >
      {/*
        The branded canvas. It sits under the tile panes, so it is invisible
        the moment imagery paints and it is the whole surface when imagery
        cannot be reached. Flat neutral ground, a fine graticule on the
        hairline token and, at night only, one soft brand bloom: never a grey
        void, and never a blue wash on paper.
      */}
      <div
        data-testid="map-surface"
        aria-hidden="true"
        className="absolute inset-0 bg-[var(--nf-surface-inset)]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, var(--nf-border-subtle) 0 1px, transparent 1px 48px), repeating-linear-gradient(90deg, var(--nf-border-subtle) 0 1px, transparent 1px 48px)",
        }}
      />
      {theme === "dark" && (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 25%, color-mix(in oklab, var(--nf-brand-primary) 16%, transparent) 0%, transparent 68%)",
          }}
        />
      )}

      {/* Leaflet mounts here. Transparent, so the canvas above shows through. */}
      <div
        ref={canvasRef}
        className="absolute inset-0"
        style={{ background: "transparent" }}
        aria-hidden="true"
      />

      {/* ------------------------------------------------------------- marks */}
      <div className="pointer-events-none absolute inset-0 z-[1000]">
        {marks.bubbles.map((group, i) => (
          <button
            key={group.key}
            type="button"
            data-testid="map-cluster"
            onClick={() => expand(group)}
            style={
              {
                left: group.x,
                top: group.y,
                background: SELECTED_FILL,
                boxShadow: SELECTED_SHADOW,
                "--pin-i": i,
              } as React.CSSProperties
            }
            /* THE SHAPE LAW, AND THE COUNT-BADGE RULING ON TOP OF IT.
               A cluster bubble is a control carrying text, so it was moved off
               `rounded-full` to the control radius. That was right about the
               token and wrong about the ratio. Measured on a production page at
               390 and at 1536: the plate draws 23.2 x 17.12, and 14px of corner
               on a 17px box is clamped by the browser to half the box, so what
               was painted was a TRUE CAPSULE - drawn radius 8.56, ratio 0.50,
               zero flat edge - at every count. The count-badge ruling closes
               this: a count badge is a small text plate on `--nf-radius-xs`,
               the same at one digit and at three, because a shape the content
               chooses is not a decision. 6px on 17.12 is 0.35 with 5px of
               straight edge down each side, and it does not move when the
               padding does. Same fix as `.nf-notif__count` in `home.css`. */
            className="nf-numeric nf-map-cluster-drop nf-tap pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-xs border border-[var(--nf-selected-edge)] px-sm py-xs text-[length:var(--nf-text-caption)] font-bold text-[var(--nf-content-on-brand)] transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nf-focus-ring)] active:scale-95 motion-reduce:transition-none"
          >
            <span className="nf-map-pin-breathe inline-block">{group.items.length}</span>
            <span className="sr-only"> places grouped here, open them</span>
          </button>
        ))}

        {marks.pins.map((pin, i) => {
          const chosen = pin.id === selectedId;
          return (
            <button
              key={pin.id}
              type="button"
              data-testid="map-pin"
              data-selected={chosen ? "true" : undefined}
              data-hero={pin.id === heroId ? "true" : undefined}
              aria-pressed={chosen}
              onClick={() => choose(pin)}
              style={
                {
                  left: pin.x,
                  top: pin.y,
                  zIndex: chosen ? 2 : 1,
                  "--pin-i": i,
                } as React.CSSProperties
              }
              /* THE PHOTO PIN (the founder's map reference, 13 October 2026):
                 the listing's own thumbnail in a circle with a paper ring,
                 larger with the brand ring and a pointer once chosen. A
                 control that carries a picture and no word, so a circle under
                 the shape law. The price it used to print is in its name and
                 on the docked card; `nf-map-pin-hit` keeps the 44px target. */
              className="nf-map-photo nf-map-pin-hit nf-map-pin-drop pointer-events-auto active:scale-95 motion-reduce:transition-none"
            >
              <span className="nf-map-photo__img relative block" aria-hidden="true">
                {pin.photo ? (
                  <Image src={pin.photo} alt="" fill sizes="56px" className="object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center">
                    <UiIcon name="house" size={20} />
                  </span>
                )}
              </span>
              {/* D24: the tick only on a checked place that is not an example. */}
              {pin.verified && !pin.isDemo && (
                <span className="nf-map-photo__tick" aria-hidden="true">
                  <UiIcon name="verified" size={12} />
                </span>
              )}
              <span className="sr-only">
                {/* B15: the price as words, read with the place. */}
                {pin.priceMinor > 0 ? (
                  <Money minor={pin.priceMinor} locale={locale} currency={pin.currency} />
                ) : (
                  pin.kindLabel
                )}
                {`, ${pin.title}, ${pin.area}`}
              </span>
            </button>
          );
        })}

        {userPoint && (
          <span
            aria-hidden="true"
            style={{ left: userPoint.x, top: userPoint.y, boxShadow: HALO }}
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--nf-content-on-brand)] bg-[var(--nf-brand-primary)]"
          />
        )}
      </div>

      {/* ------------------------------------------------------------ chrome */}
      <div className="pointer-events-none absolute inset-0 z-[1100] flex flex-col">
        <div className="flex items-start gap-xs p-sm">
          <p
            data-testid="map-count"
            role="status"
            aria-live="polite"
            className="nf-chip pointer-events-auto min-w-0 max-w-[62%] shrink text-[length:var(--nf-text-overline)]"
          >
            <UiIcon name="map" size={12} className="shrink-0 opacity-70" />
            {/* "23 places on this map" is a sentence, and it was being clipped
                to "23 places on this ma" by two pixels. It wraps now. */}
            <span>
              {countLabel}
              {hiddenLabel}
            </span>
          </p>

          {panned && !areaBox && (
            <Button
              variant="primary"
              size="sm"
              data-testid="map-search-area"
              onClick={searchThisArea}
              leadingIcon="search"
              className="pointer-events-auto ml-auto shrink-0 whitespace-nowrap"
            >
              Search this area
            </Button>
          )}
          {areaBox && (
            <button
              type="button"
              data-testid="map-clear-area"
              onClick={clearArea}
              className="nf-chip pointer-events-auto ml-auto h-8 shrink-0 whitespace-nowrap text-[length:var(--nf-text-overline)]"
            >
              <UiIcon name="arrow-left" size={12} />
              All places
            </button>
          )}
        </div>

        {/* THE LISTING WITH NO PIN (B-27): counted, never guessed onto the
            map, and one tap from the list where it is drawn. */}
        {unplaced > 0 && listHref && copy.noPinOne && copy.noPinMany && (
          <a
            href={listHref}
            data-testid="map-no-pin"
            className="nf-chip pointer-events-auto mx-sm min-h-11 w-fit max-w-[86%] text-[length:var(--nf-text-overline)]"
          >
            <UiIcon name="info" size={12} className="shrink-0 opacity-70" />
            <span>
              {(unplaced === 1 ? copy.noPinOne : copy.noPinMany).replace("{count}", formatNumber(unplaced, locale))}
              {copy.noPinList ? `. ${copy.noPinList}` : ""}
            </span>
          </a>
        )}

        {/*
          THE EMPTY VIEWPORT (B-27). Honest about why, and it offers the way
          back. The matte map pin settles into the frame the way every empty
          shelf's object does (motion 21, `discovery.css`), so an empty map
          reads as the same product as an empty list.
        */}
        {visible.length === 0 && (
          <div
            data-testid="map-empty"
            className="nf-panel nf-panel--card isolate pointer-events-auto mx-auto mt-lg flex w-[min(20rem,86%)] flex-col items-center p-lg text-center"
          >
            <span className="nf-dempty__object" aria-hidden="true">
              <BrandIcon name="map-pin" size={56} />
            </span>
            <p className="mt-sm font-semibold text-[var(--nf-content-primary)]">{copy.emptyTitle ?? "No places here"}</p>
            <p className="mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
              {areaBox
                ? (copy.emptyArea ?? "No place sits inside this part of the map.")
                : (copy.emptySearch ?? "This search matched no place we can put on the map.")}
            </p>
            {areaBox ? (
              <Button variant="secondary" onClick={clearArea} className="mt-md">
                {copy.emptyAction ?? "Show every place"}
              </Button>
            ) : (
              <ButtonLink href={wholeMapHref} variant="secondary" className="mt-md">
                {copy.emptyAction ?? "Show every place"}
              </ButtonLink>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* The state of the imagery, when it failed: a state, so it stays in
            words over the map. The credit is behind the "i" below. */}
        {imagery === "offline" && (
          <p className="pointer-events-auto px-sm pb-2xs text-[length:var(--nf-text-overline)] leading-tight text-[var(--nf-content-muted)]">
            <span data-testid="map-imagery-note">{copy.imageryOffline}</span>
          </p>
        )}

        {/* The foot of the map, above the dock, so a docked card can never
            cover it: the credit as a round "i" (MapLibre's compact
            attribution; whoever the provider's terms name, in the order they
            ask for, one tap away) and the locate control's words. */}
        <div className="flex items-end justify-end gap-xs px-sm pb-xs">
          <div className="mr-auto">
            <MapCredit
              credits={credits}
              join={copy.creditJoin}
              label={copy.about ?? "About this map"}
              heading={copy.credits ?? "Map data"}
              note={approximate ? copy.approximate.replace(/^[\s·]+/, "") : null}
            />
          </div>
          {locateMessage && (
            <p
              role="status"
              aria-live="polite"
              data-testid="map-locate-message"
              className="nf-btn--glass pointer-events-auto mr-auto max-w-[62%] rounded-control px-sm py-xs text-[length:var(--nf-text-overline)] leading-snug text-[var(--nf-content-secondary)]"
            >
              {locateMessage}
            </p>
          )}
        </div>
        {/* The map's own controls, one quiet column at the right edge under
            the count (the reference keeps the map clear): the list, zoom,
            fit and locate. Every one is a 44px round target. */}
        <div
          className={`absolute right-sm top-[4.25rem] flex flex-col gap-2xs ${
            /* On a phone the docked card owns the foot of the frame; the column
               steps aside while it is open and is back the moment it closes. */
            selected && !listOpen ? "max-sm:hidden" : ""
          }`}
        >
          <button
            type="button"
            data-testid="map-list-toggle"
            aria-expanded={listOpen}
            aria-label={listOpen ? "Close the list of places" : "Browse these places as a list"}
            onClick={() => setListOpen((open) => !open)}
            className="nf-icon-btn nf-icon-btn--round pointer-events-auto"
          >
            <UiIcon name="grid" size={16} />
          </button>
          <button
            type="button"
            data-testid="map-zoom-in"
            aria-label="Zoom in"
            onClick={() => zoomBy(1)}
            className="nf-icon-btn nf-icon-btn--round pointer-events-auto"
          >
            <UiIcon name="plus" size={16} />
          </button>
          <button
            type="button"
            data-testid="map-zoom-out"
            aria-label="Zoom out"
            onClick={() => zoomBy(-1)}
            className="nf-icon-btn nf-icon-btn--round pointer-events-auto"
          >
            <UiIcon name="minus" size={16} />
          </button>
          <button
            type="button"
            data-testid="map-fit"
            aria-label="Fit every place in view"
            onClick={fitAll}
            className="nf-icon-btn nf-icon-btn--round pointer-events-auto"
          >
            <UiIcon name="compass" size={16} />
          </button>
          <button
            type="button"
            data-testid="map-locate"
            aria-label="Centre the map on my location"
            aria-busy={locate.phase === "working"}
            onClick={locateMe}
            className="nf-icon-btn nf-icon-btn--round pointer-events-auto"
          >
            <UiIcon
              name="location"
              size={16}
              className={
                locate.phase === "located" ? "text-[var(--nf-brand-primary)]" : undefined
              }
            />
          </button>
        </div>

        {listOpen ? (
          <div
            data-testid="map-list"
            className="nf-panel nf-panel--card pointer-events-auto mx-sm mb-sm max-h-[46%] overflow-hidden p-0"
          >
            <div className="flex items-center justify-between gap-sm border-b border-[var(--nf-panel-hair)] px-sm py-xs">
              <h2 className="text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">
                Places on this map
              </h2>
              <button
                type="button"
                aria-label="Close the list of places"
                onClick={() => setListOpen(false)}
                className="nf-icon-btn h-7 w-7"
              >
                <UiIcon name="chevron-down" size={16} />
              </button>
            </div>
            <ul className="max-h-[14rem] overflow-y-auto">
              {visible.map((listing) => (
                <li key={listing.id}>
                  <button
                    type="button"
                    onClick={() => {
                      choose(listing);
                      setListOpen(false);
                    }}
                    className="flex w-full items-center gap-sm px-sm py-sm text-left hover:bg-[image:var(--nf-btn-glass-fill)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--nf-focus-ring)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">
                        {listing.title}
                      </span>
                      <span className="block truncate text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                        {listing.area}, {listing.city}
                      </span>
                    </span>
                    <span className="nf-numeric shrink-0 text-[length:var(--nf-text-caption)] font-bold text-[var(--nf-content-primary)]">
                      {listing.priceMinor > 0 ? (
                        <Money minor={listing.priceMinor} locale={locale} currency={listing.currency} />
                      ) : (
                        listing.kindLabel
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : selected ? (
          /* Keyed by the place, so choosing another pin lands a new card
             (map.css, `.nf-map-dock`) rather than changing words in place. */
          <MapDock
            key={selected.id}
            listing={selected}
            locale={locale}
            copy={copy}
            saved={savedIds.has(selected.id)}
            saveBusy={savePending}
            onSave={() => save(selected)}
            onDismiss={() => setSelectedId(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * What the locate control says. Every branch ends: there is no state in which
 * the control keeps working with nothing to show for it.
 */
const LOCATE_MESSAGES: Record<LocatePhase, string | null> = {
  idle: null,
  working: "Finding your location.",
  located: "Centred on your location.",
  denied:
    "Location permission is off for this site. Turn it on in your browser settings to centre the map on you.",
  unavailable: "This browser does not offer location, so the map cannot centre on you.",
  failed: "Your location could not be found. Try again.",
};
