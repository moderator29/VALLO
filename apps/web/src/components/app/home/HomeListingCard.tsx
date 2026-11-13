"use client";

import type { MouseEvent } from "react";
import type { Locale } from "@vallo/i18n/core";
import type { Listing } from "@/lib/listings/types";
import { hrefForListing, marketFactsOf } from "@/lib/listings/href";
import { cardGlance, placeOf } from "@/lib/listings/card-glance";
import { drawnSrcIn, handOff } from "@/lib/listings/handoff";
import { startPhotoMorph } from "@/lib/motion/photo-morph";
import { motionQuiet } from "@/lib/motion/gate";
import { MediaFrame } from "@/components/app/MediaFrame";
import { Money } from "@/components/ui/Money";
import { SpaceCard } from "@/components/ui/space-card/SpaceCard";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import { SaveButton, useSaveControl } from "@/components/app/SaveControl";
import { chipOf, factsOf, priceOf, type HomeCardCopy } from "@/components/app/home/home-card-copy";
import { CardCounts } from "@/components/app/listing/CardCounts";
import { PriceGuide } from "@/components/currency/Price";
import { useAreaText } from "@/components/currency/DisplayMoneyProvider";
import "@/app/css/home.css";

/**
 * A LISTING ON HOME, DRAWN AS THE SPACE CARD (13 October 2026).
 *
 * The adapter from a `Listing` to `SpaceCard`'s props, and nothing more: the
 * shape (outer card, inset photo with the status pill and the heart, the
 * separate info panel) is the shared `components/ui/space-card`. Which
 * listings, and why (a best match's reason), are decided by the page and
 * handed in. The price, the market pill and the facts come from the same card
 * model the search page's card uses (`cardPrice`, `cardMarket`), so the two
 * cannot disagree about a figure.
 *
 * Tapping it hands the card's facts to the listing's loading shell and starts
 * the same photo morph the catalogue card starts, so the listing opens in one
 * frame from here too.
 */
export type HomeCardLayout = "card" | "compact";

/** The most photographs one card scrolls through (its dots are capped too). */
const PHOTOS_SHOWN = 5;

export function HomeListingCard({
  listing,
  locale,
  copy,
  layout,
  reason,
  reasonIcon,
  eager = false,
}: {
  listing: Listing;
  locale: Locale;
  copy: HomeCardCopy;
  layout: HomeCardLayout;
  /** The line saying why this one is here, from a real signal; best matches only. */
  reason?: string | null;
  reasonIcon?: UiIconName;
  /** The first photograph on the screen is fetched at once. */
  eager?: boolean;
}) {
  const save = useSaveControl(listing.id);
  const areaText = useAreaText();
  const price = priceOf(listing, copy);

  const onOpen = (event: MouseEvent<HTMLAnchorElement>, media: HTMLElement | null) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    handOff(cardGlance(listing, locale, copy.cardCopy), drawnSrcIn(media, listing.photos[0]));
    if (!media || motionQuiet()) return;
    startPhotoMorph(listing.id, media);
  };

  return (
    <SpaceCard
      href={hrefForListing(listing.kind, listing.id, marketFactsOf(listing))}
      title={listing.title}
      place={placeOf(listing)}
      photos={listing.photos.slice(0, PHOTOS_SHOWN)}
      fallback={
        <>
          <MediaFrame hue={listing.hue} kind={listing.kind} sizes="(max-width: 640px) 94vw, 30rem" priority={eager} />
          <span className="nf-sc__nophoto">{copy.noPhotos}</span>
        </>
      }
      status={chipOf(listing, copy)}
      heart={
        <SaveButton saved={save.saved} pending={save.pending} onToggle={save.toggle} title={listing.title} />
      }
      price={
        price
          ? {
              amount: (
                  <>
                    <Money minor={price.minor} locale={locale} currency={listing.currency} mode="glance" />
                    {/* The guide beside the asking price; never beside a move-in total. */}
                    {price.moveIn ? null : <PriceGuide minor={price.minor} currency={listing.currency} compact />}
                  </>
                ),
              unit: price.unit,
              from: price.from ? copy.from : null,
            }
          : null
      }
      facts={factsOf(listing, copy, locale, areaText)}
      extra={<CardCounts stats={listing.stats} isDemo={listing.isDemo} locale={locale} />}
      reason={reason}
      reasonIcon={reasonIcon}
      photoLabel={copy.photoLabel}
      mediaId={listing.id}
      eager={eager}
      variant={layout}
      onOpen={onOpen}
    />
  );
}
