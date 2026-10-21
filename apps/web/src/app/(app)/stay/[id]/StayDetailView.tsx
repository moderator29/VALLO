import { countOf, formatMoney, formatNumber, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Amount } from "@/components/ui/Amount";
import type { ReactNode } from "react";
import { policyFootLines, refundLines, refundTiers } from "@/lib/host/cancellation-presets";
import type { DoorCharge } from "@/lib/stays/door-total";
import { formatMoneyDate } from "@/lib/money/dates";
import { freeToCancelUntil, termsFromPolicyRules } from "@/lib/trust/cancellation";
import { ReportSheet } from "@/components/app/ReportSheet";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { DetailGlyph } from "@/components/app/listing/DetailGlyph";
import { ListingGallery } from "@/components/app/listing/ListingGallery";
import { ICON, Section, Stack, TYPE } from "@/components/app/Screen";
import { RoomTypes } from "./RoomTypes";
import { StayDatesForm } from "./StayDatesForm";
import { StayCostLive, StayFootLive, StayPickProvider } from "./StayPick";
import { stayDateLabel } from "@/lib/stays/date-label";
import {
  DetailAboutCard,
  DetailCapsules,
  DetailPriceRow,
  DetailSpecStrip,
  type SpecPair,
} from "@/components/app/listing/DetailAnatomy";
import {
  bookNowChoice,
  maxSleeps,
  stayFromMinor,
  type ReserveBase,
  type StayDetail,
} from "./detail-model";
import { panelClass } from "@/components/ui/Panel";
import { Unfold } from "@/components/ui/Unfold";
import { PlaceTabs } from "@/components/app/listing/PlaceTabs";
import { PlaceMapPanel } from "@/components/app/listing/PlaceMapPanel";
import { PhotoViewerProvider } from "@/components/app/listing/PhotoViewer";
import "@/app/css/catalogue.css";

type StaysCopy = Dictionary["stayDetail"];


/* The property type as a plated line glyph (29 September 2026), the detail
   page's one row treatment, rather than a glass object at 48px. */
const BUSINESS_GLYPH: Record<string, UiIconName> = {
  hotel: "building-hotel",
  serviced_apartments: "building-apartment",
  guest_house: "house-bungalow",
  resort: "pool",
  shortlet_operator: "key",
};


/**
 * The glyph for an amenity the read names in words ("Air conditioning",
 * "Wi-Fi"). BB0C2C85 draws each tile with its own glyph; the label is
 * matched by its words, and anything unrecognised takes the shield, which is
 * honest for a fact the property stated.
 */
const AMENITY_GLYPHS: [RegExp, UiIconName][] = [
  [/wi-?fi|internet/i, "wifi"],
  [/air|a\/c|cool/i, "snowflake"],
  [/kitchen|cook/i, "kitchen"],
  [/park/i, "parking"],
  [/pool|swim/i, "pool"],
  [/breakfast|restaurant|dining|meal/i, "utensils"],
  [/gym|fitness|power|generator|electric/i, "bolt"],
  [/tv|television|screen/i, "picture"],
  [/bed|room service|linen/i, "bed"],
  [/bath|shower|tub/i, "bath"],
  [/balcon|terrace|view/i, "building-apartment"],
  [/desk|work/i, "document"],
  [/laundry|clean/i, "washing-machine"],
];

export function amenityGlyph(label: string): UiIconName {
  for (const [pattern, icon] of AMENITY_GLYPHS) if (pattern.test(label)) return icon;
  return "verified";
}

const dateLabel = stayDateLabel;

/**
 * The stay detail, to BB0C2C85 and 84054CE9.
 *
 * The photo hero, the name with the nightly figure beside it, the check-in,
 * check-out and guests row (each a link back to the date picker, since the
 * dates ride the URL), the amenity tiles, About, the Property Type card,
 * the room tiles, and Book This Stay to the rooms whose rates carry the
 * real first-party checkout. A rating appears only with reviews behind it,
 * and this read carries none, so none is drawn.
 */
