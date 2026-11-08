import Link from "next/link";

import { PageFrame } from "@/components/app/PageFrame";
import { KeptPriceNote } from "@/components/app/offline/KeptPriceNote";
import { SafetyRows, SaveButton } from "@/components/roommates/Actions";
import { FreshOnly } from "@/components/roommates/Kept";
import {
  AMENITY_ICON,
  BadgesRow,
  CostBreakdown,
  KindTag,
  PersonFace,
  RoommatesEmpty,
  SectionHead,
  VerifiedChip,
  availableText,
  counted,
  dayText,
  fill,
  lagosDay,
  monthlyHint,
  placeText,
  stateName,
  type RoommatesCopy,
} from "@/components/roommates";
import { ButtonLink } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { ROOMMATES_ROUTES, type RoomDetail } from "@/lib/features/roommates/model";
import type { ListingRead } from "@/lib/features/roommates/queries";

import { Gallery } from "./Gallery";
import { ListingActions, ListingShareMenu, RecordView } from "./ListingActions";

/**
 * A ROOM POST, THE SCREEN (server safe): the gallery with its counter, the
 * kind, title, place and the big price per period (the share when given),
 * the facts, who posted it, the cost to move in, the household, what is
 * included, the rules, the dates, what Vallo checked, and the linked Vallo
 * property. The actions and the costs sit in the side column on a wide
 * screen, under the facts on a phone.
 */
