"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useOverlay } from "@/lib/ui/use-overlay";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { MapCredits } from "@/components/app/maps/AreaMapTile";
import "@/app/css/map.css";

/**
 * THE MAP CREDIT, COMPACT (the MapLibre attribution pattern, 13 October 2026).
 *
 * The map data credit ("© OpenMapTiles · © OpenStreetMap contributors ·
 * OpenFreeMap") is a licence requirement
 * and must stay reachable on every map. A line of credit text under a small
 * map is noise on a screen about a home, so the map carries a small round "i"
 * and the credit appears when it is tapped, the way MapLibre's own compact
 * control works. The credit text is the same `MapCredits` the full map uses
 * (links to the providers, from `tileProvider`), so nothing about what is
 * credited changes: only when it is drawn.
 *
 * A disclosure: the button says whether it is open (`aria-expanded`) and what
 * it controls, the credit sits in a labelled group beside it, Escape closes it
 * (and the Android back button, through the overlay registry, since it joins
 * as a non-modal overlay), and so does a tap anywhere else. The visible disc
 * is small; the tap target is 44px (`.nf-mapinfo__btn::after`).
 *
 * Search draws its own map credit; this is for the still tiles on Home.
 */
export function MapCreditsInfo({ label, className }: { label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    button.current?.focus();
  }, []);
  useOverlay({ open, onClose: close, panelRef: root, autoFocus: false, modal: false });

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <span ref={root} className={["nf-mapinfo", className ?? ""].filter(Boolean).join(" ")} data-open={open || undefined}>
      <button
        ref={button}
        type="button"
        className="nf-mapinfo__btn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <UiIcon name="info" size={20} />
      </button>
      <span id={panelId} role="group" aria-label={label} className="nf-mapinfo__panel" hidden={!open}>
        <MapCredits />
      </span>
    </span>
  );
}
