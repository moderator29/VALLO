import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { Icon3D, type Icon3DName } from "@/components/ui/Icon3D";
import { Odometer } from "@/components/ui/Odometer";
import { FEATURE_ART, type ArtSlot } from "@/lib/features/art";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { ROOMMATES_ROUTES, type Intent, type PersonRef } from "@/lib/features/roommates/model";

import { counted, type RoommatesCopy } from "./format";
import { FaceStack } from "./Marks";
import "./roommates-kit.css";

/**
 * VALLO ROOMMATES, THE HOME'S BIG PIECES. Server safe.
 *
 *   RoommatesHero  a night island in both themes (the brief's dark boards):
 *                  two of Vallo's own room photographs as art (never a
 *                  listing), real faces only when given, the tagline with its
 *                  last line in brand blue, and the two actions
 *   JourneyTiles   the four journeys in a 2 x 2 grid (reference 10)
 *   StatTiles      the LIVE counts as three smoked tiles (reference 1); null
 *                  draws nothing, a number is never invented
 *   TrustTiles     the three trust promises
 *   HowItWorks     three numbered steps on a connector line
 */

export function RoommatesHero({
  t: copy,
  findHref,
  postHref,
  faces = [],
  greeting,
  peopleCount = null,
}: {
  t: RoommatesCopy;
  findHref: string;
  postHref: string;
  /** Real members only (people on this page). None given, none drawn. */
  faces?: readonly Pick<PersonRef, "userId" | "name" | "avatarUrl">[];
  /** "Welcome back, Ada", when the page knows the name. */
  greeting?: string | null;
  /** The LIVE count of people looking (`home.stats.people`); null draws no figure. */
  peopleCount?: number | null;
}) {
  const lines = copy.tagline.split(". ").map((s, i, all) => (i < all.length - 1 ? `${s}.` : s));
  const last = lines.pop() ?? "";
  const art: ArtSlot = FEATURE_ART.roommatesHero;
  const showPeople = faces.length > 0 || (peopleCount !== null && peopleCount > 0);
  return (
    <section className="nf-rmh" data-theme="dark" data-fit={art.fit} aria-labelledby="rm-hero-title" data-testid="roommates-hero">
      <div className="nf-rmh__art" aria-hidden="true">
        <Image src={art.src} alt="" fill priority sizes="(max-width: 768px) 100vw, 1152px" style={art.focus ? { objectPosition: art.focus } : undefined} />
      </div>
      <span className="nf-rmh__scrim" aria-hidden="true" />
      <span className="nf-rmh__accent" aria-hidden="true">
        <span className="nf-rmh__accent-tile">
          <Icon3D name="team" size={64} classic />
        </span>
      </span>
      <div className="nf-rmh__words">
        <p className="nf-rmh__eyebrow" style={{ "--nf-rm-i": 0 } as CSSProperties}>
          {greeting ?? copy.ui.eyebrow}
        </p>
        <h2 id="rm-hero-title" className="nf-rmh__title" style={{ "--nf-rm-i": 1 } as CSSProperties}>
          {lines.map((l) => (
            <span key={l}>{l} </span>
          ))}
          <span className="nf-rmh__accentword">{last}</span>
        </h2>
        <p className="nf-rmh__line" style={{ "--nf-rm-i": 2 } as CSSProperties}>
          {copy.heroLine}
        </p>
        <div className="nf-rmh__actions" style={{ "--nf-rm-i": 3 } as CSSProperties}>
          <ButtonLink href={findHref} variant="primary" size="lg" leadingIcon="search" glow className="nf-rm-sheen" data-testid="roommates-find">
            {copy.ui.findRoommate}
          </ButtonLink>
          <ButtonLink href={postHref} variant="secondary" size="lg" leadingIcon="plus" data-testid="roommates-post">
            {copy.actions.create}
          </ButtonLink>
        </div>
        {showPeople ? (
          <p className="nf-rmh__people" style={{ "--nf-rm-i": 4 } as CSSProperties} data-testid="roommates-hero-people">
            {faces.length ? <FaceStack people={faces} max={4} size="sm" /> : null}
            {peopleCount !== null && peopleCount > 0 ? <span>{counted(peopleCount, copy.ui.peopleLooking)}</span> : null}
          </p>
        ) : null}
      </div>
    </section>
  );
}

const JOURNEY_ART: Record<Intent, Icon3DName> = {
  find_roommate: "team",
  find_room: "search",
  offer_room: "home-small",
  find_together: "map",
};

export const JOURNEY_HREF: Record<Intent, string> = {
  find_roommate: ROOMMATES_ROUTES.discover,
  find_room: ROOMMATES_ROUTES.rooms,
  offer_room: `${ROOMMATES_ROUTES.create}?kind=room_offer`,
  find_together: ROOMMATES_ROUTES.groups,
};

