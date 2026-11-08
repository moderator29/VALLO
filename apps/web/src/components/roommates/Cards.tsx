import Link from "next/link";
import type { ReactNode } from "react";

import { Money } from "@/components/ui/Money";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ROOMMATES_ROUTES, type RoomCard, type RoommateCard } from "@/lib/features/roommates/model";

import { AMENITY_ICON, availableText, budgetText, counted, fill, LOCALE, moveInText, placeText, type RoommatesCopy } from "./format";
import { BadgesRow, KindTag, LifestyleChips, MatchReasons, MatchRing, PersonFace, VerifiedChip } from "./Marks";
import { FreshOnly } from "./Kept";
import "./roommates-kit.css";

/**
 * VALLO ROOMMATES, THE TWO CARDS. Server safe; FE-B's pages (the hub, groups,
 * the feed card, the property page) draw the same ones.
 *
 *   RoommateCardView  a person: face and name first, what was checked, life
 *                     stage and school, where, budget, move-in, two or three
 *                     lifestyle chips, and the compatibility ring with its
 *                     top reasons (or the honest "add more" line)
 *   RoomCardView      a post: the photograph (or a calm tile, never a stand-in
 *                     photo), the kind, the verified chip only when checked,
 *                     the price per period (the share when given), the facts,
 *                     two amenities, who posted it and when it is free
 *
 * The whole card is one link (a stretched title link), so an `action` (a
 * save heart, a vote) can sit above it as its own control.
 */

export function RoommateCardView({
  card,
  t: copy,
  href,
  action,
  testId,
}: {
  card: RoommateCard;
  t: RoommatesCopy;
  /** Defaults to the profile page. */
  href?: string;
  /** A control of its own (a save, an invite), drawn above the card's link. */
  action?: ReactNode;
  testId?: string;
}) {
  const where = placeText(card.areas[0], card.city);
  const budget = budgetText(card.budget, copy);
  const stage = card.lifeStage ? copy.lifeStages[card.lifeStage] : null;
  const school = card.institution ? (card.institution.shortName ?? card.institution.name) : null;
  const score = card.match?.score ?? null;
  return (
    <article className="nf-rm-card nf-rm-pcard" data-testid={testId ?? "roommate-card"}>
      <div className="nf-rm-pcard__top">
        <PersonFace person={card} size="lg" />
        <div className="nf-rm-pcard__who">
          <h3 className="nf-rm-card__title">
            <Link href={href ?? ROOMMATES_ROUTES.person(card.userId)} className="nf-rm-card__link">
              {card.name}
            </Link>
            {card.badges.includes("identity") ? (
              <span className="nf-rm-card__tick" role="img" aria-label={copy.verification.kinds.identity}>
                <UiIcon name="verified" size={16} filled />
              </span>
            ) : null}
          </h3>
          {stage || school ? <p className="nf-rm-card__sub">{[stage, school].filter(Boolean).join(" · ")}</p> : null}
        </div>
        {card.match ? (
          <MatchRing score={score} size="sm" label={score === null ? copy.match.thin : fill(copy.match.percent, { n: Math.round(score) })} />
        ) : null}
      </div>

      {card.intro ? <p className="nf-rm-card__body">{card.intro}</p> : null}

      <ul className="nf-rm-facts">
        {where ? (
          <li>
            <UiIcon name="pin" size={16} />
            {where}
          </li>
        ) : null}
        {budget ? (
          <li>
            <UiIcon name="wallet" size={16} />
            {budget}
          </li>
        ) : null}
        <li>
          <UiIcon name="calendar-check" size={16} />
          {moveInText(card.moveInOn, card.moveInFlex, copy)}
        </li>
      </ul>

      <LifestyleChips lifestyle={card.lifestyle} t={copy} max={3} />

      {card.match ? (
        card.match.score === null ? (
          <p className="nf-rm-card__thin">{copy.match.thin}</p>
        ) : (
          <MatchReasons match={card.match} t={copy} max={2} />
        )
      ) : null}

      {card.badges.length || action ? (
        <div className="nf-rm-card__foot">
          <BadgesRow badges={card.badges} t={copy} max={2} size="sm" />
          {action ? <div className="nf-rm-card__action">{action}</div> : null}
        </div>
      ) : null}
    </article>
  );
}

