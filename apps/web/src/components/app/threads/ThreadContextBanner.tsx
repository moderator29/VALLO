"use client";

import Link from "next/link";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { Inspection } from "@/lib/inspections/types";
import type { ThreadContext } from "@/lib/messages/live";
import { BookingFace } from "./BookingFace";
import { RentalFace } from "./RentalFace";
import { ReservationFace } from "./ReservationFace";

/**
 * THE ONE FORK POINT IN A THREAD.
 *
 * Rendered between the header and the scroll column. Everything else in
 * `ThreadView` (bubbles, composer, optimistic send, realtime, attachments,
 * the safety line) is shared by every kind of conversation; this slot is the
 * only place the kind of thing the chat is FOR changes what is drawn.
 *
 * Three faces, three files, and the separation is structural rather than a
 * flag: a reservation thread cannot grow an inspection button because
 * `ReservationFace` never imports one. All three now wear one material, the
 * context card of 9E06F51C: a glass object with the mark on the left, the
 * enquiry named, the property under it, and the face's own controls in a row.
 *
 * A listing thread always draws the context card (the rental enquiry, the
 * property, a chevron to it); the inspection face sits under it only when
 * there is a live inspection to answer.
 */
export type ThreadRole = "host" | "guest";

export function ThreadContextBanner({
  context,
  inspection,
  role,
  counterpartName,
  listing,
  copy,
  locale,
  onAccepted,
  dayKit,
  conversationId = null,
}: {
  context: ThreadContext;
  /** The live inspection on a listing thread, resolved server-side. */
  inspection: Inspection | null;
  /** Host is the lister, the restaurant or the property; guest is the other side. */
  role: ThreadRole;
  counterpartName: string;
  /** The property the thread is about, for the context card. */
  listing: { id: string; title: string; area: string; city: string } | null;
  copy: Dictionary["threads"];
  locale: Locale;
  onAccepted: () => void;
  /** B5: the viewing day kit's words, for a confirmed inspection. */
  dayKit?: Dictionary["memberKit"]["dayKit"];
  /** This conversation, where the day kit's messages are sent. */
  conversationId?: string | null;
}) {
  const words = copy.context;

  /* A chat between two members has no context to card: no listing, stay or table. */
  if (context.kind === "direct") return null;

  if (context.kind === "reservation") {
    if (!context.reservation) return null;
    const reservation = context.reservation;
    return (
      <div className="mb-row flex flex-col gap-inline">
        {/*
          THE WAY TO THE THING THE CONVERSATION IS ABOUT.

          This branch returned the face alone and the face carries no link, no
          button and no href, so a guest in a table thread could not reach the
          restaurant or their own trips from the one screen they were on. The
          card is the listing branch's, with its actions row rather than a
          chevron, because two destinations cannot both be a card-wide anchor
          and an anchor inside an anchor is not markup.

          The restaurant link is drawn only when the reservation carries a
          listing: a table held against a business row has nowhere on the
          catalogue to point at, and a dead control is never drawn.
        */}
        <div className="nf-panel nf-panel--card nf-context-card flex-col items-stretch" data-testid="thread-context-card">
          <div className="flex items-center gap-row">
            <span className="nf-plate nf-plate--brand nf-plate--md nf-context-card__mark" aria-hidden="true">
              {/* The shared lit plate with a line glyph, as the rental render
                  draws its house (9E06F51C). */}
              <UiIcon name="utensils" size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="nf-context-card__title">{words.tableBooking}</span>
              {reservation.listingTitle && (
                <span className="nf-context-card__line">
                  <span className="truncate">{reservation.listingTitle}</span>
                </span>
              )}
            </span>
          </div>
          <div className="nf-context-card__actions">
            <Link href="/bookings?side=stays&from=stays" className="nf-btn nf-btn--primary nf-btn--md">
              {words.viewTrips}
              <UiIcon name="chevron-right" size={16} />
            </Link>
            {reservation.listingId && (
              <Link
                href={`/restaurant/${reservation.listingId}`}
                className="nf-btn nf-btn--glass nf-btn--md"
              >
                <UiIcon name="utensils" size={16} />
                {words.viewRestaurant}
              </Link>
            )}
          </div>
        </div>
        <ReservationFace
          reservation={reservation}
          viewerIsGuest={role === "guest"}
          copy={copy.reservation}
          locale={locale}
        />
      </div>
    );
  }

  if (context.kind === "booking") {
    if (!context.booking) return null;
    const booking = context.booking;
    return (
      <div className="mb-row flex flex-col gap-inline">
        {/*
          Same repair as the reservation branch, and the governing chat image
          asks for exactly this pair: "View booking details" as the primary and
          a second, quieter way to the place. `/bookings/<id>` is the trips
          hub's own detail route, which is where the booking itself lives.

          THE PROPERTY LINK GOES TO THE CATALOGUE PAGE. `loadThread` gives this
          face a `listingId` and no accommodation id, so `/stay/<id>` would be
          a guess; `/listing/<listingId>` is the row the booking was written
          against and always resolves. Carrying the accommodation id through
          would be a change to `lib/messages/live.ts`, which is another
          worker's file.
        */}
        <div className="nf-panel nf-panel--card nf-context-card flex-col items-stretch" data-testid="thread-context-card">
          <div className="flex items-center gap-row">
            <span className="nf-plate nf-plate--brand nf-plate--md nf-context-card__mark" aria-hidden="true">
              <UiIcon name="bed" size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="nf-context-card__title">{words.stayBooking}</span>
              <span className="nf-context-card__line">
                <span className="truncate">{booking.title}</span>
              </span>
            </span>
          </div>
          <div className="nf-context-card__actions">
            <Link href={`/bookings/${booking.id}`} className="nf-btn nf-btn--primary nf-btn--md">
              {words.viewBooking}
              <UiIcon name="chevron-right" size={16} />
            </Link>
            {/* A hotel room has no listing page (ROOM BOOKINGS 1). */}
            {booking.listingId ? (
              <Link href={`/listing/${booking.listingId}`} className="nf-btn nf-btn--glass nf-btn--md">
                <UiIcon name="house" size={16} />
                {words.viewProperty}
              </Link>
            ) : null}
          </div>
        </div>
        <BookingFace
          booking={booking}
          stateEvents={context.stateEvents ?? []}
          copy={copy.booking}
          locale={locale}
        />
      </div>
    );
  }

  return (
    <div className="mb-row flex flex-col gap-inline">
      {listing && (
        <Link
          href={`/listing/${listing.id}`}
          className="nf-panel nf-panel--card nf-context-card"
          data-testid="thread-context-card"
        >
          <span className="nf-plate nf-plate--brand nf-plate--md nf-context-card__mark" aria-hidden="true">
            <UiIcon name="home" size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="nf-context-card__title">{words.rentalEnquiry}</span>
            <span className="nf-context-card__line">
              <span className="truncate">{listing.title}</span>
              {listing.area && <span>{listing.area}</span>}
            </span>
          </span>
          <UiIcon name="chevron-right" size={20} className="nf-context-card__chev" />
        </Link>
      )}
      {/* A renter in a listing thread with no viewing on it had nothing to
          press: the request lives on the listing, and the chat's own
          "When can I view it?" chip is only words. The way there, named. */}
      {!inspection && listing && role === "guest" && (
        <Link
          href={`/listing/${listing.id}#reserve`}
          className="nf-btn nf-btn--glass nf-btn--sm self-start"
          data-testid="thread-ask-viewing"
        >
          <UiIcon name="calendar-booking" size={16} />
          {words.askViewing}
        </Link>
      )}
      {inspection && (
        <RentalFace
          key={`${inspection.id}:${inspection.state}:${inspection.slotAt ?? ""}`}
          inspection={inspection}
          role={role === "host" ? "lister" : "requester"}
          counterpartName={counterpartName}
          copy={copy.rental}
          locale={locale}
          onAccepted={onAccepted}
          dayKit={dayKit}
          conversationId={conversationId}
          area={listing?.area || listing?.city || ""}
          place={[listing?.area, listing?.city].filter(Boolean).join(", ")}
        />
      )}
    </div>
  );
}

