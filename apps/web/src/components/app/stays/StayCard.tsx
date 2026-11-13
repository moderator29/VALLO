"use client";

import { useRef } from "react";
import { formatRating, type Dictionary, type Locale } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { Amount } from "@/components/ui/Amount";
import { MediaFrame } from "@/components/app/MediaFrame";
import { SpaceCard } from "@/components/ui/space-card/SpaceCard";
import { SaveButton, useSaveControl } from "@/components/app/SaveControl";
import { AuthGate } from "@/components/auth/AuthGate";
import { useScrollEntry } from "@/lib/motion/scroll-entry";
import { amenityLabel } from "@/components/app/filters/amenities";
import type { StayCardData } from "./stay-card-model";
import "@/app/css/catalogue.css";
import "@/app/css/list-views.css";
import "./stay-card.css";
import { PriceGuide } from "@/components/currency/Price";

/**
 * The stay card of FD3DFE84, in the space card's container (the founder, 13
 * October 2026): the photograph inset with Verified and the heart, then a
 * separate panel with the name on the left and the nightly figure on the
 * right, the place under them, the rating only when real reviews exist, and
 * the amenity chips. The content is the stay card's own; only the container
 * is the shared `SpaceCard`.
 */
const AMENITY_ICON: Record<string, UiIconName> = {
  wifi: "wifi",
  pool: "pool",
  breakfast: "utensils",
  kitchen: "kitchen",
  parking: "parking",
  security: "verified",
  gym: "bolt",
  ac: "snowflake",
  generator: "bolt",
};

export function StayCard({
  stay,
  locale,
  t,
  index,
  saved = false,
  canSavePlaces = false,
  eager = false,
}: {
  stay: StayCardData;
  locale: Locale;
  t: Dictionary;
  index?: number;
  /** Lit at rest, from the account's shortlist (`savedKeySet` and `isSaved`
      in `@/lib/saved/places`), decided on the server that read it. */
  saved?: boolean;
  /**
   * Whether the reader can actually write to `saved_places`, which means
   * whether they are signed in. A stay or a restaurant has no device half:
   * `saved_items` takes listing ids only, so there is nowhere for a
   * signed-out tap on a hotel to go. Such a heart is still drawn, behind the
   * sign-up gate, so every card on a page carries the same control.
   */
  canSavePlaces?: boolean;
  /** The first card above the fold: its photograph loads at once and high
      (the page's largest paint; integration QA O5). One per page. */
  eager?: boolean;
}) {
  const copy = t.catalogue.stays;
  const isTable = stay.kind === "restaurant";
  const save = useSaveControl(stay.id, saved, stay.place);
  /* Every card carries its heart (Agent FEEL, 13 November 2026). A guest saw
     hearts on the catalogue cards and none on the platform ones beside them,
     which read as broken. A place heart a guest cannot write goes through the
     sign-up gate instead (`AuthGate`), which brings them back here to save. */
  const gateSave = Boolean(stay.place) && !canSavePlaces;
  const chips = stay.amenities.slice(0, 4);
  const style = index !== undefined ? ({ "--card-i": Math.min(index, 5) } as React.CSSProperties) : undefined;
  const cardRef = useRef<HTMLElement | null>(null);
  /* Below the fold on arrival: floats in once as it scrolls into view. */
  useScrollEntry(cardRef, index);

  const photo = stay.photo ?? stay.standIn ?? null;

  return (
    <SpaceCard
      href={stay.href}
      title={stay.title}
      place={stay.where || null}
      photos={photo ? [photo] : []}
      photoSizes="(max-width: 640px) 100vw, 50vw"
      fallback={
        <MediaFrame hue={stay.hue} index={index ?? 0} kind={stay.kind} sizes="(max-width: 640px) 100vw, 50vw" priority={eager} />
      }
      /* D24: no example mark on the card, and nothing it did not earn.
         `isDemo` is read to WITHHOLD the Verified mark and the rating
         below, never to label the stay. */
      marks={
        stay.verified && !stay.isDemo ? (
          <span className="nf-badge nf-badge--verified nf-sc__mark">
            <UiIcon name="verified" size={12} />
            {t.common.verified}
          </span>
        ) : null
      }
      heart={
        gateSave ? (
          <AuthGate action="save">
            <SaveButton saved={save.saved} pending={save.pending} onToggle={save.toggle} title={stay.title} />
          </AuthGate>
        ) : (
          <SaveButton saved={save.saved} pending={save.pending} onToggle={save.toggle} title={stay.title} />
        )
      }
      price={
        stay.nightlyMinor !== null
          ? {
              amount: (
                <>
                  <Amount
                    minorUnits={stay.nightlyMinor}
                    locale={locale}
                    currency={stay.currency}
                    glance
                    secondaryClassName="text-[length:max(0.6em,0.75rem)] font-semibold opacity-70"
                  />
                  {/* The reader's currency guide beside the nightly rate. The
                      dated total below stays naira only: it is a quote. */}
                  <PriceGuide minor={stay.nightlyMinor} currency={stay.currency} compact />
                </>
              ),
              /* A table is priced by the head, a room by the night: the
                 unit is the market's own (the restaurant page says the same). */
              unit: isTable ? t.restaurantPage.perHead : copy.perNight,
            }
          : isTable
            ? null
            : /* Nobody requests a price for a table: a restaurant with no
                 typical spend simply states none, rather than "on request". */
              { amount: <span className="nf-sc__ask">{t.common.priceOnRequest}</span> }
      }
      mediaExtra={
        <>
          {stay.hours && (
            <span className={`nf-reg-open absolute bottom-xs left-xs z-[2] ${stay.hours.openNow ? "nf-reg-open--open" : "nf-reg-open--closed"}`}>
              <UiIcon name="history" size={12} />
              {stay.hours.label}
            </span>
          )}
          {/* No photograph from the place. With a stand-in picture on the
              card the caption says what that picture is not; with only the
              drawn frame it says there are none yet. */}
          {!stay.photo && (
            <span className="nf-sc__nophoto" data-testid="stay-card-photo-note">
              {stay.standIn ? t.stays.standInCaption : t.catalogue.card.noPhotos}
            </span>
          )}
        </>
      }
      extra={
        <>
          {stay.rating && !stay.isDemo && (
            <p className="nf-stay-card__rating nf-numeric">
              <UiIcon name="star" size={16} filled />
              {formatRating(stay.rating.average, locale)}
              <span className="font-normal text-[var(--nf-content-muted)]">
                {copy.reviews.replace("{count}", String(stay.rating.count))}
              </span>
            </p>
          )}
          {stay.totalMinor !== null && stay.nights !== null && (
            <p className="nf-sc__sub">
              {t.stays.totalForNights.replace("{nights}", String(stay.nights))}{" "}
              <Amount minorUnits={stay.totalMinor} locale={locale} currency={stay.currency} className="font-semibold text-[var(--nf-content-primary)]" />
            </p>
          )}
          {chips.length > 0 && (
            <ul className="nf-stay-card__chips">
              {chips.map((code) => (
                <li key={code} className="nf-stay-card__chip">
                  <UiIcon name={AMENITY_ICON[code] ?? "circle-check"} size={12} />
                  {amenityLabel(code)}
                </li>
              ))}
            </ul>
          )}
        </>
      }
      eager={eager}
      rootRef={cardRef}
      rootProps={{ "data-testid": "stay-card", style }}
      className={`nf-sc--live nf-stay-card${index !== undefined ? " nf-card-in" : ""}`}
    />
  );
}
