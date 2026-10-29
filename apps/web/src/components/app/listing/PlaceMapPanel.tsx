"use client";

import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { AreaMap } from "./AreaMap";
import { usePhotoViewer } from "./PhotoViewer";
import { PlaceActions } from "./PlaceActions";
import "./area-map.css";

/**
 * A PLACE'S MAP TAB (the travel-app reference's detail: a map card, stat
 * tiles, then Preview and Photo tour tiles). Here: the area map, "getting
 * there" as tiles of facts the place actually published (its area, its
 * check-in and check-out times, its hours), and a Photo tour tile that opens
 * the place's own photographs in the viewer.
 *
 * There is no Preview (video) tile: no stay or restaurant carries a video
 * yet, and a play button over nothing is a promise. It joins when a place
 * has a walkthrough. A fact the place did not publish is not drawn.
 */
export type PlaceFact = { key: string; icon: UiIconName; label: string; value: string };

export function PlaceMapPanel({
  lead,
  coords,
  area,
  unavailable,
  facts,
  photoTour,
  actions,
}: {
  lead: string;
  /** Rounded on the server, or null when the place has no position. */
  coords: { lat: number; lng: number } | null;
  area: string;
  unavailable: string;
  facts: readonly PlaceFact[];
  photoTour: { label: string; caption: string; count: number } | null;
  /** Copy address and Open in Maps, when the page has the words for them. */
  actions?: { copyLabel: string; mapsLabel: string };
}) {
  const viewer = usePhotoViewer();
  return (
    <div className="grid gap-md" data-testid="place-map">
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{lead}</p>
      {actions ? <PlaceActions text={area} point={coords} copyLabel={actions.copyLabel} mapsLabel={actions.mapsLabel} /> : null}
      {coords ? <AreaMap lat={coords.lat} lng={coords.lng} label={area} unavailable={unavailable} /> : null}
      {facts.length > 0 ? (
        <ul className="nf-placefacts">
          {facts.map((fact) => (
            <li key={fact.key} className="nf-placefacts__tile">
              <UiIcon name={fact.icon} size={18} />
              <span className="nf-placefacts__label">{fact.label}</span>
              <span className="nf-placefacts__value">{fact.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {photoTour && photoTour.count > 0 && viewer ? (
        <button type="button" className="nf-phototour" onClick={(event) => viewer.open(0, event.currentTarget.getBoundingClientRect())}>
          <span className="nf-phototour__glyph" aria-hidden="true">
            <UiIcon name="picture" size={20} />
          </span>
          <span className="min-w-0 flex-1 text-start">
            <span className="nf-phototour__title">{photoTour.label}</span>
            <span className="nf-phototour__caption">{photoTour.caption}</span>
          </span>
          <UiIcon name="chevron-right" size={18} />
        </button>
      ) : null}
    </div>
  );
}