export function StayDetailView({
  detail,
  nights,
  checkIn,
  checkOut,
  guests,
  locale,
  copy,
  t,
  datesHref,
  reserve,
  saved = false,
  signedIn,
  instant = false,
  arrival = null,
  door = [],
}: {
  /** The declared charges at the door, for the all-in cost before booking. */
  door?: readonly DoorCharge[];
  /**
   * The charges at the door this stay has declared (V-57), drawn by the page
   * with `ArrivalChargesLine`, so a guest reads them before they book, as
   * Booking.com and Airbnb require. Null where there is nothing to draw.
   */
  arrival?: ReactNode;
  detail: StayDetail;
  nights: number | null;
  checkIn?: string;
  checkOut?: string;
  guests: number;
  locale: Locale;
  copy: StaysCopy;
  t: Dictionary;
  datesHref: string;
  reserve: ReserveBase;
  /** Whether this accommodation is already on the account's shortlist, read
      on the server from `saved_places` so the heart is lit before hydration
      and stays lit through a reload. */
  saved?: boolean;
  /** Whether the reader is signed in. When given, the page carries a report
      control for the place (STORE-P2-01); a static preview passes nothing. */
  signedIn?: boolean;
  /**
   * D73 (`stays_instant_pay`): the foot reads "Book and pay" only when a
   * room is booked and paid in one flow; with the switch off a booking still
   * waits for the host, so it keeps "Book now". Words only.
   */
  instant?: boolean;
}) {
  const from = stayFromMinor(detail, nights);
  const total = from !== null && nights !== null ? from * nights : null;
  const where = [detail.area, detail.city].filter(Boolean).join(", ");
  const catalogue = t.catalogue.stays;
  const businessKind = detail.businessKind ?? "hotel";
  const kindLabel = (t.experienceDetail.stay.kinds as Record<string, string>)[businessKind];
  const detailCopy = t.catalogue.detail;
  const sx = t.experienceDetail;

  /*
   * THE SPEC STRIP, from what this record actually states.
   *
   * B047A0CE draws three pairs and its example is "4 Beds | 5 Baths |
   * 2 Living Rooms", which is a RENTAL's vocabulary. An accommodation carries
   * none of those columns: `room_types` states who a room sleeps and what it
   * is, and `accommodations` states the class and the check-in time. So the
   * strip is the same shape filled with this record's own facts, in the order
   * a guest compares them, and a fact the property did not state is simply not
   * a cell. Inventing a bathroom count to match a render is the exact failure
   * the direction's "translate, never copy" rule exists to prevent.
   */
  const sleeps = maxSleeps(detail);
  const specCandidates: SpecPair[] = [];
  if (sleeps !== null) {
    specCandidates.push({
      key: "sleeps",
      icon: "bed",
      label: copy.sleeps.replace("{count}", formatNumber(sleeps, locale)),
    });
  }
  if (detail.roomTypes.length > 0) {
    specCandidates.push({
      key: "rooms",
      icon: "building-apartment",
      label:
        detail.roomTypes.length === 1
          ? copy.roomTypesOne
          : copy.roomTypes.replace("{count}", formatNumber(detail.roomTypes.length, locale)),
    });
  }
  if (detail.starRating) {
    specCandidates.push({
      key: "class",
      icon: "star",
      label: t.experienceDetail.stay.stars.replace("{count}", formatNumber(detail.starRating, locale)),
    });
  }
  if (detail.checkInFrom) {
    specCandidates.push({
      key: "check-in",
      icon: "history",
      label: `${catalogue.checkIn} ${detail.checkInFrom.slice(0, 5)}`,
    });
  }

  /* The capsules: the first four amenities the property named, each with the
     glyph its words earn. Never a facility nobody claimed. */
  const capsules = detail.amenities.map((amenity) => ({
    key: amenity,
    icon: amenityGlyph(amenity),
    label: amenity,
  }));

  /*
   * WHAT "BOOK NOW" HONESTLY MEANS HERE.
   *
   * With dates picked and a room that takes the party, it means the cheapest
   * rate that can actually be booked, and the link is the real first-party
   * checkout `reserveHref` builds, the same URL the room rows build. Without
   * dates it means "pick your dates", because a checkout with no dates is a
   * checkout that refuses. With dates and nothing bookable it means "see the
   * rooms", because the refusal belongs where the reader can do something
   * about it. Three states, three honest destinations, no dead button.
   */
  const datesPicked = Boolean(checkIn && checkOut && nights !== null && nights > 0);
  /* V-20. Book now picks the cheapest rate that can be cancelled for free,
     else the cheapest, and says which; `cheapestBookable` is kept for the
     room list's own ordering. */
  // A server render per request, so this instant is when the reader sees it.
  const renderedAt = new Date();
  const choice = datesPicked ? bookNowChoice(detail, nights, guests, checkIn, renderedAt) : null;
  const bookable = choice?.pick ?? null;
  /* The total under Book now is the total of the rate Book now opens, not the
     cheapest rate on the property, or the button and its figure disagree. */
  const bookNowTotal = bookable && nights !== null ? bookable.plan.rateMinor * nights : total;
  const checkInHour = Number.parseInt(detail.checkInFrom ?? "", 10);
  const gateCopy = t.afterTheGate.cancel;
  const choiceNote = choice ? (choice.refundable ? gateCopy.bookNowRefundable : gateCopy.bookNowCheapest) : null;
  const bothRates = (() => {
    if (!choice?.cheaperNonRefundable || nights === null || !checkIn) return null;
    const flexPlan = choice.pick.plan;
    const terms = flexPlan.policy
      ? termsFromPolicyRules(flexPlan.policy.id, flexPlan.policy.rules, Number.isInteger(checkInHour) ? checkInHour : 15)
      : null;
    const until = terms ? freeToCancelUntil(terms, checkIn) : null;
    const untilLabel = until && until > renderedAt ? formatMoneyDate(until, locale, { withTime: true }) : null;
    if (!untilLabel) return null;
    return gateCopy.bothRates
      .replace("{cheap}", formatMoney(choice.cheaperNonRefundable.plan.rateMinor * nights, locale))
      .replace("{flex}", formatMoney(flexPlan.rateMinor * nights, locale))
      .replace("{date}", untilLabel);
  })();
  /* THE INSTANT BOOKING (D73). The page starts on the rate Book now always
     chose (`bookNowChoice`); the rate cards let the guest choose another, and
     the cost card and the anchored foot follow the choice (`StayPick`). The
     notes say why the starting rate was chosen, in the policy's own words;
     they used to be a separate "Cancelling this stay" section beside
     "Cancellation", and they are drawn only while that rate is chosen. */
  const initialPick = bookable && !detail.isExample ? { roomId: bookable.room.id, planId: bookable.plan.id } : null;
  const costStrip = {
    checkIn: { label: catalogue.checkIn, value: dateLabel(checkIn) ?? detailCopy.selectDate },
    checkOut: { label: catalogue.checkOut, value: dateLabel(checkOut) ?? detailCopy.selectDate },
    totalLabel: copy.totalLabel,
  };
  /* Getting there, as the place published it: its area and its times. */
  const placeFacts = [
    ...(where ? [{ key: "area", icon: "location" as const, label: catalogue.place.area, value: where }] : []),
    ...(detail.checkInFrom
      ? [{ key: "in", icon: "key" as const, label: catalogue.place.checkIn, value: detail.checkInFrom.slice(0, 5) }]
      : []),
    ...(detail.checkOutBy
      ? [{ key: "out", icon: "door" as const, label: catalogue.place.checkOut, value: detail.checkOutBy.slice(0, 5) }]
      : []),
  ];
  const pickNotes = [bothRates, choiceNote].filter((note): note is string => Boolean(note));

  return (
    <StayPickProvider initial={initialPick}>
    <PhotoViewerProvider title={detail.name} photos={detail.photos.map((photo) => photo.url)} hue={0} kind="hotel">
    <div className="nf-cat-surface">
      <ListingGallery
        listingId={detail.id}
        title={detail.name}
        hue={0}
        kind="hotel"
        photos={detail.photos.map((photo) => photo.url)}
        backFallback="/stays"
        mark={{ label: catalogue.title, icon: "bed" }}
        /* `detail.id` is an ACCOMMODATION id, not a listing id, so the share
           path has to be told or it builds `/listing/<accommodationId>`,
           which resolves to nothing. See `components/app/messages/share.ts`. */
        shareKind="stay"
        /* And the heart writes to `saved_places` under the accommodation kind
           rather than to `saved_items`, whose foreign key can never accept
           this id. It refused every tap on this page until now. */
        place={{ kind: "accommodation", id: detail.id }}
        initialSaved={saved}
      />

      <div className="mx-auto max-w-2xl pb-section">
        {/* ------------------------------------------------ the headline
            B047A0CE's order exactly: the name, the pin line, the bordered
            strip of spec pairs, then the figure in blue with its unit and the
            rating on the same row, then the capsules. The card is lit glass
            and overlaps the photograph, as every lead card here does. */}
        <div className={panelClass({ variant: "card", className: "nf-detail-lead relative z-10 -mt-xl block sm:-mt-2xl" })}>
          <h1 className="nf-h2 [text-wrap:balance]">{detail.name}</h1>
          {/* D24: no example label here; the stay simply offers no booking
              (below) and draws no trust it did not earn (page.tsx). */}
          {where && (
            <p className={`mt-inline-tight flex items-center gap-inline-tight ${TYPE.body}`}>
              <UiIcon name="location" size={ICON.inline} className="shrink-0 text-[var(--nf-brand-secondary)]" />
              {where}
            </p>
          )}

          <DetailSpecStrip pairs={specCandidates} />

          {from !== null ? (
            <DetailPriceRow
              figure={
                <span data-testid="stay-from">
                  <Amount
                    minorUnits={from}
                    locale={locale}
                    secondaryClassName="text-[length:max(0.6em,0.75rem)] font-semibold opacity-70"
                  />
                </span>
              }
              unit={catalogue.perNight}
              /* THE NIGHTLY RATE LEADS AND THE TOTAL FOR THE DATES SITS
                 BENEATH IT (north star 10 C): the same total Book now opens,
                 never the cheapest rate on the property, so the figure and
                 the button cannot disagree. Absent until dates are picked,
                 and absent when nothing can be booked for them: the total
                 then falls back to the property's own, which no button
                 opens, so it is not said under the nightly rate. */
              sub={
                bookable !== null && bookNowTotal !== null && nights !== null && nights > 0 && !detail.isExample
                  ? sx.stay.forDates
                      .replace("{total}", formatMoney(bookNowTotal, locale))
                      .replace("{nights}", countOf(nights, "nights", locale))
                  : null
              }
              /* Drawn only where real review rows stand behind it. */
              rating={
                detail.rating && detail.rating.count > 0
                  ? {
                      average: formatNumber(detail.rating.average, locale, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      }),
                      reviews: catalogue.reviews.replace(
                        "{count}",
                        formatNumber(detail.rating.count, locale),
                      ),
                    }
                  : null
              }
            />
          ) : (
            <p className={`mt-md ${TYPE.rowMeta}`}>{copy.noRate}</p>
          )}

          <DetailCapsules items={capsules} label={t.catalogue.detail.amenities} />
        </div>

        {/* ------------------------------------- about, and who hosts it */}
        <div className="mt-block">
          <DetailAboutCard
            title={catalogue.aboutThisStay}
            paragraphs={detail.description ? [detail.description] : []}
            host={
              detail.hostName
                ? {
                    name: detail.hostName,
                    role: kindLabel ?? t.experienceDetail.stay.host,
                    verified: detail.hostVerified === true,
                    verifiedLabel: detailCopy.verifiedHost,
                    /* An accommodation id is not a listing id, so the old
                       `/messages/new?listing=` link could only fail. A stay is
                       messaged through its business (`MessageVenue`). */
                    messageHref: null,
                    messageVenue:
                      detail.isExample || !detail.businessId
                        ? null
                        : { businessId: detail.businessId, venueName: detail.hostName },
                    messageLabel: detailCopy.message,
                  }
                : null
            }
          />
        </div>

        {/* THE STAY AND ITS MAP (the travel-app reference): one switch, the
            booking on one side and the area, getting there and the photo
            tour on the other. */}
        <div className="mt-block">
        <PlaceTabs
          label={detail.name}
          labels={{ main: catalogue.place.tabStay, map: catalogue.place.tabMap }}
          map={
            <PlaceMapPanel
              lead={catalogue.place.mapLead}
              coords={detail.areaPoint ?? null}
              area={where}
              unavailable={catalogue.place.mapUnavailable.replace("{area}", where)}
              facts={placeFacts}
              photoTour={
                detail.photos.length > 0
                  ? {
                      label: catalogue.place.photoTour,
                      caption: catalogue.place.photos.replace("{count}", formatNumber(detail.photos.length, locale)),
                      count: detail.photos.length,
                    }
                  : null
              }
            />
          }
          main={
            <>
        {/* --------------------------------------- dates and the party */}
        {detail.isExample ? (
          /* A stay that takes no bookings has no Book now to press and be
             refused at checkout. The same consequence line the property page
             draws, with no label on it (D24). */
          <div className="mt-block" data-testid="stay-not-bookable">
            <div className={panelClass({ variant: "card", className: "block p-card" })}>
              <p className={TYPE.rowMeta}>
                {sx.closed.stayBody}
              </p>
              <ButtonLink href="/stays" variant="primary" className="mt-block w-full">
                {sx.closed.stayAction}
              </ButtonLink>
            </div>
          </div>
        ) : (
        <div className="mt-block grid gap-block" data-testid="stay-dates-row">
          {/* ONE dates card: the form is the availability card (it used to be
              a card of links to this form, drawn above the form). Without
              dates it asks for them; with them, the cost below says the
              total, so the card does not say it a second time. */}
          <StayDatesForm
            action={`/stay/${detail.id}`}
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
            note={nights === null ? copy.pickDatesForTotal : undefined}
            copy={{
              title: detailCopy.checkAvailability,
              checkIn: catalogue.checkIn,
              checkOut: catalogue.checkOut,
              guests: catalogue.guests,
              submit: copy.datesSubmit,
            }}
          />
        </div>
        )}

        <Stack className="mt-block">
          {/* ------------------------------------- rooms and their rates */}
          <Section id="rooms" title={copy.roomsTitle} description={detail.isExample ? copy.roomsDescription : copy.ratesDescription} className="scroll-mt-28">
            {detail.isExample ? (
              <p className={TYPE.rowMeta} data-testid="rooms-example">
                {sx.closed.rooms}
              </p>
            ) : detail.roomTypes.length > 0 ? (
              <RoomTypes
                detail={detail}
                guests={guests}
                nights={nights}
                locale={locale}
                copy={copy}
              />
            ) : (
              <p className={TYPE.rowMeta}>{copy.noRoomsYet}</p>
            )}
          </Section>

          {/* TRUE COST (reference 8) for the chosen rate: only the figures
              Book and pay will charge, and nothing until a rate is chosen. */}
          {detail.isExample ? null : (
            <StayCostLive
              detail={detail}
              nights={nights}
              locale={locale}
              strip={costStrip}
              totalFor={copy.totalFor}
              notesForInitial={pickNotes}
              door={door}
              doorCopy={t.afterTheGate.arrival}
              guests={guests}
            />
          )}

          {/* CLEAN SPACES (the unify recommendations, 7 October): the page
              is for one thing, choosing a rate and booking it. The amenities
              are already the capsules on the lead card, so their second grid
              is gone; the property's type and times, its cancellation policy
              and its house rules fold one tap deeper, in their own words. */}
          {(() => {
            const items = [
              {
                id: "details",
                icon: BUSINESS_GLYPH[businessKind] ?? "building-hotel",
                title: copy.theDetails,
                hint: kindLabel ?? t.experienceDetail.stay.kinds.hotel,
                content: (
                  <div className="nf-stay-type" data-testid="stay-type">
                    <DetailGlyph
                      name={BUSINESS_GLYPH[businessKind] ?? "building-hotel"}
                      className="nf-stay-type__object"
                    />
                    <span className="min-w-0">
                      <span className={`block ${TYPE.label}`}>{catalogue.propertyType}</span>
                      <span className={`block ${TYPE.rowTitle}`}>{kindLabel ?? t.experienceDetail.stay.kinds.hotel}</span>
                      <span className={`mt-3xs block ${TYPE.rowMeta}`}>
                        {detail.roomTypes.length > 0
                          ? countOf(detail.roomTypes.length, "roomTypes", locale)
                          : copy.noRoomsYet}
                        {detail.checkInFrom ? ` · ${copy.checkIn} ${detail.checkInFrom.slice(0, 5)}` : ""}
                        {detail.checkOutBy ? ` · ${copy.checkOut} ${detail.checkOutBy.slice(0, 5)}` : ""}
                      </span>
                    </span>
                  </div>
                ),
              },
              ...(detail.policy
                ? [
                    {
                      id: "cancellation",
                      icon: "verified" as const,
                      title: copy.policyTitle,
                      hint: detail.policy.name,
                      /* The policy, in its own words. A refund rule this screen
                         rewrote is a refund rule nobody can be held to. */
                      content: (
                        <div>
                          <p className={`${TYPE.body} leading-relaxed`}>{detail.policy.summary}</p>
                          {/* Each refund tier in plain words, from the tiers the
                              refund is computed from, so the sentence and the
                              money cannot disagree. */}
                          {refundTiers(detail.policy.rules).length > 0 && (
                            <ul className="mt-row grid gap-inline-tight" data-testid="stay-refund-lines">
                              {refundLines(detail.policy, t.hostWorkspace.cancellation, locale).map((line) => (
                                <li key={line} className={TYPE.rowMeta}>
                                  {line}
                                </li>
                              ))}
                              {policyFootLines(detail.checkInFrom, t.hostWorkspace.cancellation, locale).map((line) => (
                                <li key={line} className={TYPE.rowMeta}>
                                  {line}
                                </li>
                              ))}
                            </ul>
                          )}
                          {detail.policy.freeUntilHours !== null && (
                            <p className={`mt-row flex items-start gap-inline-tight ${TYPE.rowMeta}`}>
                              <UiIcon name="verified" size={ICON.inline} className="mt-3xs shrink-0 text-[var(--nf-state-success)]" />
                              <span className="min-w-0">{copy.freeUntil.replace("{hours}", String(detail.policy.freeUntilHours))}</span>
                            </p>
                          )}
                        </div>
                      ),
                    },
                  ]
                : []),
              ...(detail.houseRules
                ? [
                    {
                      id: "rules",
                      icon: "document" as const,
                      title: copy.houseRulesTitle,
                      content: <p className={`${TYPE.body} leading-relaxed`}>{detail.houseRules}</p>,
                    },
                  ]
                : []),
            ];
            return <Unfold items={items} headingLevel={2} data-testid="stay-more" />;
          })()}

          {arrival ? <div className="py-md">{arrival}</div> : null}

          {signedIn !== undefined && (
            <div className="py-md" data-testid="stay-report">
              <ReportSheet
                targetType="business"
                targetId={detail.id}
                targetLabel={detail.name}
                signedIn={signedIn}
              />
            </div>
          )}
        </Stack>
            </>
          }
        />
        </div>
      </div>

      {/*
        THE ANCHORED FOOT IS BACK, AND THE TWO FAULTS THAT TOOK IT AWAY ARE NOT.

        An audit removed an earlier foot because it painted over the amenity
        tiles at 390 and quoted a total a second time under a card that
        already stated it. The premium standard (7 October) asks for one
        detail anatomy across both markets and one anchored primary action,
        and the Property side ends on `ListingStickyBar`. So: the foot ships
        its own measured spacer (nothing is painted under it), and it is now
        the page's ONLY Book now: the dates card submits as a secondary and
        no longer carries a total or a Book now of its own. An example stay
        books nothing, so it draws no foot.
      */}
      {detail.isExample ? null : (
        <StayFootLive
          detail={detail}
          nights={nights}
          locale={locale}
          reserve={reserve}
          fromMinor={from}
          datesHref={datesHref}
          labels={{
            book: instant ? copy.bookAndPay : detailCopy.bookNow,
            pickDates: copy.pickDates,
            seeRooms: catalogue.seeRooms,
            perNight: catalogue.perNight,
            totalFor: copy.totalFor,
            noRate: copy.noRate,
          }}
        />
      )}
    </div>
    </PhotoViewerProvider>
    </StayPickProvider>
  );
}
