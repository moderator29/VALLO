"use client";

import { useId, useRef, useState } from "react";
import { type Locale, countOf, formatRating } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { MapCopy, MapListing } from "./mapTypes";
import { Amount } from "@/components/ui/Amount";
import { MediaFrame } from "@/components/app/MediaFrame";
import { SpaceCard } from "@/components/ui/space-card/SpaceCard";
import { useClientCopy } from "@/lib/i18n/client-copy";
import "./search-v2.css";
import { PriceGuide } from "@/components/currency/Price";
import { useAreaText } from "@/components/currency/DisplayMoneyProvider";

/**
 * The card that docks at the foot of the map when a pin is chosen.
 *
 * TO THE FOUNDER'S MAP REFERENCE (13 October 2026): the compact space card,
 * the listing's photograph inset across the top with the round open arrow on
 * it, then the separate panel with the title and the figure and what it
 * covers on the right, then the beds, baths and floor area on one line. Every word is a field of this listing:
 * no fact is drawn that is zero or absent, and the rating and the Verified
 * mark are withheld on an example (`isDemo`), as on every card.
 *
 * Positioning note, the hard won one: this is `absolute` inside the map frame,
 * never `fixed`. The map is mounted inside `.nf-card`, which carries a
 * `backdrop-filter`, and a `backdrop-filter` ancestor becomes the containing
 * block for `fixed` descendants, so a fixed dock would anchor to the card
 * rather than to the viewport and land in the wrong place at the wrong size.
 *
 * It is dismissable three ways: the control, a downward swipe, and Escape
 * (handled by the map, which owns the selection).
 *
 * THE CARD AND ITS PIN ARE ONE THING (round 5 craft). The chosen pin lifts
 * and takes the brand ring; this card rises 12px into the frame from the edge
 * it docks to (240ms, `land`), so the eye reads the pair as one object in
 * two places. The card itself is the shared space card, which has no hard
 * edge of its own (the founder, 13 October 2026). The map keys it by place,
 * so choosing another pin lands a new card. Reduced motion: no rise; the
 * card fades in over 160ms. See map.css.
 */

/** How far down the card must travel before the swipe counts as a dismissal. */
const DISMISS_AT = 56;
/** Movement below this is a tap on the card, not a drag of it. */
const DRAG_SLOP = 8;

/** What the figure covers, in the reader's words; nothing after a sale. */
export function dockSuffix(period: MapListing["period"], copy: MapCopy): string {
  switch (period) {
    case "sale":
      return "";
    case "year":
      return `/ ${copy.year}`;
    case "night":
      return `/ ${copy.night}`;
    case "month":
      return copy.month ?? "";
    case "quarter":
      return copy.quarter ?? "";
    case "guest":
      return copy.guest;
  }
}