export function RoomCardView({
  room,
  t: copy,
  href,
  action,
  today,
  linked = true,
  testId,
}: {
  room: RoomCard;
  t: RoommatesCopy;
  href?: string;
  action?: ReactNode;
  /** Today as "YYYY-MM-DD" (the server's clock), so "Available now" is true. */
  today?: string;
  /** False draws the card with no link (the review step of the post flow). */
  linked?: boolean;
  testId?: string;
}) {
  const c = copy.ui.card;
  const cover = room.photoUrls[0] ?? null;
  const priceMinor = room.shareMinor ?? room.rentMinor;
  const priceLabel = room.kind === "room_offer" ? (room.shareMinor !== null ? c.shareLabel : null) : room.shareMinor !== null ? c.perPerson : null;
  const where = placeText(room.area, room.city);
  const facts: { icon: "bed" | "bath" | "users" | "door"; text: string }[] = [];
  if (room.roomType) facts.push({ icon: "door", text: copy.roomTypes[room.roomType] });
  if (room.bedrooms !== null) facts.push({ icon: "bed", text: counted(room.bedrooms, c.bedrooms) });
  if (room.bathrooms !== null) facts.push({ icon: "bath", text: counted(room.bathrooms, c.bathrooms) });
  if (room.occupantsNow !== null) facts.push({ icon: "users", text: counted(room.occupantsNow, c.occupants) });
  const eyebrow = [room.furnished ? copy.furnished[room.furnished] : null, room.roomsAvailable ? counted(room.roomsAvailable, c.roomsFree) : null].filter(Boolean).join(" · ");
  const free = availableText(room.availableFrom, copy, today);
  const title = linked ? (
    <Link href={href ?? ROOMMATES_ROUTES.listing(room.id)} className="nf-rm-card__link">
      {room.title}
    </Link>
  ) : (
    room.title
  );
  return (
    <article className="nf-rm-card nf-rm-rcard" data-testid={testId ?? "room-card"}>
      <div className="nf-rm-rcard__media">
        {cover ? (
          <RemoteImage src={cover} alt="" width={640} height={480} sizes="(max-width: 640px) 92vw, 360px" loading="lazy" />
        ) : (
          <span className="nf-rm-rcard__blank" aria-hidden="true">
            <UiIcon name="bed" size={32} />
            <span>{c.noPhoto}</span>
          </span>
        )}
        <span className="nf-rm-rcard__tags">
          <KindTag kind={room.kind} t={copy} onMedia />
          {room.verified ? <VerifiedChip t={copy} onMedia /> : null}
        </span>
        {room.photoUrls.length > 1 ? (
          <span className="nf-rm-rcard__count">
            <UiIcon name="picture" size={14} />
            {room.photoUrls.length}
          </span>
        ) : null}
        {action ? <span className="nf-rm-rcard__action">{action}</span> : null}
      </div>

      <div className="nf-rm-rcard__body">
        {eyebrow ? <p className="nf-rm-eyebrow">{eyebrow}</p> : null}
        <h3 className="nf-rm-card__title nf-rm-card__title--clamp">{title}</h3>
        {where ? (
          <p className="nf-rm-card__place">
            <UiIcon name="pin" size={16} />
            {where}
          </p>
        ) : null}

        <div className="nf-rm-rcard__price">
          {priceMinor !== null ? (
            <span className="nf-rm-price">
              <Money minor={priceMinor} locale={LOCALE} mode="glance" period={room.rentPeriod} suffix={copy.perPeriod[room.rentPeriod]} />
            </span>
          ) : null}
          {priceLabel ? <span className="nf-rm-price__label">{priceLabel}</span> : null}
          {room.match?.score !== null && room.match?.score !== undefined ? (
            <span className="nf-rm-rcard__match">{fill(c.matchFor, { n: Math.round(room.match.score) })}</span>
          ) : null}
        </div>

        {facts.length ? (
          <ul className="nf-rm-facts nf-rm-facts--row">
            {facts.slice(0, 3).map((f) => (
              <li key={f.text}>
                <UiIcon name={f.icon} size={16} />
                {f.text}
              </li>
            ))}
          </ul>
        ) : null}

        {room.amenities.length ? (
          <ul className="nf-rm-amen">
            {room.amenities.slice(0, 2).map((a) => (
              <li key={a}>
                <UiIcon name={AMENITY_ICON[a]} size={14} />
                {copy.amenities[a]}
              </li>
            ))}
            {room.amenities.length > 2 ? <li>{`+${room.amenities.length - 2}`}</li> : null}
          </ul>
        ) : null}

        <div className="nf-rm-rcard__poster">
          <PersonFace person={room.owner} size="sm" />
          <span className="nf-rm-rcard__poster-name">{room.owner.name}</span>
          {free ? (
            <FreshOnly>
              <span className="nf-rm-rcard__free">{free}</span>
            </FreshOnly>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ skeletons */

export function RoommateCardSkeleton() {
  return (
    <div className="nf-rm-card nf-rm-pcard" aria-hidden="true">
      <div className="nf-rm-pcard__top">
        <Skeleton circle width={56} height={56} />
        <div className="nf-rm-pcard__who">
          <Skeleton height="1.1rem" width="60%" radius="sm" />
          <Skeleton height="0.85rem" width="40%" radius="sm" />
        </div>
      </div>
      <Skeleton height="0.85rem" width="90%" radius="sm" />
      <Skeleton height="0.85rem" width="70%" radius="sm" />
      <Skeleton height="2rem" width="80%" radius="md" />
    </div>
  );
}

export function RoomCardSkeleton() {
  return (
    <div className="nf-rm-card nf-rm-rcard" aria-hidden="true">
      <Skeleton height="12rem" radius="none" />
      <div className="nf-rm-rcard__body">
        <Skeleton height="1.1rem" width="75%" radius="sm" />
        <Skeleton height="0.85rem" width="50%" radius="sm" />
        <Skeleton height="1.5rem" width="35%" radius="sm" />
      </div>
    </div>
  );
}