export function RoomListingScreen({ read, groups, t: copy, now }: { read: ListingRead; groups: { id: string; name: string }[]; t: RoommatesCopy; now: number }) {
  if (read.state !== "ok") {
    return (
      <PageFrame title={copy.title} fallback={ROOMMATES_ROUTES.rooms} width="narrow">
        {read.state === "not-open" ? (
          <RoommatesEmpty icon="info">{copy.notOpen}</RoommatesEmpty>
        ) : (
          <RoommatesEmpty icon="bed" action={<ButtonLink href={ROOMMATES_ROUTES.rooms} variant="secondary" size="md">{copy.home.roomsNear}</ButtonLink>}>
            {copy.ui.listing.notFound}
          </RoommatesEmpty>
        )}
      </PageFrame>
    );
  }
  const l = read.listing;
  const today = lagosDay(now);
  return (
    <PageFrame
      title={l.title}
      fallback={ROOMMATES_ROUTES.rooms}
      width="wide"
      actions={
        <span className="nf-rmv-headacts">
          {l.isOwner ? null : <SaveButton kind="room" id={l.id} signedIn={read.signedIn} />}
          <ListingShareMenu id={l.id} title={l.title} signedIn={read.signedIn} />
        </span>
      }
    >
      <RecordView id={l.id} />
      <div className="nf-rmv" data-testid="room-listing">
        <div className="nf-rmv__main">
          <Gallery
            urls={l.photoUrls}
            title={l.title}
            counter={copy.ui.listing.photoCount}
            emptyLabel={copy.ui.card.noPhoto}
            prevLabel={copy.ui.listing.prevPhoto}
            nextLabel={copy.ui.listing.nextPhoto}
          />
          <Summary l={l} t={copy} />
          <FactsRow l={l} t={copy} />
          <Poster l={l} t={copy} />
          {l.description ? (
            <section className="nf-rm-section" aria-labelledby="rml-about">
              <SectionHead id="rml-about" title={copy.ui.listing.about} />
              <p className="nf-rmv__intro">{l.description}</p>
            </section>
          ) : null}
          <Household l={l} t={copy} today={today} />
          {l.amenities.length ? (
            <section className="nf-rm-section" aria-labelledby="rml-amen">
              <SectionHead id="rml-amen" title={copy.listing.amenities} />
              <ul className="nf-rm-life">
                {l.amenities.map((a) => (
                  <li key={a} className="nf-rm-life__chip">
                    <span className="nf-rm-life__glyph" aria-hidden="true">
                      <UiIcon name={AMENITY_ICON[a]} size={16} />
                    </span>
                    <span className="nf-rm-life__value">{copy.amenities[a]}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {l.houseRules.length ? (
            <section className="nf-rm-section" aria-labelledby="rml-rules">
              <SectionHead id="rml-rules" title={copy.listing.houseRules} />
              <ul className="nf-rml-rules">
                {l.houseRules.map((r) => (
                  <li key={r}>
                    <UiIcon name="check" size={16} />
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <Trust l={l} t={copy} />
          {l.linkedListing ? <Linked l={l} t={copy} /> : null}
          {l.isOwner ? null : <SafetyRows targetType="roommate_listing" targetId={l.id} label={l.title} userId={l.owner.userId} name={l.owner.name.split(" ")[0] ?? l.owner.name} signedIn={read.signedIn} />}
        </div>
        <aside className="nf-rmv__side">
          <div className="nf-rm-panel nf-rmv__actcard">
            <PriceBlock l={l} t={copy} />
            <ListingActions
              id={l.id}
              title={l.title}
              status={l.status}
              isOwner={l.isOwner}
              signedIn={read.signedIn}
              owner={{ userId: l.owner.userId, name: l.owner.name }}
              connection={l.connection}
              myViewing={l.myViewing}
              groups={groups}
              viewCount={l.viewCount}
              interestCount={l.interestCount}
            />
          </div>
          <CostBreakdown cost={l} t={copy} />
        </aside>
      </div>
    </PageFrame>
  );
}

function Summary({ l, t: copy }: { l: RoomDetail; t: RoommatesCopy }) {
  const where = placeText(l.area, l.city, stateName(l.stateCode));
  return (
    <section className="nf-rml-summary">
      <div className="nf-rml-summary__tags">
        <KindTag kind={l.kind} t={copy} />
        {l.verified ? <VerifiedChip t={copy} /> : null}
        {l.status !== "live" ? <span className="nf-rml-status">{copy.listingStatus[l.status]}</span> : null}
      </div>
      {where ? (
        <p className="nf-rm-card__place nf-rml-summary__place">
          <UiIcon name="pin" size={16} />
          {where}
          {l.institution ? ` · ${l.institution.shortName ?? l.institution.name}` : null}
        </p>
      ) : null}
      <div className="nf-rml-summary__price">
        <PriceBlock l={l} t={copy} inline />
      </div>
    </section>
  );
}

function PriceBlock({ l, t: copy, inline = false }: { l: RoomDetail; t: RoommatesCopy; inline?: boolean }) {
  const price = l.shareMinor ?? l.rentMinor;
  if (price === null) return null;
  const hint = monthlyHint(price, l.rentPeriod, copy);
  return (
    <div className="nf-rml-price" data-inline={inline || undefined}>
      <span className="nf-rml-price__n">
        <Money minor={price} locale="en" mode="full" period={l.rentPeriod} />
        <span className="nf-rml-price__per">{copy.perPeriod[l.rentPeriod]}</span>
      </span>
      <span className="nf-rml-price__label">
        {l.shareMinor !== null ? (l.kind === "room_offer" ? copy.listing.yourShare : copy.ui.card.perPerson) : copy.listing.rent}
        {hint ? ` · ${hint}` : null}
      </span>
      <KeptPriceNote />
    </div>
  );
}

function FactsRow({ l, t: copy }: { l: RoomDetail; t: RoommatesCopy }) {
  const c = copy.ui.card;
  const facts: { icon: UiIconName; text: string }[] = [];
  if (l.roomType) facts.push({ icon: "door", text: copy.roomTypes[l.roomType] });
  if (l.bedrooms !== null) facts.push({ icon: "bed", text: counted(l.bedrooms, c.bedrooms) });
  if (l.bathrooms !== null) facts.push({ icon: "bath", text: counted(l.bathrooms, c.bathrooms) });
  if (l.furnished) facts.push({ icon: "house", text: copy.furnished[l.furnished] });
  if (l.roomsAvailable) facts.push({ icon: "key", text: counted(l.roomsAvailable, c.roomsFree) });
  if (!facts.length) return null;
  return (
    <ul className="nf-rml-facts">
      {facts.map((f) => (
        <li key={f.text}>
          <span className="nf-rm-plate" aria-hidden="true">
            <UiIcon name={f.icon} size={20} />
          </span>
          <span>{f.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Poster({ l, t: copy }: { l: RoomDetail; t: RoommatesCopy }) {
  return (
    <Link href={ROOMMATES_ROUTES.person(l.owner.userId)} className="nf-rml-poster" data-testid="listing-poster">
      <PersonFace person={l.owner} size="lg" />
      <span className="nf-rml-poster__words">
        <span className="nf-rml-poster__eyebrow">{copy.listing.postedBy}</span>
        <span className="nf-rml-poster__name">{l.owner.name}</span>
        <BadgesRow badges={l.owner.badges} t={copy} max={2} size="sm" />
      </span>
      <span className="nf-rml-poster__go">
        {copy.ui.card.viewProfile}
        <UiIcon name="chevron-right" size={16} />
      </span>
    </Link>
  );
}

function Household({ l, t: copy, today }: { l: RoomDetail; t: RoommatesCopy; today: string }) {
  const rows: { icon: UiIconName; label: string; value: string; fresh?: boolean }[] = [];
  if (l.occupantsNow !== null && l.occupantsMax !== null) rows.push({ icon: "users", label: copy.listing.household, value: fill(copy.listing.occupants, { now: l.occupantsNow, max: l.occupantsMax }) });
  else if (l.occupantsNow !== null) rows.push({ icon: "users", label: copy.listing.household, value: counted(l.occupantsNow, copy.ui.card.occupants) });
  rows.push({ icon: "circle-people", label: copy.discover.filterLabels.gender, value: copy.genderPref[l.genderPref] });
  const free = availableText(l.availableFrom, copy, today);
  if (free) rows.push({ icon: "calendar-check", label: copy.listing.available, value: free, fresh: true });
  if (l.minStayMonths) rows.push({ icon: "hourglass", label: copy.listing.minStay, value: counted(l.minStayMonths, copy.ui.card.months) });
  if (l.expiresAt) rows.push({ icon: "clock", label: copy.listingStatus.live, value: fill(copy.listing.expires, { date: dayText(l.expiresAt) }) });
  return (
    <section className="nf-rm-section" aria-labelledby="rml-home">
      <SectionHead id="rml-home" title={copy.ui.listing.facts} />
      <dl className="nf-rmv-facts">
        {rows.map((r) => {
          const fact = (
            <div key={r.label} className="nf-rmv-fact">
              <span className="nf-rm-plate" aria-hidden="true">
                <UiIcon name={r.icon} size={20} />
              </span>
              <div className="nf-rmv-fact__words">
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            </div>
          );
          return r.fresh ? <FreshOnly key={r.label}>{fact}</FreshOnly> : fact;
        })}
      </dl>
    </section>
  );
}

function Trust({ l, t: copy }: { l: RoomDetail; t: RoommatesCopy }) {
  return (
    <section className="nf-rm-panel nf-rml-trust" aria-label={copy.verification.title}>
      <p className="nf-rml-trust__line" data-ok={l.verified || undefined}>
        <UiIcon name={l.verified ? "shield-check" : "info"} size={18} />
        {l.verified ? copy.listing.verified : copy.listing.unverified}
      </p>
      {l.kind === "room_offer" && l.authority ? (
        <p className="nf-rml-trust__line">
          <UiIcon name="file-check" size={18} />
          {copy.listing.authorityNote}
        </p>
      ) : null}
      <p className="nf-rm-note">
        <UiIcon name="info" size={16} />
        {copy.verification.honest}
      </p>
    </section>
  );
}

function Linked({ l, t: copy }: { l: RoomDetail; t: RoommatesCopy }) {
  const p = l.linkedListing!;
  return (
    <section className="nf-rm-section" aria-labelledby="rml-linked">
      <SectionHead id="rml-linked" title={copy.listing.linked} />
      <Link href={`/listing/${p.id}`} className="nf-rml-linked" data-testid="listing-linked">
        <span className="nf-rml-linked__photo">
          {p.photoUrl ? <RemoteImage src={p.photoUrl} alt="" width={240} height={180} sizes="120px" loading="lazy" /> : <UiIcon name="building-apartment" size={28} />}
        </span>
        <span className="nf-rml-linked__words">
          <span className="nf-rml-linked__title">{p.title}</span>
          {placeText(p.area, p.city) ? <span className="nf-rml-linked__sub">{placeText(p.area, p.city)}</span> : null}
          {p.priceLabel ? <span className="nf-rml-linked__price">{p.priceLabel}</span> : null}
        </span>
        <span className="nf-rml-poster__go">
          {copy.listing.viewProperty}
          <UiIcon name="chevron-right" size={16} />
        </span>
      </Link>
    </section>
  );
}
