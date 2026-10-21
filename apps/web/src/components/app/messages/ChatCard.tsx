"use client";

import Image from "next/image";
import { countOf, type Dictionary } from "@vallo/i18n/core";
import { useInboxPart } from "@/components/app/threads/use-inbox-copy";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import Link from "next/link";
import { MediaFrame } from "@/components/app/MediaFrame";
import { panelClass } from "@/components/ui/Panel";
import { StatusPill, toneForStatus } from "@/components/ui/StatusPill";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { ListingKind } from "@/lib/listings/types";
import { shareHref, type SharedRef } from "./share";
import { AreaMapTile } from "@/components/app/maps/AreaMapTile";
import { areaPoint } from "@/components/app/search/mapGeo";
import { PassportChatCard, type PassportChatCardData } from "@/components/passport/PassportChatCard";

/**
 * The card a listing or a booking becomes inside a chat.
 *
 * GOVERNING-chat-booking-card.png, translated: the photograph with the
 * status badge on it, the name, the stars (blue, by rule 8, and only when a
 * rating is real), the place with its pin, the check-in / check-out / guests
 * grid, the room row with a thumbnail, the features, the price and the
 * nights chip, then the primary and the glass action. A listing card is the
 * same object with the stay facts left out, because it has none.
 *
 * Everything on it is data resolved on the server from the row the share
 * points at (see `app/(app)/messages/[id]/cards.ts`), and both actions are
 * real routes. The forward control hands the same reference to the share
 * picker, which lists the reader's real inbox.
 *
 * No hooks, so it renders on the server and inside the client thread alike.
 */

export type ChatCardListing = {
  kind: "listing";
  id: string;
  title: string;
  area: string;
  city: string;
  photo: string | null;
  hue: number;
  listingKind: ListingKind;
  /** The lister's real admission state. Never defaulted. */
  verified: boolean;
  /** Pre-formatted through formatMoney on the server. */
  priceLabel: string;
  /** "per year", "per night", or "" for a sale. */
  periodLabel: string;
  bedrooms: number;
  bathrooms: number;
  /** 0 to 5, or null when nobody has rated it. */
  rating: number | null;
  /**
   * Which share this card IS, when it is not a catalogue listing.
   *
   * A stay shared from `/stay/<id>` carries an accommodation id, and both the
   * primary link and the forward have to say `stay` or they point at
   * `/listing/<accommodationId>`, which is nothing. Absent means a listing,
   * which is what every other caller sends.
   */
  shareKind?: "listing" | "stay";
};

export type ChatCardBooking = {
  kind: "booking";
  id: string;
  listingId: string;
  title: string;
  area: string;
  city: string;
  photo: string | null;
  hue: number;
  listingKind: ListingKind;
  status: string;
  statusLabel: string;
  /** "Jun 22, 2025". */
  checkInLabel: string;
  checkOutLabel: string;
  /** "2 adults", "1 child" and so on, each its own line. */
  partyLines: string[];
  /** The room row: what was booked, and what it comes with. */
  roomName: string;
  features: string[];
  totalLabel: string;
  nightsLabel: string;
  rating: number | null;
};

export type ChatCardData = ChatCardListing | ChatCardBooking;

/**
 * Every card the thread draws. The picker and the forward control only ever
 * see `ChatCardData`; a member's Vallo passport (`components/passport`) is
 * posted from the options sheet and drawn here, in the thread, and nowhere else.
 */
export type ThreadCardData = ChatCardData | PassportChatCardData;

function Stars({ rating, label }: { rating: number | null; label: string }) {
  if (rating === null || rating <= 0) return null;
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <span className="nf-chat-card__stars" role="img" aria-label={label.replace("{rating}", String(rating))}>
      {/* Solid, the way the render draws a rating. `star` is one of the
          glyphs authored as a closed silhouette, so `filled` is real here
          rather than paint poured into an outline. Blue by rule 8. */}
      {Array.from({ length: full }, (_, i) => (
        <UiIcon key={i} name="star" size={12} filled />
      ))}
    </span>
  );
}

