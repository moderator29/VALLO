import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { ROOMMATES_ROUTES, type Intent, type PersonRef } from "@/lib/features/roommates/model";

import { type RoommatesCopy } from "./format";
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
}: {
  t: RoommatesCopy;
  findHref: string;
  postHref: string;
  /** Real members only (people on this page). None given, none drawn. */
  faces?: readonly Pick<PersonRef, "userId" | "name" | "avatarUrl">[];
  /** "Welcome back, Ada", when the page knows the name. */
  greeting?: string | null;
}) {
  const lines = copy.tagline.split(". ").map((s, i, all) => (i < all.length - 1 ? `${s}.` : s));
  const last = lines.pop() ?? "";
  return (
    <section className="nf-rm-hero" data-theme="dark" aria-labelledby="rm-hero-title" data-testid="roommates-hero">
      <span className="nf-rm-hero__bloom" aria-hidden="true" />
      <div className="nf-rm-hero__words">
        <p className="nf-rm-hero__eyebrow">
          <UiIcon name="circle-people" size={16} />
          {greeting ?? copy.ui.eyebrow}
        </p>
        <h2 id="rm-hero-title" className="nf-rm-hero__title">
          {lines.map((l) => (
            <span key={l}>{l} </span>
          ))}
          <span className="nf-rm-hero__accent">{last}</span>
        </h2>
        <p className="nf-rm-hero__line">{copy.heroLine}</p>
        <div className="nf-rm-hero__actions">
          <ButtonLink href={findHref} variant="primary" size="lg" leadingIcon="search" data-testid="roommates-find">
            {copy.ui.findRoommate}
          </ButtonLink>
          <ButtonLink href={postHref} variant="secondary" size="lg" leadingIcon="plus" data-testid="roommates-post">
            {copy.actions.create}
          </ButtonLink>
        </div>
      </div>
      <div className="nf-rm-hero__art" aria-hidden="true">
        <span className="nf-rm-hero__photo nf-rm-hero__photo--back">
          <Image src="/brand/photos/living-room-day.webp" alt="" fill sizes="(max-width: 640px) 50vw, 260px" />
        </span>
        <span className="nf-rm-hero__photo nf-rm-hero__photo--front">
          <Image src="/brand/photos/bedroom-01.webp" alt="" fill sizes="(max-width: 640px) 60vw, 300px" />
        </span>
        {faces.length ? (
          <span className="nf-rm-hero__faces">
            <FaceStack people={faces} max={3} size="md" />
          </span>
        ) : null}
        <span className="nf-rm-hero__mark">
          <UiIcon name="key" size={24} />
        </span>
      </div>
    </section>
  );
}

const JOURNEY_ICON: Record<Intent, UiIconName> = {
  find_roommate: "users",
  find_room: "bed",
  offer_room: "key",
  find_together: "circle-people",
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
            <span className="nf-rm-journey__glyph" aria-hidden="true">
              <UiIcon name={JOURNEY_ICON[k]} size={22} />
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
          <span className="nf-rm-stat__n">{nf.format(tile.n)}</span>
        </div>
      ))}
    </section>
  );
}

const TRUST_ICON: UiIconName[] = ["user-check", "shield-check", "lock"];

export function TrustTiles({ t: copy }: { t: RoommatesCopy }) {
  return (
    <section className="nf-rm-section" aria-labelledby="rm-trust">
      <SectionHead id="rm-trust" title={copy.home.trustTitle} />
      <ul className="nf-rm-trust">
        {copy.home.trust.map((item, i) => (
          <li key={item.title} className="nf-rm-trust__tile">
            <span className="nf-rm-plate" aria-hidden="true">
              <UiIcon name={TRUST_ICON[i] ?? "shield-check"} size={20} />
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

/** An honest empty list: a quiet glyph, one true sentence, and the one next step. */
export function RoommatesEmpty({ children, icon = "users", action, testId }: { children: ReactNode; icon?: UiIconName; action?: ReactNode; testId?: string }) {
  return (
    <div className="nf-rm-empty" data-testid={testId ?? "roommates-empty"}>
      <span className="nf-rm-plate nf-rm-plate--lg" aria-hidden="true">
        <UiIcon name={icon} size={24} />
      </span>
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
