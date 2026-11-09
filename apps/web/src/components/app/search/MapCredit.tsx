"use client";

import { useEffect, useId, useRef, useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import "./search-v2.css";

/**
 * THE MAP'S CREDIT, BEHIND A ROUND "i" (search-map track, 13 October 2026).
 *
 * The map data's terms (OpenMapTiles and OpenStreetMap, served by
 * OpenFreeMap; MapTiler's too, if its key is ever set) require their credit on
 * the map, and they allow it to be compact: MapLibre's own `compact` attribution is a round
 * "i" that opens the credit on a tap. The founder wanted the line of text off
 * the map, so this is that pattern: the credit is always one tap away, it is
 * a real disclosure (`aria-expanded`, `aria-controls`), Escape and a second
 * tap close it, and the links inside are the providers' own pages, in the
 * order their terms ask for. `credits` comes from `lib/maps/tiles.ts`, which
 * names whichever provider is actually serving tiles, so a provider swap
 * cannot leave a stale name here.
 *
 * `note` carries anything else the map has to say about itself that is not a
 * state (pins placed on an area rather than an address), so it sits with the
 * credit rather than as a second line over the map.
 */
export function MapCredit({
  credits,
  join,
  label,
  heading,
  note,
}: {
  credits: readonly { label: string; href: string }[];
  /** The joiner before the last credit, from the dictionary (" and "); earlier ones take a comma. */
  join: string;
  /** The control's accessible name ("About this map"). */
  label: string;
  /** The panel's heading ("Map data"). */
  heading: string;
  note?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  /* A tap anywhere else closes it, as a disclosure on a map should: the map
     is still the thing being used. */
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="nf-map-credit pointer-events-auto"
      data-testid="map-credit"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid="map-credit-toggle"
        onClick={() => setOpen((was) => !was)}
        className="nf-icon-btn nf-icon-btn--round"
      >
        <UiIcon name="info" size={20} />
      </button>
      <div id={panelId} hidden={!open} role="group" aria-label={heading} className="nf-map-credit__panel" data-testid="map-credit-panel">
        <p className="font-semibold text-[var(--nf-content-primary)]">{heading}</p>
        <p>
          {credits.map((credit, i) => (
            <span key={credit.href}>
              {i === 0 ? null : i === credits.length - 1 ? join : ", "}
              <a href={credit.href} target="_blank" rel="noopener noreferrer" className="nf-tap">
                {credit.label}
              </a>
            </span>
          ))}
        </p>
        {note ? <p className="mt-2xs text-[var(--nf-content-muted)]">{note}</p> : null}
      </div>
    </div>
  );
}
