"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  formatDate,
  formatMoney,
  isGlanceCompact,
  type Dictionary,
  type Locale,
} from "@vallo/i18n/core";
import type { Listing } from "@/lib/listings/types";
import { hrefForListing, marketFactsOf } from "@/lib/listings/href";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { Amount } from "@/components/ui/Amount";
import { CountUpMoney } from "@/components/motion/CountUp";
import { IntentTune } from "@/components/app/IntentTune";
import { MediaFrame } from "@/components/app/MediaFrame";
import {
  isPropertyType,
  type PropertyType,
} from "@/lib/interests/property-types";
import { isDataSaver } from "@/lib/ui/data-saver";
import { motionQuiet } from "@/lib/motion/gate";
import { startPhotoMorph } from "@/lib/motion/photo-morph";
import { pressFrom } from "@/lib/motion/press-start";
import { drawnSrcIn, handOff } from "@/lib/listings/handoff";
import { cardGlance } from "@/lib/listings/card-glance";
import { PriceGuide } from "@/components/currency/Price";
import { useAreaText } from "@/components/currency/DisplayMoneyProvider";
import { SaveButton, useSaveControl } from "@/components/app/SaveControl";
import { useScrollEntry } from "@/lib/motion/scroll-entry";
import {
  cardFacts,
  cardMarket,
  cardMessageHref,
  cardPrice,
  cardUtility,
} from "./listing-card-model";
import { ButtonLink } from "@/components/ui/Button";
import { isModestExample } from "@/lib/listings/example-imagery";
import { panelClass } from "@/components/ui/Panel";
import { ListerRoleLine } from "@/components/app/listing/ListerRoleLine";
import {
  isNewSince,
  listedAge,
  listedAgeText,
  staleMonthOptions,
} from "@/lib/listings/listed-age";
import { useLastVisit } from "@/components/app/search/LastVisit";
import {
  cashAtDoor,
  upfrontDuration,
  upfrontText,
} from "@/lib/listings/upfront";
import { unitLine } from "@/lib/listings/unit-shape";
import { ProofStrip } from "@/components/app/listing/ProofStrip";
import { CardPhotos, CARD_PHOTO_MAX } from "@/components/app/search/CardPhotos";
import { proofFactsOf, proofLines } from "@/lib/trust/proof-strip";
import { CardMenu, useCardMenu } from "@/components/app/listing/CardMenu";
import { CardCounts } from "@/components/app/listing/CardCounts";
import { OwnershipSeenMark } from "@/components/trust/OwnershipSeenMark";
import { SpaceCard } from "@/components/ui/space-card/SpaceCard";
import "@/app/css/catalogue.css";
import "@/app/css/list-views.css";

/**
 * The property card, to the results image (3EB3E2A9).
 *
 * The photograph carries the marks: Verified top-left, the heart top-right,
 * the market tag on the photo's foot. The body carries the words in the
 * order a person compares them: title, where, the figure, the facts.
 *
 * WHAT IS REAL AND WHAT IS NOT. A listing with `listing_photos` rows shows
 * its own photograph. One without shows the scene photograph for its kind
 * through `MediaFrame` (the manifest wires whatever is on disk) and says
 * "No photographs yet" on the frame, so a category plate is never mistaken
 * for a picture of this property. The Verified pill appears only on a row a
 * person checked; a rating never appears without real reviews.
 */

const PERIOD_KEY: Record<string, keyof Dictionary["catalogue"]["card"]> = {
  year: "perYear",
  month: "perMonth",
  quarter: "perQuarter",
  night: "night",
  guest: "head",
};

function fractionClass(minorUnits: number, whenKobo: string): string {
  return isGlanceCompact(minorUnits) ? "" : whenKobo;
}

const FACT_ICON: Record<string, UiIconName> = {
  beds: "bed",
  baths: "bath",
  parking: "parking",
  size: "grid",
  kind: "house",
  instant: "bolt",
};

/*
 * THE PRICE COUNTS UP WITH ITS PAGE, NOT WHENEVER A CARD HAPPENS TO MOUNT.
 *
 * `CountUpMoney eager` counts from nought on first view. That is right for the
 * cards a navigation brings in together, and wrong for a card that joins a
 * list somebody is already reading (the next page of results, a filter
 * swapping the rows): the price on screen would drop to nought and climb
 * again under a thumb that has read it. So a card counts only when no card is
 * alive yet (a navigation has just replaced the list) or when it mounts
 * within the arrival window of the first one (the rest of the same batch);
 * otherwise it shows its figure as it is. Read in render, written in an
 * effect: every card of one commit renders before any of them is counted, so
 * the whole batch agrees. Markup never depends on it, only the count does.
 */
const ARRIVAL_WINDOW_MS = 400;
let cardsAlive = 0;
let arrivalStartedAt = 0;

function arrivesWithItsPage(): boolean {
  if (typeof performance === "undefined") return false;
  return (
    cardsAlive === 0 || performance.now() - arrivalStartedAt < ARRIVAL_WINDOW_MS
  );
}