function Photo({
  photo,
  hue,
  kind,
  alt,
}: {
  photo: string | null;
  hue: number;
  kind: ListingKind;
  alt: string;
}) {
  return (
    <div className="nf-chat-card__photo">
      <MediaFrame hue={hue} kind={kind} ghost={Boolean(photo)} />
      {photo && (
        <Image
          src={photo}
          alt={alt}
          fill
          sizes="(max-width: 640px) 90vw, 400px"
          className="object-cover"
        />
      )}
    </div>
  );
}

/**
 * The forward affordance: a 44px glyph control at the end of the title row.
 * The render draws no forward at all; it is a real route into the share
 * picker, so it stays, but in the title row's spare width rather than in a
 * foot row of its own, which cost the card 50px of height the founder asked
 * to have back.
 */
function Forward({ target, label }: { target: SharedRef; label: string }) {
  return (
    <Link
      href={`/messages/share/${target.kind}/${target.id}`}
      className="nf-chat-card__forward"
      aria-label={label}
    >
      <UiIcon name="share" size={16} />
    </Link>
  );
}

/*
 * The material is the shared card (`.nf-panel--card`, glass because it sits
 * over the thread's scroll): the console's per-side edges, the lit rim, the
 * reflection and the glow, from the token layer. `.nf-chat-card` in
 * `threads.css` only lays it out, at the proportions of
 * `founder/thread-booking-card-target.jpg`.
 */
const CARD = panelClass({ variant: "card", glass: true, className: "nf-chat-card" });

