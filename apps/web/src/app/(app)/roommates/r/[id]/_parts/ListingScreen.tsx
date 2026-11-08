import Link from "next/link";

import { PageFrame } from "@/components/app/PageFrame";
import { SafetyRows, SaveButton } from "@/components/roommates/Actions";
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
export function RoomListingScreen({ read, groups, t, now }: { read: ListingRead; groups: { id: string; name: string }[]; t: RoommatesCopy; now: number }) {
  if (read.state !== "ok") {
    return (
      <PageFrame title={t.title} fallback={ROOMMATES_ROUTES.rooms} width="narrow">
        {read.state === "not-open" ? (
          <RoommatesEmpty icon="info">{t.notOpen}</RoommatesEmpty>
        ) : (
          <RoommatesEmpty icon="bed" action={<ButtonLink href={ROOMMATES_ROUTES.rooms} variant="secondary" size="md">{t.home.roomsNear}</ButtonLink>}>
            {t.ui.listing.notFound}
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
          {l.isOwner ? null : <SaveButton kind="room" id={l.id} />}
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
            counter={t.ui.listing.photoCount}
            emptyLabel={t.ui.card.noPhoto}
            prevLabel={t.ui.listing.prevPhoto}
            nextLabel={t.ui.listing.nextPhoto}
          />
          <Summary l={l} t={t} />
          <FactsRow l={l} t={t} />
          <Poster l={l} t={t} />
          {l.description ? (
            <section className="nf-rm-section" aria-labelledby="rml-about">
              <SectionHead id="rml-about" title={t.ui.listing.about} />
              <p className="nf-rmv__intro">{l.description}</p>
            </section>
          ) : null}
          <Household l={l} t={t} today={today} />
          {l.amenities.length ? (
            <section className="nf-rm-section" aria-labelledby="rml-amen">
              <SectionHead id="rml-amen" title={t.listing.amenities} />
              <ul className="nf-rm-life">
                {l.amenities.map((a) => (
                  <li key={a} className="nf-rm-life__chip">
                    <span className="nf-rm-life__glyph" aria-hidden="true">
                      <UiIcon name={AMENITY_ICON[a]} size={16} />
                    </span>
                    <span className="nf-rm-life__value">{t.amenities[a]}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {l.houseRules.length ? (
            <section className="nf-rm-section" aria-labelledby="rml-rules">
              <SectionHead id="rml-rules" title={t.listing.houseRules} />
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
          <Trust l={l} t={t} />
          {l.linkedListing ? <Linked l={l} t={t} /> : null}
          {l.isOwner ? null : <SafetyRows targetType="roommate_listing" targetId={l.id} label={l.title} userId={l.owner.userId} name={l.owner.name.split(" ")[0] ?? l.owner.name} signedIn={read.signedIn} />}
        </div>
        <aside className="nf-rmv__side">
          <div className="nf-rm-panel nf-rmv__actcard">
            <PriceBlock l={l} t={t} />
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
          <CostBreakdown cost={l} t={t} />
        </aside>
      </div>
    </PageFrame>
  );
}

function Summary({ l, t }: { l: RoomDetail; t: RoommatesCopy }) {
  const where = placeText(l.area, l.city, stateName(l.stateCode));
  return (
    <section className="nf-rml-summary">
      <div className="nf-rml-summary__tags">
        <KindTag kind={l.kind} t={t} />
        {l.verified ? <VerifiedChip t={t} /> : null}
        {l.status !== "live" ? <span className="nf-rml-status">{t.listingStatus[l.status]}</span> : null}
      </div>
      {where ? (
        <p className="nf-rm-card__place nf-rml-summary__place">
          <UiIcon name="pin" size={16} />
          {where}
          {l.institution ? ` · ${l.institution.shortName ?? l.institution.name}` : null}
        </p>
      ) : null}
      <div className="nf-rml-summary__price">
        <PriceBlock l={l} t={t} inline />
      </div>
    </section>
  );
}

function PriceBlock({ l, t, inline = false }: { l: RoomDetail; t: RoommatesCopy; inline?: boolean }) {
  const price = l.shareMinor ?? l.rentMinor;
  if (price === null) return null;
  const hint = monthlyHint(price, l.rentPeriod, t);
  return (
    <div className="nf-rml-price" data-inline={inline || undefined}>
      <span className="nf-rml-price__n">
        <Money minor={price} locale="en" mode="full" period={l.rentPeriod} />
        <span className="nf-rml-price__per">{t.perPeriod[l.rentPeriod]}</span>
      </span>
      <span className="nf-rml-price__label">
        {l.shareMinor !== null ? (l.kind === "room_offer" ? t.listing.yourShare : t.ui.card.perPerson) : t.listing.rent}
        {hint ? ` · ${hint}` : null}
      </span>
    </div>
  );
}

function FactsRow({ l, t }: { l: RoomDetail; t: RoommatesCopy }) {
  const c = t.ui.card;
  const facts: { icon: UiIconName; text: string }[] = [];
  if (l.roomType) facts.push({ icon: "door", text: t.roomTypes[l.roomType] });
  if (l.bedrooms !== null) facts.push({ icon: "bed", text: counted(l.bedrooms, c.bedrooms) });
  if (l.bathrooms !== null) facts.push({ icon: "bath", text: counted(l.bathrooms, c.bathrooms) });
  if (l.furnished) facts.push({ icon: "house", text: t.furnished[l.furnished] });
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

function Poster({ l, t }: { l: RoomDetail; t: RoommatesCopy }) {
  return (
    <Link href={ROOMMATES_ROUTES.person(l.owner.userId)} className="nf-rml-poster" data-testid="listing-poster">
      <PersonFace person={l.owner} size="lg" />
      <span className="nf-rml-poster__words">
        <span className="nf-rml-poster__eyebrow">{t.listing.postedBy}</span>
        <span className="nf-rml-poster__name">{l.owner.name}</span>
        <BadgesRow badges={l.owner.badges} t={t} max={2} size="sm" />
      </span>
      <span className="nf-rml-poster__go">
        {t.ui.card.viewProfile}
        <UiIcon name="chevron-right" size={16} />
      </span>
    </Link>
  );
}

function Household({ l, t, today }: { l: RoomDetail; t: RoommatesCopy; today: string }) {
  const rows: { icon: UiIconName; label: string; value: string }[] = [];
  if (l.occupantsNow !== null && l.occupantsMax !== null) rows.push({ icon: "users", label: t.listing.household, value: fill(t.listing.occupants, { now: l.occupantsNow, max: l.occupantsMax }) });
  else if (l.occupantsNow !== null) rows.push({ icon: "users", label: t.listing.household, value: counted(l.occupantsNow, t.ui.card.occupants) });
  rows.push({ icon: "circle-people", label: t.discover.filterLabels.gender, value: t.genderPref[l.genderPref] });
  const free = availableText(l.availableFrom, t, today);
  if (free) rows.push({ icon: "calendar-check", label: t.listing.available, value: free });
  if (l.minStayMonths) rows.push({ icon: "hourglass", label: t.listing.minStay, value: counted(l.minStayMonths, t.ui.card.months) });
  if (l.expiresAt) rows.push({ icon: "clock", label: t.listingStatus.live, value: fill(t.listing.expires, { date: dayText(l.expiresAt) }) });
  return (
    <section className="nf-rm-section" aria-labelledby="rml-home">
      <SectionHead id="rml-home" title={t.ui.listing.facts} />
      <dl className="nf-rmv-facts">
        {rows.map((r) => (
          <div key={r.label} className="nf-rmv-fact">
            <span className="nf-rm-plate" aria-hidden="true">
              <UiIcon name={r.icon} size={20} />
            </span>
            <div className="nf-rmv-fact__words">
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Trust({ l, t }: { l: RoomDetail; t: RoommatesCopy }) {
  return (
    <section className="nf-rm-panel nf-rml-trust" aria-label={t.verification.title}>
      <p className="nf-rml-trust__line" data-ok={l.verified || undefined}>
        <UiIcon name={l.verified ? "shield-check" : "info"} size={18} />
        {l.verified ? t.listing.verified : t.listing.unverified}
      </p>
      {l.kind === "room_offer" && l.authority ? (
        <p className="nf-rml-trust__line">
          <UiIcon name="file-check" size={18} />
          {t.listing.authorityNote}
        </p>
      ) : null}
      <p className="nf-rm-note">
        <UiIcon name="info" size={16} />
        {t.verification.honest}
      </p>
    </section>
  );
}

function Linked({ l, t }: { l: RoomDetail; t: RoommatesCopy }) {
  const p = l.linkedListing!;
  return (
    <section className="nf-rm-section" aria-labelledby="rml-linked">
      <SectionHead id="rml-linked" title={t.listing.linked} />
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
          {t.listing.viewProperty}
          <UiIcon name="chevron-right" size={16} />
        </span>
      </Link>
    </section>
  );
}