export function ListingCard({
  listing,
  locale,
  t,
  index,
  intent,
  saved,
  wide = false,
  dense = false,
  brief = false,
  photographed = null,
  ownershipSeen = null,
  messageAgent = false,
  commute = null,
  eager = false,
  layout = "tile",
  reason = null,
  showAge = false,
}: {
  /**
   * THE SHAPE OF THE CARD.
   *
   * `tile` is the card every shelf has drawn: the photograph over a column of
   * words, two across on a phone. `row` and `compact` are the SPACE CARD
   * (`components/ui/space-card`, the founder's container, 13 October 2026):
   * one large soft rounded card, the photograph inset in it with the market
   * pill and the round heart on it, then a separate rounded panel with the
   * title and place on the left, the figure and its period on the right and
   * the beds, baths and floor area on one line. `row` is one card per row at
   * full width (the search list); `compact` is the same shape at the width
   * of a sideways rail (Best matches, New listings). Same listing, same
   * facts, same controls (save, the card menu, the photo swipe and arrows,
   * Message agent, the trust marks); only the arrangement differs, so nothing
   * a tile shows is lost on a row.
   */
  layout?: "tile" | "row" | "compact";
  /**
   * Why this card is in Best matches, in words (`lib/search/best-matches.ts`).
   * Always a real signal the person gave; never a score. Drawn on a space card only.
   */
  reason?: { text: string; icon: UiIconName } | null;
  /** Draw "Listed 3 days ago" on a space card (the New listings shelf). */
  showAge?: boolean;
  /**
   * "Ownership seen": the date a reviewer approved the owner's proof, read for
   * the whole shelf at once by the page (`ownershipSeenForListings`), and the
   * word for it. Null draws nothing; an example never carries it.
   */
  ownershipSeen?: { seenAt: string; label: string } | null;
  /** V-70: "Photographed: kitchen, prepaid meter", when the lister labelled photos. */
  photographed?: string | null;
  listing: Listing;
  locale: Locale;
  t: Dictionary;
  /** Position in a freshly assembled list, for the entrance stagger. */
  index?: number;
  intent?: PropertyType[];
  /**
   * The STORED truth about the heart, from `saved_items`, when the page that
   * drew this card already knows it.
   *
   * The card used to call `useSaveControl(listing.id)` with nothing, so the
   * heart rendered from the device store alone and a signed-in reader's
   * hearted listing came back empty after a reload - on `/search`, on
   * `/rent`, and most visibly on `/saved`, where the `StayCard` half passed
   * its stored value and drew a filled heart beside a `ListingCard` drawing
   * an empty one, on the board whose entire job is the shortlist. The write
   * always worked; this is the read back, which is the half of the ONE LAW
   * that says the UI shows the new reality. (R2 finding 4.)
   *
   * Optional because a surface that genuinely does not know must not claim
   * `false`: `undefined` leaves `useSaveControl` on the device store it
   * already falls back to, which is the honest answer for a guest.
   */
  saved?: boolean;
  /** One across, the 16:10 photograph of the stays shelf. */
  wide?: boolean;
  /**
   * Two of these cards share a 390px row.
   *
   * Set by the grids that draw two-up, and by nothing else. It is a fact about
   * the LAYOUT, which only the grid knows, so it is passed rather than
   * guessed: a card on the saved board and a card on the rent shelf are full
   * width at 390 and have room for all three facts, and a card that dropped a
   * fact there would be hiding something for no reason.
   */
  dense?: boolean;
  /**
   * The short card for a results grid: photograph, market, title, where, the
   * move-in figure and one line of key facts. Everything else (the age, the
   * lister, the proof strip, the rent and upfront lines, utilities, commute,
   * landlord and photo captions) waits for the listing page, where a person
   * has come to read it. Set by the search grid only.
   */
  brief?: boolean;
  /**
   * Draw Message agent under a tenancy (V-26: it moved here from the deleted
   * `/rent` shelf). Passed by the results shelf; `cardMessageHref` still
   * decides whether this listing may carry it, so an example or a stay never
   * does, whatever the page asks.
   */
  messageAgent?: boolean;
  /** V-43: the rush-hour line to the reader's chosen anchor, or null. */
  commute?: string | null;
  /**
   * The first card above the fold on its page: its photograph loads at once
   * and high, because it is the page's largest paint (integration QA O5).
   * One card per page, never a whole list.
   */
  eager?: boolean;
}) {
  const photo = listing.photos[0];
  const [countsOnArrival] = useState(arrivesWithItsPage);
  useEffect(() => {
    if (cardsAlive === 0) arrivalStartedAt = performance.now();
    cardsAlive += 1;
    return () => {
      cardsAlive -= 1;
    };
  }, []);
  /* Track M: several photographs swipe (CardPhotos.tsx); the arrows drawn
     outside the link scroll the same track on a pointer. */
  const photoTrack = useRef<HTMLDivElement | null>(null);
  const [photoAt, setPhotoAt] = useState(0);
  const photoCount = Math.min(listing.photos.length, 5);
  const stepPhoto = (dir: -1 | 1) => {
    const track = photoTrack.current;
    if (!track) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    track.scrollBy({
      left: dir * track.clientWidth,
      behavior: reduce ? "auto" : "smooth",
    });
  };
  /* The heart pops on the tap that saves, never on a page that loads with
     it already filled. */
  const [heartPop, setHeartPop] = useState(false);
  /*
   * WHERE THIS OPENS IS DECIDED BY WHAT THE LISTING IS, not by a prop.
   *
   * This was `side === "stays" ? "/stay" : "/listing"` off a `side` prop that
   * defaulted to `"property"` and that NO CALL SITE IN THE TREE PASSED. The
   * property search's own category rail offers Shortlets, Apartments, Villas
   * and Hotels, so four of its nine markets opened a Stays object inside the
   * Property shell, and a saved hotel did the same from the shortlist. The
   * prop is deleted rather than threaded through the three pages, because a
   * prop nobody passes is how this happened. See `lib/listings/href.ts`.
   */
  const href = hrefForListing(listing.kind, listing.id, marketFactsOf(listing));
  const copy = t.catalogue.card;

  /* Prefetch on intent, never on a data-saver connection. */
  const prefetched = useRef(false);
  const [warmed, setWarmed] = useState(false);
  const warm = () => {
    if (prefetched.current) return;
    if (isDataSaver()) return;
    prefetched.current = true;
    setWarmed(true);
  };

  /*
   * AND ON A LOOK (Track M performance). The intent above starts on the
   * finger coming down, which a quick tap beats: the listing's skeleton
   * showed while its page was still on the way. A card that has sat mostly
   * on screen for a second, while the reader looks at it, is fetched whole
   * (about 23 KB on the wire), so the one they tap is usually already here.
   * A card scrolled past is never fetched.
   */
  const cardRef = useRef<HTMLElement | null>(null);
  /* Below the fold on arrival: floats in once as it scrolls into view. */
  useScrollEntry(cardRef, index);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer);
        if (!entry?.isIntersecting) return;
        timer = window.setTimeout(() => {
          warm();
          observer.disconnect();
        }, 1000);
      },
      { threshold: 0.75 }
    );
    observer.observe(el);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
    /* `warm` reads a ref and a setter only, so the observer is set up once. */
  }, []);

  /*
   * THE PHOTOGRAPH TRAVELS INTO THE DETAIL HERO (motion sweep, 29 September
   * 2026). The navigation is Link's own, and the App Router runs it as a
   * React transition that the route transition turns into a view transition
   * (components/motion/RouteTransition.tsx). All this does is name the one
   * photo box that was tapped, at the moment it was tapped, so the browser
   * pairs it with the gallery's lead pane and morphs one into the other.
   *
   * It used to call `document.startViewTransition(() => router.push(href))`.
   * The callback returned before the route had committed, so the "new" state
   * the browser captured was still the old page and nothing morphed. And the
   * name sat on every card permanently, so a listing shown twice on one
   * screen (a shelf and the grid) was a duplicate name, which aborts every
   * view transition on that page. Named on tap, it is only ever one card.
   */
  const mediaRef = useRef<HTMLDivElement>(null);
  const openFrom = (event: React.MouseEvent<HTMLAnchorElement>, media: HTMLElement | null) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    /* B4: the listing opens in one frame. The facts this card already
       printed, and the photo it already drew, go to the listing's loading
       shell (lib/listings/handoff.ts), which paints them at once. */
    handOff(
      cardGlance(listing, locale, copy),
      drawnSrcIn(media, listing.photos[0])
    );
    if (!media || motionQuiet()) return;
    /* Measured and named here; the hero aims the flight when it commits,
       and the module gives the name back when the transition is over (or
       at a ceiling, if the navigation was refused). */
    startPhotoMorph(listing.id, media);
  };
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) =>
    openFrom(event, mediaRef.current);

  /*
   * THE PRESS STARTS WHEN THE THUMB LANDS (round 5). `:active` alone waited
   * on the browser: Chrome on Android shows it only once it is sure the touch
   * is a tap (on a quick tap, at the lift, with the click), and Safari not at
   * all without a touch listener. So the card sank as the next page was
   * already on its way, or never. Now the finger coming down writes
   * `data-pressed` on the card directly (no React render on the hot path) and
   * the card sinks on the press token at once; lifting, a scroll taking the
   * touch (`pointercancel`) or leaving releases it. Never blocks the tap: the
   * listeners are passive and nothing is prevented.
   */
  const pressCard = (event: React.PointerEvent<HTMLAnchorElement>) => {
    warm();
    if (!event.isPrimary || event.button !== 0) return;
    const card = cardRef.current;
    if (card) pressFrom(card);
  };

  // "Lagos, Lagos" reads as a bug, so a place stated twice collapses.
  const where =
    listing.area && listing.area !== listing.city
      ? `${listing.area}, ${listing.city}`
      : listing.area || listing.city;

  const price = cardPrice(listing);
  /* V-65: the months of rent asked for up front, for the line under the rent. */
  const cash = cashAtDoor(listing);
  const facts = cardFacts(listing, t, locale);
  const power = cardUtility(listing);
  const marketKey = cardMarket(listing);
  const market =
    marketKey === "sale"
      ? copy.forSale
      : marketKey === "night"
      ? copy.perNight
      : marketKey === "head"
      ? copy.perHead
      : copy.forRent;
  const periodKey = listing.pricePeriod
    ? PERIOD_KEY[listing.pricePeriod]
    : undefined;
  const suffix =
    listing.intent === "sale" ? "" : periodKey ? copy[periodKey] : "";

  const cardStyle =
    index !== undefined
      ? ({ "--card-i": Math.min(index, 5) } as React.CSSProperties)
      : undefined;

  /*
   * HOW OLD IT IS (V-22), and never on an example: an example illustrates a
   * flat that does not exist, so "Listed 3 days ago" would be false about the
   * world. `new Date()` here is the reader's clock; the words change only at a
   * Lagos midnight, so the server and the browser agree on all but a moment
   * of the day, and the span says so to React rather than warning.
   */
  const now = new Date();
  const age = listing.isDemo ? null : listedAge(listing.publishedAt, now);
  const ageText = age
    ? listedAgeText(
        age,
        t.shape.listed,
        age.kind === "stale"
          ? formatDate(age.since, locale, staleMonthOptions(age.since, now))
          : ""
      )
    : null;
  const lastVisit = useLastVisit();
  const messageHref = messageAgent ? cardMessageHref(listing) : null;
  const isNew = !listing.isDemo && isNewSince(listing.publishedAt, lastVisit);

  const tunableKind: PropertyType | null = isPropertyType(listing.kind)
    ? listing.kind
    : null;
  const save = useSaveControl(listing.id, saved);
  /* The floor area in the reader's unit (Settings, Language and currency). */
  const areaText = useAreaText();
  /* Details pass: hold the card for Save, Share and Hide (CardMenu.tsx). */
  const shareable = !listing.isDemo;
  const menu = useCardMenu(listing.id, { shareable });

  /* The facts row: beds, baths, then the floor area when the lister gave one,
     then what the place is. Four at most, so a card stays one row. */
  const row: {
    key: string;
    label: string;
    icon: UiIconName;
    numeric?: boolean;
  }[] = facts.map((fact) => ({
    key: fact.key,
    label: fact.label,
    icon: FACT_ICON[fact.key] ?? "circle-check",
    ...(fact.numeric !== undefined ? { numeric: fact.numeric } : {}),
  }));
  if (listing.sizeSqm !== undefined && listing.sizeSqm > 0) {
    row.splice(Math.min(2, row.length), 0, {
      key: "size",
      label: areaText(listing.sizeSqm, copy.sqm),
      icon: "grid",
      numeric: true,
    });
  }
  /*
   * THREE FACTS, as the target render draws them: beds, baths and the floor
   * area. The building noun is dropped once those three exist, because the
   * render does not carry it and a fourth chip on a card this size wraps the
   * row onto a second line. It survives where it is the only thing there is
   * to say - a plot of land has no beds and no baths, and the render's own
   * land card reads "Land, 5,000 sqm" - which is why it is dropped by rank
   * rather than removed from the model.
   */
  const ranked =
    row.length > 3 ? row.filter((fact) => fact.key !== "kind") : row;

  /*
   * TWO FACTS AND A "+N" ON THE TWO-UP CARD, THREE ON THE WIDE ONE.
   *
   * The target render draws beds, baths and the floor area on one line. Ours
   * wrapped onto two at 390, because a two-up card is about 150px of content
   * and three glyph-and-label pairs need closer to 165. The row was tightened
   * as far as it goes; going further meant dropping the fact row below the
   * type scale's floor, and illegible text is not a fix, it is the same bug
   * with fewer pixels.
   *
   * So the narrow card states the two facts people compare (how many bedrooms,
   * how many bathrooms) and marks the rest with a count. The mark is not
   * decoration: it carries the facts it stands for in its accessible name and
   * in its tooltip, and the card it sits on opens the property where all of
   * them are drawn in full. Nothing is hidden, one line is kept, and no
   * character on this card is smaller than the floor.
   *
   * A card that is not two-up (the saved board, the rent shelf, the wide
   * card) has the width for all three and keeps them.
   */
  /* V-66: "2 bed flat, both en-suite, with BQ" in place of "2 beds 2 baths
     +1", when the lister named the shape. Null otherwise, and the facts row
     stands as it was. */
  const shapeLine = unitLine(listing.bedrooms, listing.unit, t.shape.unit);
  const factLimit = dense ? 2 : 3;
  /* One short card for the grid; the full card everywhere else. */
  const detail = !brief;
  /* With the shape line drawn, the beds live in it ("2 bed flat"); the other
     facts stay (batch 4 review). */
  const factRow =
    shapeLine && detail && layout === "tile"
      ? ranked.filter((fact) => fact.key !== "beds")
      : ranked;
  const shown = factRow.slice(0, factLimit);
  const spilled = factRow.slice(factLimit, 3);

  /* Hidden on this phone from the card menu; a saved listing never hides. */
  if (menu.hidden && !save.saved) return null;

  /*
   * THE SPACE CARD (layout "row" and "compact"). Every word on it is a field
   * of this listing or a word from the dictionary: no figure is drawn that the
   * lister did not state, no fact is drawn that is zero, and the reason line
   * is drawn only when the page found a real one. The shape is the shared
   * `SpaceCard`'s; this only maps the listing and the card's controls to it.
   */
  if (layout !== "tile") {
    const sizes =
      layout === "compact"
        ? "(max-width: 640px) 72vw, 18rem"
        : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 34vw";
    const amount =
      price.lead === "moveIn" ? (
        <CountUpMoney
          minorUnits={price.minor}
          locale={locale}
          currency={listing.currency}
          glance
          eager={countsOnArrival}
        >
          <Amount
            minorUnits={price.minor}
            locale={locale}
            currency={listing.currency}
            glance
            secondaryClassName={fractionClass(price.minor, "text-[length:max(0.6em,0.75rem)] font-semibold opacity-70")}
          />
        </CountUpMoney>
      ) : price.lead === "headline" ? (
        <>
          <Amount
            minorUnits={price.minor}
            locale={locale}
            currency={listing.currency}
            glance
            secondaryClassName={fractionClass(price.minor, "text-[length:max(0.6em,0.75rem)] font-semibold opacity-70")}
          />
          {/* The reader's currency guide, beside the asking price only. The
              move-in lead above is an obligation and stays naira only. */}
          <PriceGuide minor={price.minor} currency={listing.currency} compact />
        </>
      ) : (
        <span className="nf-sc__ask">{t.common.priceOnRequest}</span>
      );
    const unit = price.lead === "moveIn" ? copy.moveIn : price.lead === "headline" ? suffix : "";

    return (
      <SpaceCard
        href={href}
        title={listing.title}
        place={where}
        variant={layout === "compact" ? "compact" : "card"}
        photos={listing.photos.slice(0, CARD_PHOTO_MAX)}
        photoSizes={sizes}
        photoLabel={t.homeV2.photoOf}
        arrows={{ previous: `Previous photo of ${listing.title}`, next: `Next photo of ${listing.title}` }}
        fallback={
          <>
            <MediaFrame
              hue={listing.hue}
              index={index ?? 0}
              kind={listing.kind}
              drawn={isModestExample(listing)}
              sizes={sizes}
              priority={eager}
            />
            <span className="nf-sc__nophoto">{copy.noPhotos}</span>
          </>
        }
        status={market}
        marks={
          /* Verified beside the market, on a checked row that is not an
             example: the same rule as the tile's mark (D24). */
          listing.verified && !listing.isDemo ? (
            <span className="nf-badge nf-badge--verified nf-sc__mark">
              <UiIcon name="verified" size={12} />
              {t.common.verified}
            </span>
          ) : null
        }
        heart={
          <SaveButton
            saved={save.saved}
            pending={save.pending}
            onToggle={() => {
              setHeartPop(true);
              save.toggle();
            }}
            title={listing.title}
            className={heartPop ? "nf-heart-pop" : undefined}
          />
        }
        tools={intent !== undefined && tunableKind ? <IntentTune type={tunableKind} t={t} interests={intent} /> : null}
        price={{
          amount,
          unit: unit || null,
          from: price.lead === "moveIn" && price.approximate ? t.homeV2.priceFrom : null,
        }}
        facts={shown.map((fact) => fact.label)}
        reason={reason?.text ?? null}
        reasonIcon={reason?.icon}
        extra={
          <>
            {/* Listing stats: views and saves, a quiet line under the facts. */}
            <CardCounts stats={listing.stats} rating={listing.rating} reviewCount={listing.reviewCount} locale={locale} />
            {showAge && ageText && (
              <p className="nf-sc__sub" data-testid="card-listed-age" suppressHydrationWarning>
                {isNew && (
                  <span className="nf-badge nf-badge--spark nf-pcard__new" title={t.shape.listed.newMarkLabel}>
                    <span aria-hidden="true">{t.shape.listed.newMark}</span>
                    <span className="sr-only">{t.shape.listed.newMarkLabel}. </span>
                  </span>
                )}
                {ageText}
              </p>
            )}
            {ownershipSeen && !listing.isDemo && (
              <p className="nf-sc__sub">
                <OwnershipSeenMark seenAt={ownershipSeen.seenAt} label={ownershipSeen.label} />
              </p>
            )}
            {commute && (
              <p className="nf-sc__sub" data-testid="card-commute">
                <UiIcon name="history" size={12} className="shrink-0" />
                <span className="break-words">{commute}</span>
              </p>
            )}
          </>
        }
        footer={
          messageHref ? (
            <div className="nf-sc__action">
              <ButtonLink
                href={messageHref}
                variant="secondary"
                size="sm"
                full
                leadingIcon="chat-bubble"
                data-testid="card-message-agent"
              >
                {t.shape.card.messageAgent}
              </ButtonLink>
            </div>
          ) : null
        }
        testIds={{ panel: "card-panel", price: "card-price", facts: "card-facts", reason: "card-reason", status: "card-market" }}
        mediaId={listing.id}
        eager={eager}
        onOpen={openFrom}
        rootRef={cardRef}
        rootProps={{
          ...menu.press.handlers,
          "data-long-press": menu.press.holding ? "holding" : undefined,
          "data-testid": "listing-card",
          style: cardStyle,
        }}
        linkProps={{
          prefetch: warmed ? true : undefined,
          onPointerDown: pressCard,
          onPointerEnter: warm,
          onFocus: warm,
        }}
        className={`nf-sc--live${index !== undefined ? " nf-card-in" : ""}`}
      >
        <CardMenu
          open={menu.open}
          onOpenChange={menu.setOpen}
          listingId={listing.id}
          title={listing.title}
          thumb={photo}
          saved={save.saved}
          onToggleSave={() => {
            setHeartPop(true);
            save.toggle();
          }}
          mint={menu.mint}
          shareable={shareable}
        />
      </SpaceCard>
    );
  }

  const photoSizes = wide
    ? "(max-width: 640px) 100vw, 50vw"
    : "(max-width: 640px) 50vw, 25vw";

  return (
    <article
      ref={cardRef}
      {...menu.press.handlers}
      data-long-press={menu.press.holding ? "holding" : undefined}
      className={panelClass({
        variant: "card",
        className: `nf-pcard group ${wide ? "nf-pcard--wide" : ""} ${
          index !== undefined ? "nf-card-in" : ""
        }`,
      })}
      style={cardStyle}
      data-testid="listing-card"
    >
      {/* The controls sit OUTSIDE the link. An anchor may not contain a
          button, and a screen reader must hear two controls, not one. */}
      {/* On a photograph the controls keep the night material in both themes. */}
      <div className="nf-pcard__controls" data-theme="dark">
        <SaveButton
          saved={save.saved}
          pending={save.pending}
          onToggle={() => {
            setHeartPop(true);
            save.toggle();
          }}
          title={listing.title}
          surface="media"
          className={heartPop ? "nf-heart-pop" : undefined}
        />
        {intent !== undefined && tunableKind && (
          <IntentTune type={tunableKind} t={t} interests={intent} />
        )}
      </div>
      {photoCount > 1 && (
        <div className="nf-pcard__photonav" data-theme="dark">
          <button
            type="button"
            className="nf-pcard__photobtn"
            aria-label={`Previous photo of ${listing.title}`}
            disabled={photoAt === 0}
            onClick={() => stepPhoto(-1)}
          >
            <UiIcon name="arrow-left" size={16} />
          </button>
          <button
            type="button"
            className="nf-pcard__photobtn"
            aria-label={`Next photo of ${listing.title}`}
            disabled={photoAt >= photoCount - 1}
            onClick={() => stepPhoto(1)}
          >
            <UiIcon name="arrow-right" size={16} />
          </button>
        </div>
      )}
      <Link
        href={href}
        prefetch={warmed ? true : undefined}
        onClick={handleClick}
        onPointerDown={pressCard}
        onPointerEnter={warm}
        onFocus={warm}
        className="nf-pcard__link"
      >
        <div
          ref={mediaRef}
          className="nf-pcard__media nf-vt-morph"
          data-morph-id={listing.id}
          data-theme="dark"
        >
          <div className="nf-pcard__photo">
            <MediaFrame
              hue={listing.hue}
              index={index ?? 0}
              kind={listing.kind}
              drawn={isModestExample(listing)}
              sizes={photoSizes}
              priority={eager && !photo}
            />
            {photo && (
              <CardPhotos
                photos={listing.photos}
                sizes={photoSizes}
                trackRef={photoTrack}
                onIndex={setPhotoAt}
                eager={eager}
              />
            )}
          </div>

          {/*
            D24 (the founder, 6 October): THE EXAMPLE MARK IS OFF THE CARD, AND
            NOTHING UNEARNED IS ON IT. An example listing stays in the catalogue
            and may look like a real listing; it may never look like a CHECKED
            one. So `isDemo` is still read here, to withhold trust rather than
            to label: the Verified mark draws only on a row a person checked
            that is not an example. A check constraint, a trigger and the mapper
            already refuse both at once; this is the card refusing it too, so a
            mapper regression can never print a tick on an invented flat.
          */}
          {listing.verified && !listing.isDemo && (
            <span className="nf-badge nf-badge--verified nf-pcard__mark nf-pcard__mark--verified">
              <UiIcon name="verified" size={12} />
              {t.common.verified}
            </span>
          )}
          {!photo && <span className="nf-pcard__nophoto">{copy.noPhotos}</span>}
        </div>

        <div className="nf-pcard__body">
          {/* The market as a word above the title (plan item 17): one badge on
              the photograph at most (Verified or Example), never three. */}
          <p className="nf-pcard__market" data-market={marketKey}>
            {market}
          </p>
          <h3 className="nf-pcard__title" title={listing.title}>
            {listing.title}
          </h3>

          <p className="nf-pcard__where">
            <UiIcon name="location" size={12} className="mt-3xs" />
            <span>{where}</span>
          </p>

          {/*
            WHO PUT IT UP, ON THE CARD (the founder, 23 September, C3.3). He
            takes this one form decision back from GOVERNING-01, which draws no
            lister on the featured card: Track G exists so a person can tell an
            owner from an agent from a firm, and the card is where they look.
            The one line the detail page's agent card already draws, from the
            same read (`listing_role` and `public.listing_lister`), in the
            card's fact size so the card keeps its measured proportions. A
            listing with no role (the seed catalogue) draws no line.
          */}
          {detail && ageText && (
            <p
              className="nf-pcard__sub nf-pcard__age"
              data-testid="card-listed-age"
              suppressHydrationWarning
            >
              {isNew && (
                <span
                  className="nf-badge nf-badge--spark nf-pcard__new"
                  title={t.shape.listed.newMarkLabel}
                >
                  <span aria-hidden="true">{t.shape.listed.newMark}</span>
                  <span className="sr-only">
                    {t.shape.listed.newMarkLabel}.{" "}
                  </span>
                </span>
              )}
              {ageText}
            </p>
          )}

          {detail && listing.listerRole ? (
            <ListerRoleLine
              role={listing.listerRole}
              name={listing.listerName ?? null}
              className="nf-pcard__lister"
            />
          ) : null}

          {/* V-03, the proof strip's compact form: two dated facts at most,
              as text (the card is one link, and a link may not hold a
              button). Nothing at all when nothing is dated. */}
          {detail && (
            <ProofStrip
              lines={proofLines(proofFactsOf(listing))}
              variant="compact"
              t={t}
              locale={locale}
              className="mt-3xs"
            />
          )}

          {price.lead === "none" && (
            <p className="nf-pcard__sub font-semibold">
              {t.common.priceOnRequest}
            </p>
          )}

          {price.lead === "headline" && (
            <p className="nf-pcard__price">
              <Amount
                minorUnits={price.minor}
                locale={locale}
                currency={listing.currency}
                glance
                secondaryClassName={fractionClass(
                  price.minor,
                  "text-[length:max(0.6em,0.75rem)] font-semibold opacity-70"
                )}
              />
              <PriceGuide minor={price.minor} currency={listing.currency} compact />
              {suffix && (
                <span className="nf-pcard__price-suffix">{suffix}</span>
              )}
            </p>
          )}

          {/* A tenancy leads with the move-in total, the one figure this
              product exists to print, and keeps the rent beneath it. */}
          {price.lead === "moveIn" && (
            <>
              <p className="nf-pcard__price">
                {price.approximate && (
                  <span className="nf-pcard__price-suffix mr-2xs ml-0">
                    from
                  </span>
                )}
                {/*
                  THE MOVE-IN TOTAL COUNTS UP ONCE, WHEN THE CARD FIRST ENTERS
                  (MOTION_SYSTEM section 5, "Cards"). The server prints the
                  final figure, so it is right with scripts off and for a
                  screen reader, which hears only the final figure. It never
                  counts again on a re-render, and it is a stated price on a
                  listing rather than a balance, so it implies no money moved.
                  Reduced motion, Calm and Off print it still.
                */}
                <CountUpMoney
                  minorUnits={price.minor}
                  locale={locale}
                  currency={listing.currency}
                  glance
                  eager={countsOnArrival}
                >
                  <Amount
                    minorUnits={price.minor}
                    locale={locale}
                    currency={listing.currency}
                    glance
                    secondaryClassName={fractionClass(
                      price.minor,
                      "text-[length:max(0.6em,0.75rem)] font-semibold opacity-70"
                    )}
                  />
                </CountUpMoney>
                <span className="nf-pcard__price-suffix">{copy.moveIn}</span>
              </p>
              {detail && (
                <p className="nf-pcard__sub">
                  {copy.rent}{" "}
                  <Amount
                    minorUnits={price.rentMinor}
                    locale={locale}
                    currency={listing.currency}
                    glance
                    suffix={t.experienceLabels.periodShort[price.rentPeriod]}
                    className="whitespace-nowrap font-semibold text-[var(--nf-content-secondary)]"
                    /* The kobo and the "/yr" on this line at the line's own
                     overline size, not a step under it: `0.85em` of the 12px
                     sub line drew them at 10.2px, under the 11px floor
                     (SW-O4). The listing page's "/ year" took the caption
                     size in its own, larger panel; on the card the sub line
                     is the overline, so the suffix matches it. */
                    secondaryClassName={fractionClass(
                      price.rentMinor,
                      "text-[length:var(--nf-text-overline)] font-semibold"
                    )}
                  />
                </p>
              )}
              {/* V-65. How much rent is asked for at the start, and when that
                  is several years, what that means at the door. */}
              {detail && cash && cash.upfrontMonths !== null && (
                <p
                  className="nf-pcard__sub break-words"
                  data-testid="card-upfront"
                >
                  {cash.restated
                    ? t.shape.cash.listerAsks
                        .replace(
                          "{duration}",
                          upfrontDuration(cash.upfrontMonths, t.shape.cash)
                        )
                        .replace(
                          "{amount}",
                          formatMoney(cash.minor, locale, listing.currency)
                        )
                    : upfrontText(cash.upfrontMonths, t.shape.cash)}
                </p>
              )}
            </>
          )}

          {detail && shapeLine && (
            <p className="nf-pcard__facts" data-testid="card-shape">
              <span className="nf-pcard__fact min-w-0 items-start whitespace-normal">
                <UiIcon name="house" size={12} className="mt-3xs shrink-0" />
                <span className="break-words">{shapeLine}</span>
              </span>
            </p>
          )}
          {shown.length > 0 && (
            <ul
              className={`nf-pcard__facts${
                shapeLine ? " mt-0 border-t-0 pt-2xs" : ""
              }`}
              data-testid="card-facts"
            >
              {shown.map((fact) => (
                <li key={fact.key} className="nf-pcard__fact">
                  <UiIcon name={fact.icon} size={12} />
                  <span className={fact.numeric ? "nf-numeric" : undefined}>
                    {fact.label}
                  </span>
                </li>
              ))}
              {spilled.length > 0 && (
                <li
                  className="nf-pcard__fact nf-pcard__fact--more"
                  title={spilled.map((fact) => fact.label).join(", ")}
                  data-testid="card-facts-more"
                >
                  <span aria-hidden="true">+{spilled.length}</span>
                  {/* The facts themselves, for anybody who cannot see the
                      count. A "+1" with nothing behind it is a decoration. */}
                  <span className="sr-only">
                    {spilled.map((fact) => fact.label).join(", ")}
                  </span>
                </li>
              )}
            </ul>
          )}
          {/* Listing stats: views and saves, its own quiet line under the facts. */}
          <CardCounts stats={listing.stats} rating={listing.rating} reviewCount={listing.reviewCount} locale={locale} />

          {/* "Ownership seen", the owner's own mark, as on the listing page
              and the profile. A trust mark, so the short grid card keeps it
              as it keeps Verified. */}
          {ownershipSeen && !listing.isDemo && (
            <p className="nf-pcard__sub mt-inline-tight">
              <OwnershipSeenMark seenAt={ownershipSeen.seenAt} label={ownershipSeen.label} />
            </p>
          )}

          {/* V-43. The rush-hour band to where the reader goes every day, with
              whose figure it is. Absent when no band exists for this area. */}
          {detail && commute && (
            <p
              className="nf-pcard__sub inline-flex items-start gap-inline-tight"
              data-testid="card-commute"
            >
              <UiIcon name="history" size={12} className="mt-3xs shrink-0" />
              <span className="break-words">{commute}</span>
            </p>
          )}

          {/* V-68. Serviced, only when the charge covers power, water and
              security; the word is derived, never typed by the lister. */}
          {detail && listing.service?.serviced && (
            <p
              className="nf-pcard__sub inline-flex items-start gap-inline-tight"
              data-testid="card-serviced"
            >
              <UiIcon name="bolt" size={12} className="mt-3xs shrink-0" />
              <span className="break-words">{t.shape.service.serviced}</span>
            </p>
          )}

          {/* V-28. The one compound answer that earns a line on a card:
              whether the landlord lives there. Absent when unanswered. */}
          {detail && listing.compound?.landlordOnSite !== undefined && (
            <p
              className="nf-pcard__sub inline-flex items-start gap-inline-tight"
              data-testid="card-landlord"
            >
              <UiIcon name="house" size={12} className="mt-3xs shrink-0" />
              <span className="break-words">
                {/* The lister's answer, and the line says so (V-28 review). */}
                {t.shape.compound.listerSays.replace(
                  "{fact}",
                  listing.compound.landlordOnSite
                    ? t.shape.compound.landlordOnSite
                    : t.shape.compound.landlordElsewhere
                )}
              </span>
            </p>
          )}

          {/* The one Nigerian field that earns a line in a grid: what happens
              when the light goes. Absent when the host has not answered. */}
          {detail && power && (
            <p className="nf-pcard__sub mt-inline-tight inline-flex items-start gap-inline-tight">
              <UiIcon name="bolt" size={12} className="mt-3xs shrink-0" />
              <span className="break-words">{power}</span>
            </p>
          )}
          {detail && photographed && (
            <p
              className="nf-pcard__sub mt-inline-tight inline-flex items-start gap-inline-tight"
              data-testid="card-photographed"
            >
              <UiIcon name="picture" size={12} className="mt-3xs shrink-0" />
              <span className="break-words">{photographed}</span>
            </p>
          )}
        </div>
      </Link>
      {messageHref && (
        <div className="nf-pcard__action">
          <ButtonLink
            href={messageHref}
            variant="secondary"
            size="sm"
            full
            leadingIcon="chat-bubble"
            data-testid="card-message-agent"
          >
            {t.shape.card.messageAgent}
          </ButtonLink>
        </div>
      )}
      <CardMenu
        open={menu.open}
        onOpenChange={menu.setOpen}
        listingId={listing.id}
        title={listing.title}
        thumb={photo}
        saved={save.saved}
        onToggleSave={() => {
          setHeartPop(true);
          save.toggle();
        }}
        mint={menu.mint}
        shareable={shareable}
      />
    </article>
  );
}