export function ChatCard({
  card,
  forwardable = true,
  thread,
}: {
  card: ThreadCardData;
  forwardable?: boolean;
  /** The thread's words (`experienceInbox.thread`), from the server parent; read lazily when absent. */
  thread?: Dictionary["experienceInbox"]["thread"];
}) {
  const w = useInboxPart("thread", thread).card;
  const locale = useClientLocale();
  /* A passport is never forwarded: it is the sender's own, shown in this
     conversation, so it carries no forward control whatever `forwardable` says. */
  if (card.kind === "passport") return <PassportChatCard card={card} />;
  if (card.kind === "listing") {
    /* What this card IS, decided once, so the primary link, the forward and
       the foot cannot disagree about it. */
    const stay = card.shareKind === "stay";
    const self: SharedRef = { kind: stay ? "stay" : "listing", id: card.id };
    const point = areaPoint(card.city, card.area);
    return (
      <article className={`${CARD} nf-chat-card--stack`} data-testid="chat-card-listing" aria-label={card.title}>
        {/* THE SHARED LISTING IS HOME'S STACK CARD (the founder's travel-app
            set, 7 October: "sharing a listing into a chat uses this card as
            its preview"): the photograph tall, the facts on a frosted inset at
            its foot beside a still map of the AREA (never the address), and
            Forward as a smoked circle on the photograph. */}
        <div className="nf-chat-card__stack">
          <Photo photo={card.photo} hue={card.hue} kind={card.listingKind} alt="" />
          {card.verified && (
            <span className="nf-badge nf-badge--verified nf-chat-card__seal">
              <UiIcon name="verified" size={12} />
              {w.verified}
            </span>
          )}
          {forwardable && <Forward target={self} label={w.forward[self.kind]} />}
          <div className="nf-chat-card__inset" data-theme="dark">
            <div className="nf-chat-card__words">
              <p className="nf-chat-card__title">{card.title}</p>
              <Stars rating={card.rating} label={w.rated} />
              <p className="nf-chat-card__place">
                <UiIcon name="location" size={12} className="shrink-0" />
                <span>{[card.area, card.city].filter(Boolean).join(", ")}</span>
              </p>
              <div className="nf-chat-card__features">
                <span>{countOf(card.bedrooms, "bedrooms", locale)}</span>
                <span>{countOf(card.bathrooms, "bathrooms", locale)}</span>
              </div>
              <p className="nf-chat-card__price-row">
                <span className="nf-chat-card__price">{card.priceLabel}</span>
                {card.periodLabel && <span className="nf-chat-card__unit">{card.periodLabel}</span>}
              </p>
            </div>
            {point ? (
              <AreaMapTile
                lat={point.lat}
                lng={point.lng}
                zoom={13}
                className="nf-chat-card__map"
                label={w.map.replace("{area}", card.area || card.city)}
              />
            ) : null}
          </div>
        </div>
        <div className="nf-chat-card__body">
          <div className="nf-chat-card__actions">
            <Link href={shareHref(self)} className="nf-btn nf-btn--primary nf-btn--sm">
              {stay ? w.viewStay : w.viewListing}
              <UiIcon name="chevron-right" size={16} />
            </Link>
            {/* A stay's enquiry thread hangs off its accommodation, which
                `/messages/new?listing=` cannot open, so the control that
                cannot act is not drawn on that face. */}
            {!stay && (
              <Link href={`/messages/new?listing=${card.id}`} className="nf-btn nf-btn--glass nf-btn--sm">
                <UiIcon name="chat-bubble" size={16} />
                {w.messageAgent}
              </Link>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={CARD} data-testid="chat-card-booking" aria-label={card.title}>
      <Photo photo={card.photo} hue={card.hue} kind={card.listingKind} alt="" />
      {/* The shared status badge itself, pinned to the photograph: no plate
          of its own round it (the second audit's S-A). */}
      <StatusPill tone={toneForStatus(card.status)} size="sm" className="nf-chat-card__badge">
        {card.statusLabel}
      </StatusPill>
      <div className="nf-chat-card__body">
        <div className="nf-chat-card__head">
          <p className="nf-chat-card__title">{card.title}</p>
          {forwardable && <Forward target={{ kind: "booking", id: card.id }} label={w.forward.booking} />}
        </div>
        <Stars rating={card.rating} label={w.rated} />
        <p className="nf-chat-card__place">
          <UiIcon name="location" size={16} className="shrink-0 text-[var(--nf-brand-secondary)]" />
          <span>{[card.area, card.city].filter(Boolean).join(", ")}</span>
        </p>

        <dl className="nf-chat-card__facts">
          <div className="nf-chat-card__fact">
            <dt className="nf-chat-card__fact-label">
              <UiIcon name="calendar-booking" size={12} className="nf-chat-card__fact-glyph" />
              {w.checkIn}
            </dt>
            <dd className="nf-chat-card__fact-value">{card.checkInLabel}</dd>
          </div>
          <div className="nf-chat-card__fact">
            <dt className="nf-chat-card__fact-label">
              <UiIcon name="calendar-booking" size={12} className="nf-chat-card__fact-glyph" />
              {w.checkOut}
            </dt>
            <dd className="nf-chat-card__fact-value">{card.checkOutLabel}</dd>
          </div>
          <div className="nf-chat-card__fact">
            <dt className="nf-chat-card__fact-label">
              <UiIcon name="user" size={12} className="nf-chat-card__fact-glyph" />
              {w.guests}
            </dt>
            {card.partyLines.map((line, i) => (
              <dd key={line} className={i === 0 ? "nf-chat-card__fact-value" : "nf-chat-card__fact-sub"}>
                {line}
              </dd>
            ))}
          </div>
        </dl>

        <div className="nf-chat-card__room">
          <div className="nf-chat-card__thumb">
            <div className="relative h-full w-full">
              <MediaFrame hue={card.hue} index={1} kind={card.listingKind} ghost={Boolean(card.photo)} />
              {card.photo && <Image src={card.photo} alt="" fill sizes="96px" className="object-cover" />}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="nf-chat-card__room-name">{card.roomName}</p>
            {card.features.length > 0 && (
              <div className="nf-chat-card__features">
                {card.features.map((feature) => (
                  <span key={feature}>{feature}</span>
                ))}
              </div>
            )}
            <p className="nf-chat-card__price-row">
              <span className="nf-chat-card__price">{card.totalLabel}</span>
              <span className="nf-chat-card__chip">{card.nightsLabel}</span>
            </p>
          </div>
        </div>

        <div className="nf-chat-card__actions">
          <Link href={shareHref({ kind: "booking", id: card.id })} className="nf-btn nf-btn--primary nf-btn--sm">
            {w.viewBooking}
            <UiIcon name="chevron-right" size={16} />
          </Link>
          <Link href={`/messages/new?listing=${card.listingId}`} className="nf-btn nf-btn--glass nf-btn--sm">
            <UiIcon name="chat-bubble" size={16} />
            {w.contactHost}
          </Link>
        </div>
      </div>
    </article>
  );
}