export function JourneyTiles({ t: copy, hrefs = JOURNEY_HREF }: { t: RoommatesCopy; hrefs?: Record<Intent, string> }) {
  const keys: Intent[] = ["find_roommate", "find_room", "offer_room", "find_together"];
  return (
    <ul className="nf-rm-journeys" data-testid="roommates-journeys">
      {keys.map((k, i) => (
        <li key={k} style={{ "--nf-rm-i": i } as CSSProperties}>
          <Link href={hrefs[k]} className="nf-rm-journey" data-testid={`journey-${k}`}>
            <span className="nf-rm-journey__art" aria-hidden="true">
              <Icon3D name={JOURNEY_ART[k]} size={56} classic />
            </span>
            <span className="nf-rm-journey__title">{copy.journeys[k].title}</span>
            <span className="nf-rm-journey__body">{copy.journeys[k].body}</span>
            <span className="nf-rm-journey__go" aria-hidden="true">
              <UiIcon name="arrow-up-right" size={16} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StatTiles({ stats, t: copy }: { stats: { people: number; rooms: number; groups: number } | null; t: RoommatesCopy }) {
  if (!stats) return null;
  const nf = new Intl.NumberFormat("en-NG", { notation: stats.people >= 10000 ? "compact" : "standard" });
  const tiles = [
    { key: "people", icon: "users", n: stats.people },
    { key: "rooms", icon: "bed", n: stats.rooms },
    { key: "groups", icon: "circle-people", n: stats.groups },
  ] as const;
  return (
    <section className="nf-rm-stats" aria-label={copy.ui.statsLabel} data-testid="roommates-stats">
      {tiles.map((tile, i) => (
        <div key={tile.key} className="nf-rm-stat" style={{ "--nf-rm-i": i } as CSSProperties}>
          <span className="nf-rm-stat__label">
            <UiIcon name={tile.icon} size={14} />
            {copy.ui.statTiles[tile.key]}
          </span>
          <span className="nf-rm-stat__n">
            <Odometer value={nf.format(tile.n)} from={nf.format(tile.n).replace(/\d/g, "0")} />
          </span>
        </div>
      ))}
    </section>
  );
}

const TRUST_ART: Icon3DName[] = ["envelope", "id-check", "passcode-lock"];

export function TrustTiles({ t: copy }: { t: RoommatesCopy }) {
  return (
    <section className="nf-rm-section" aria-labelledby="rm-trust">
      <SectionHead id="rm-trust" title={copy.home.trustTitle} />
      <ul className="nf-rm-trust">
        {copy.home.trust.map((item, i) => (
          <li key={item.title} className="nf-rm-trust__tile">
            <span className="nf-rm-trust__art" aria-hidden="true">
              <Icon3D name={TRUST_ART[i] ?? "shield"} size={44} classic />
            </span>
            <span className="nf-rm-trust__title">{item.title}</span>
            <span className="nf-rm-trust__body">{item.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HowItWorks({ t: copy }: { t: RoommatesCopy }) {
  return (
    <section className="nf-rm-section" aria-labelledby="rm-how">
      <SectionHead id="rm-how" title={copy.home.howTitle} />
      <ol className="nf-rm-how">
        {copy.home.how.map((step, i) => (
          <li key={step.title} className="nf-rm-how__step">
            <span className="nf-rm-how__n" aria-hidden="true">
              {i + 1}
            </span>
            <span className="nf-rm-how__title">{step.title}</span>
            <span className="nf-rm-how__body">{step.body}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ shared page parts */

export function SectionHead({ id, title, more, moreLabel, count }: { id?: string; title: string; more?: string; moreLabel?: string; count?: string }) {
  return (
    <div className="nf-rm-section__head">
      <h2 id={id} className="nf-rm-section__title">
        {title}
        {count ? <span className="nf-rm-section__count">{count}</span> : null}
      </h2>
      {more ? (
        <Link href={more} className="nf-rm-section__more">
          {moreLabel ?? "See all"}
          <UiIcon name="chevron-right" size={16} />
        </Link>
      ) : null}
    </div>
  );
}

/* Each empty state's 3D object, by the glyph it was asked for. */
const EMPTY_ART: Partial<Record<UiIconName, Icon3DName>> = {
  users: "team",
  bed: "home-small",
  info: "toolbox",
  "circle-people": "handover",
  "id-card": "id-check",
  lock: "passcode-lock",
  "user-pen": "checklist",
  door: "home-small",
};

/** An honest empty list: one of the founder's 3D objects, one true sentence, and the one next step. */
export function RoommatesEmpty({ children, icon = "users", action, testId }: { children: ReactNode; icon?: UiIconName; action?: ReactNode; testId?: string }) {
  const art = EMPTY_ART[icon];
  return (
    <div className="nf-rm-empty" data-testid={testId ?? "roommates-empty"}>
      {art ? (
        <span className="nf-rm-empty__art" aria-hidden="true">
          <Icon3D name={art} size={72} classic />
        </span>
      ) : (
        <span className="nf-rm-plate nf-rm-plate--lg" aria-hidden="true">
          <UiIcon name={icon} size={24} />
        </span>
      )}
      <p className="nf-rm-empty__words">{children}</p>
      {action ? <div className="nf-rm-empty__action">{action}</div> : null}
    </div>
  );
}

/** A grid of cards: one column on a phone, two or three as the width allows. */
export function CardGrid({ children, kind = "people", testId }: { children: ReactNode; kind?: "people" | "rooms"; testId?: string }) {
  return (
    <ul className="nf-rm-grid" data-kind={kind} data-testid={testId}>
      {children}
    </ul>
  );
}

/** A side-scrolling rail of cards on a phone, a grid on a wide screen. */
export function CardRail({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <ul className="nf-rm-rail" data-testid={testId}>
      {children}
    </ul>
  );
}