export function MapDock({
  listing,
  locale,
  copy,
  saved,
  saveBusy,
  onSave,
  onDismiss,
}: {
  listing: MapListing;
  locale: Locale;
  copy: MapCopy;
  saved: boolean;
  saveBusy: boolean;
  onSave: () => void;
  onDismiss: () => void;
}) {
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  const dragged = useRef(false);
  /* The heart is named as `SaveButton` names it: "Save to favourites" in the
     reader's language, the state in `aria-pressed`, the title described. */
  const saveName = useClientCopy().a11y.favourite;
  const saveTitleId = useId();
  /* The floor area in the reader's unit (Settings, Language and currency). */
  const areaText = useAreaText();

  const where =
    listing.area && listing.area !== listing.city
      ? `${listing.area}, ${listing.city}`
      : listing.area || listing.city;
  const hasPrice = listing.priceMinor > 0;
  const suffix = dockSuffix(listing.period, copy);
  const facts: string[] = [];
  if (listing.bedrooms !== undefined && listing.bedrooms > 0) facts.push(countOf(listing.bedrooms, "beds", locale));
  if (listing.bathrooms !== undefined && listing.bathrooms > 0) facts.push(countOf(listing.bathrooms, "baths", locale));
  if (listing.sizeSqm !== undefined && listing.sizeSqm > 0) facts.push(areaText(listing.sizeSqm, copy.sqm ?? "m²"));
  /* A rating only with the reviews behind it, and never on an example. */
  const rating =
    !listing.isDemo && listing.rating > 0 && listing.reviewCount > 0
      ? `${formatRating(listing.rating, locale)} (${listing.reviewCount})`
      : null;
  const href = `/listing/${listing.id}`;

  function pointerDown(event: React.PointerEvent<HTMLElement>) {
    // Only a real drag on the card body; the controls handle their own taps.
    if (event.pointerType === "mouse" && event.button !== 0) return;
    startY.current = event.clientY;
    dragged.current = false;
  }

  function pointerMove(event: React.PointerEvent<HTMLElement>) {
    if (startY.current === null) return;
    const delta = event.clientY - startY.current;
    if (delta > DRAG_SLOP) {
      dragged.current = true;
      setDrag(delta - DRAG_SLOP);
    } else if (dragged.current) {
      setDrag(0);
    }
  }

  function pointerUp() {
    const travelled = drag;
    startY.current = null;
    setDrag(0);
    if (travelled >= DISMISS_AT) onDismiss();
  }

  return (
    <div
      data-testid="map-dock"
      className="nf-map-dock pointer-events-auto px-row pb-row"
      role="group"
      aria-label={`Chosen place: ${listing.title}`}
    >
      <div
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        style={{
          transform: drag ? `translate3d(0, ${drag}px, 0)` : undefined,
          transition: drag ? "none" : "transform var(--nf-duration-fast) var(--nf-ease-standard)",
        }}
        className="nf-map-dock__card"
      >
        {/*
          D24 (the founder, 6 October): the example statement came off this
          card as it came off every other card. What stays is the half that
          mattered all along: an example listing carries no trust it did not
          earn, so the rating and the Verified mark below are withheld on
          one (`isDemo`), whatever its row says.

          THE SPACE CARD, COMPACT (the founder, 13 October 2026): the same
          container as the lists. The whole card is the link, so the open
          arrow is its mark (drawn on the photograph, never a second link to
          the same place); close and save sit outside the link.
        */}
        <SpaceCard
          variant="compact"
          href={href}
          title={listing.title}
          photos={listing.photo ? [listing.photo] : []}
          photoSizes="(max-width: 640px) 100vw, 24rem"
          fallback={<MediaFrame hue={listing.hue} kind={listing.kind} drawn={listing.drawn} sizes="(max-width: 640px) 100vw, 24rem" />}
          price={{
            amount: hasPrice ? (
              <>
                <Amount
                  minorUnits={listing.priceMinor}
                  locale={locale}
                  currency={listing.currency}
                  glance
                  secondaryClassName="text-[length:max(0.65em,0.75rem)] font-semibold opacity-60"
                />
                <PriceGuide minor={listing.priceMinor} currency={listing.currency} compact />
              </>
            ) : (
              <span className="nf-sc__ask">{listing.kindLabel}</span>
            ),
            unit: hasPrice && suffix ? suffix : null,
          }}
          facts={facts}
          rating={rating}
          mediaExtra={
            <span aria-hidden="true" className="nf-photo-disc nf-map-dock__open">
              <UiIcon name="arrow-up-right" size={20} />
            </span>
          }
          tools={
            <button
              type="button"
              onClick={onSave}
              disabled={saveBusy}
              aria-pressed={saved}
              aria-label={saveName}
              aria-describedby={saveTitleId}
              data-testid="map-dock-save"
              className="nf-photo-disc"
            >
              <UiIcon name="heart" size={20} filled={saved} className={saved ? "text-[var(--nf-brand-primary)]" : undefined} />
              <span id={saveTitleId} hidden>
                {listing.title}
              </span>
            </button>
          }
          extra={
            <>
              <p className="nf-sc__sub">
                <UiIcon name="location" size={12} className="shrink-0" />
                <span className="min-w-0 truncate">{where}</span>
              </p>
              {listing.verified && !listing.isDemo ? (
                <span className="nf-badge nf-badge--verified nf-map-dock__verified">
                  <UiIcon name="verified" size={12} />
                  {copy.verified}
                </span>
              ) : null}
            </>
          }
          testIds={{ price: "map-dock-price", facts: "map-dock-facts" }}
          onOpen={(event) => {
            if (dragged.current) event.preventDefault();
          }}
        />

        {/* Controls sit outside the link so no anchor is ever nested in one:
            close on the left of the photograph. */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss this card"
          data-testid="map-dock-close"
          className="nf-photo-disc nf-map-dock__close"
        >
          <UiIcon name="chevron-down" size={20} />
        </button>

      </div>
    </div>
  );
}
