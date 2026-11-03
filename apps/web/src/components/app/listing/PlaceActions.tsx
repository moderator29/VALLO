"use client";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { useCopy } from "@/lib/ui/use-copy";

/**
 * COPY ADDRESS AND OPEN IN MAPS (29 October 2026, the founder).
 *
 * The address a listing, stay or restaurant shows publicly is the one the
 * place's own page already prints (the area, or a venue's published street
 * line): that is what map apps, messages and an assistant can use, so it is
 * one tap to copy. The exact address of a home stays private until a viewing is
 * confirmed (the panel's own note says so): this copies only what the page
 * shows and never reads anything private.
 *
 * Open in Maps goes to the same position the still map draws, which for a home
 * is the AREA point, never the doorstep. It opens in a new tab (the native
 * shell hands it to the system browser).
 */
export function PlaceActions({
  text,
  point,
  copyLabel,
  mapsLabel,
}: {
  /** What the page prints as the place; copied as is. */
  text: string;
  /** The position the page draws, or null when it has none. */
  point: { lat: number; lng: number } | null;
  copyLabel: string;
  mapsLabel: string;
}) {
  const copy = useCopy();
  if (!text.trim()) return null;
  const query = point ? `${point.lat},${point.lng}` : text;
  return (
    <div className="nf-place-actions" data-testid="place-actions">
      <button type="button" className="nf-btn nf-btn--glass nf-btn--sm" onClick={() => void copy(text, "text")}>
        <UiIcon name="document" size={16} />
        <span className="nf-btn__label">{copyLabel}</span>
      </button>
      <a
        className="nf-btn nf-btn--glass nf-btn--sm"
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <UiIcon name="map" size={16} />
        <span className="nf-btn__label">{mapsLabel}</span>
      </a>
    </div>
  );
}
