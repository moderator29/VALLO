import Link from "next/link";

import { PageFrame } from "@/components/app/PageFrame";
import {
  CardRail,
  HowItWorks,
  JourneyTiles,
  RoomCardView,
  RoommateCardView,
  RoommatesEmpty,
  RoommatesHero,
  SectionHead,
  StatTiles,
  TrustTiles,
  counted,
  type RoommatesCopy,
  fill,
  institutionKind,
  lagosDay,
} from "@/components/roommates";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import type { RoommatesHome } from "@/lib/features/roommates/queries";

const signInTo = (next: string) => `/sign-in?next=${encodeURIComponent(next)}`;

/**
 * VALLO ROOMMATES HOME, THE SCREEN (server safe; the page loads, this draws). The hero, then an order that fits the reader: a
 * member with a live profile sees the people who match first; somebody new
 * sees the four journeys and how it works first. Every list and count is a
 * real read; an empty one says so with its next step, and a server without
 * the SQL says that once, plainly.
 */
export function RoommatesHomeView({ home, t: copy, now }: { home: RoommatesHome; t: RoommatesCopy; now: number }) {
  const today = lagosDay(now);
  const postHref = home.signedIn ? ROOMMATES_ROUTES.create : signInTo(ROOMMATES_ROUTES.create);
  const faces = home.recommended.filter((p) => p.avatarUrl).slice(0, 3);
  const greeting = home.signedIn && home.viewerName ? fill(copy.home.welcome, { name: home.viewerName.split(" ")[0] ?? home.viewerName }) : null;

  const hero = <RoommatesHero t={copy} findHref={ROOMMATES_ROUTES.discover} postHref={postHref} faces={faces} greeting={greeting} />;

  if (!home.live) {
    return (
      <PageFrame title={copy.title} fallback="/home" width="wide">
        <div className="nf-rmp" data-testid="roommates-home">
          {hero}
          <RoommatesEmpty icon="info" testId="roommates-not-open">
            {copy.notOpen}
          </RoommatesEmpty>
          <section className="nf-rm-section" aria-labelledby="rm-journeys">
            <SectionHead id="rm-journeys" title={copy.ui.journeysTitle} />
            <JourneyTiles t={copy} />
          </section>
          <HowItWorks t={copy} />
          <TrustTiles t={copy} />
          <SafetyStrip t={copy} />
        </div>
      </PageFrame>
    );
  }

  const active = home.signedIn && home.myStatus === "active";
  const needsProfile = home.myStatus === "none" || home.myStatus === "draft";

  const journeys = (
    <section className="nf-rm-section" aria-labelledby="rm-journeys" key="journeys">
      <SectionHead id="rm-journeys" title={copy.ui.journeysTitle} />
      <JourneyTiles t={copy} />
    </section>
  );
  const recommended = (
    <section className="nf-rm-section" aria-labelledby="rm-recommended" key="recommended">
      <SectionHead id="rm-recommended" title={copy.home.recommended} more={home.recommended.length ? ROOMMATES_ROUTES.discover : undefined} moreLabel={copy.home.seeAll} />
      {home.recommended.length ? (
        <CardRail testId="roommates-recommended">
          {home.recommended.map((p) => (
            <li key={p.userId}>
              <RoommateCardView card={p} t={copy} />
            </li>
          ))}
        </CardRail>
      ) : (
        <RoommatesEmpty
          icon="users"
          action={
            needsProfile ? (
              <ButtonLink href={home.signedIn ? ROOMMATES_ROUTES.profile : signInTo(ROOMMATES_ROUTES.profile)} variant="primary" size="md">
                {copy.profile.create}
              </ButtonLink>
            ) : null
          }
        >
          {needsProfile ? copy.discover.needProfile : copy.ui.emptyRecommended}
        </RoommatesEmpty>
      )}
    </section>
  );
  const rooms = (
    <section className="nf-rm-section" aria-labelledby="rm-rooms" key="rooms">
      <SectionHead id="rm-rooms" title={copy.home.roomsNear} more={home.rooms.length ? ROOMMATES_ROUTES.rooms : undefined} moreLabel={copy.home.seeAll} />
      {home.rooms.length ? (
        <CardRail testId="roommates-rooms">
          {home.rooms.map((r) => (
            <li key={r.id}>
              <RoomCardView room={r} t={copy} today={today} />
            </li>
          ))}
        </CardRail>
      ) : (
        <RoommatesEmpty
          icon="bed"
          action={
            <ButtonLink href={home.signedIn ? `${ROOMMATES_ROUTES.create}?kind=room_offer` : signInTo(`${ROOMMATES_ROUTES.create}?kind=room_offer`)} variant="primary" size="md" leadingIcon="key">
              {copy.ui.offerRoom}
            </ButtonLink>
          }
        >
          {copy.ui.emptyRooms}
        </RoommatesEmpty>
      )}
    </section>
  );
  const together = (
    <section className="nf-rm-section" aria-labelledby="rm-together" key="together">
      <SectionHead id="rm-together" title={copy.home.together} more={home.together.length ? `${ROOMMATES_ROUTES.discover}?mode=rooms&kind=together` : undefined} moreLabel={copy.home.seeAll} />
      {home.together.length ? (
        <CardRail testId="roommates-together">
          {home.together.map((r) => (
            <li key={r.id}>
              <RoomCardView room={r} t={copy} today={today} />
            </li>
          ))}
        </CardRail>
      ) : (
        <RoommatesEmpty
          icon="circle-people"
          action={
            <ButtonLink href={home.signedIn ? ROOMMATES_ROUTES.newGroup : signInTo(ROOMMATES_ROUTES.newGroup)} variant="secondary" size="md" leadingIcon="plus">
              {copy.ui.startGroup}
            </ButtonLink>
          }
        >
          {copy.ui.emptyTogether}
        </RoommatesEmpty>
      )}
    </section>
  );
  const schools = <Schools home={home} t={copy} key="schools" />;
  const nysc = <NyscStrip t={copy} key="nysc" />;
  const how = <HowItWorks t={copy} key="how" />;
  const stats = <StatTiles stats={home.stats} t={copy} key="stats" />;

  const order = active ? [stats, recommended, rooms, together, journeys, schools, nysc, how] : [journeys, stats, how, rooms, recommended, together, schools, nysc];

  return (
    <PageFrame title={copy.title} fallback="/home" width="wide">
      <div className="nf-rmp" data-testid="roommates-home">
        {hero}
        <Pending home={home} t={copy} />
        {needsProfile ? <CompleteCard home={home} t={copy} /> : null}
        {order}
        <TrustTiles t={copy} />
        <SafetyStrip t={copy} />
      </div>
    </PageFrame>
  );
}

function Pending({ home, t: copy }: { home: RoommatesHome; t: RoommatesCopy }) {
  const p = home.pending;
  const lines = [
    p.requests ? counted(p.requests, copy.ui.pending.requests) : null,
    p.invites ? counted(p.invites, copy.ui.pending.invites) : null,
    p.viewings ? counted(p.viewings, copy.ui.pending.viewings) : null,
  ].filter((x): x is string => Boolean(x));
  if (!home.signedIn || !lines.length) return null;
  return (
    <Link href={ROOMMATES_ROUTES.hub} className="nf-rmp-pending" data-testid="roommates-pending">
      <span className="nf-rm-plate" aria-hidden="true">
        <UiIcon name="bell" size={20} />
      </span>
      <span className="nf-rmp-pending__words">
        <span className="nf-rmp-pending__title">{copy.ui.openHub}</span>
        <span className="nf-rmp-pending__line">{lines.join(" · ")}</span>
      </span>
      <UiIcon name="chevron-right" size={20} />
    </Link>
  );
}

function CompleteCard({ home, t: copy }: { home: RoommatesHome; t: RoommatesCopy }) {
  const pct = home.myStatus === "none" ? 0 : Math.max(0, Math.min(100, Math.round(home.completeness)));
  const href = home.signedIn ? ROOMMATES_ROUTES.profile : signInTo(ROOMMATES_ROUTES.profile);
  return (
    <section className="nf-rm-panel nf-rmp-complete" aria-labelledby="rm-complete" data-testid="roommates-complete">
      <div className="nf-rmp-complete__head">
        <span className="nf-rm-plate nf-rm-plate--lg" aria-hidden="true">
          <UiIcon name="user-pen" size={24} />
        </span>
        <div className="nf-rmp-complete__words">
          <h2 id="rm-complete" className="nf-rm-panel__title">
            {copy.home.completeTitle}
          </h2>
          <p className="nf-rm-panel__sub">{copy.home.completeBody}</p>
        </div>
      </div>
      <div className="nf-rmp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={fill(copy.ui.completeness, { n: pct })}>
        <span className="nf-rmp-progress__fill" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <div className="nf-rmp-complete__foot">
        <span className="nf-rmp-complete__pct">{fill(copy.ui.completeness, { n: pct })}</span>
        <ButtonLink href={href} variant="primary" size="md" arrow data-testid="roommates-complete-cta">
          {home.myStatus === "none" ? copy.profile.create : copy.ui.continueProfile}
        </ButtonLink>
      </div>
    </section>
  );
}

function Schools({ home, t: copy }: { home: RoommatesHome; t: RoommatesCopy }) {
  return (
    <section className="nf-rm-section" aria-labelledby="rm-schools">
      <SectionHead id="rm-schools" title={copy.home.campuses} more={ROOMMATES_ROUTES.campuses} moreLabel={copy.home.seeAll} />
      {home.institutions.length ? (
        <ul className="nf-rmp-schools" data-testid="roommates-schools">
          {home.institutions.slice(0, 8).map((s) => (
            <li key={s.id}>
              <Link href={ROOMMATES_ROUTES.campus(s.slug)} className="nf-rmp-school">
                <span className="nf-rm-plate" aria-hidden="true">
                  <UiIcon name="id-card" size={20} />
                </span>
                <span className="nf-rmp-school__words">
                  <span className="nf-rmp-school__name">{s.shortName ?? s.name}</span>
                  <span className="nf-rmp-school__meta">
                    {[institutionKind(s.kind, copy), s.city, s.people ? counted(s.people, copy.ui.campus.people) : null, s.rooms ? counted(s.rooms, copy.ui.campus.rooms) : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <UiIcon name="chevron-right" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <RoommatesEmpty icon="id-card" action={<ButtonLink href={ROOMMATES_ROUTES.campuses} variant="secondary" size="md">{copy.ui.campusCta}</ButtonLink>}>
          {copy.ui.emptyCampuses}
        </RoommatesEmpty>
      )}
    </section>
  );
}

function NyscStrip({ t: copy }: { t: RoommatesCopy }) {
  return (
    <section className="nf-rm-panel nf-rmp-strip" aria-labelledby="rm-nysc" data-testid="roommates-nysc">
      <span className="nf-rm-plate nf-rm-plate--lg" aria-hidden="true">
        <UiIcon name="certificate" size={24} />
      </span>
      <div className="nf-rmp-strip__words">
        <h2 id="rm-nysc" className="nf-rm-panel__title">
          {copy.home.nysc}
        </h2>
        <p className="nf-rm-panel__sub">{copy.home.nyscBody}</p>
      </div>
      <ButtonLink href={ROOMMATES_ROUTES.nysc} variant="secondary" size="md" arrow>
        {copy.ui.nyscCta}
      </ButtonLink>
    </section>
  );
}

function SafetyStrip({ t: copy }: { t: RoommatesCopy }) {
  return (
    <Link href={ROOMMATES_ROUTES.safety} className="nf-rmp-safety" data-testid="roommates-safety-link">
      <span className="nf-rm-plate" aria-hidden="true">
        <UiIcon name="shield-check" size={20} />
      </span>
      <span className="nf-rmp-pending__words">
        <span className="nf-rmp-pending__title">{copy.ui.safetyTitle}</span>
        <span className="nf-rmp-pending__line">{copy.ui.safetyLine}</span>
      </span>
      <span className="nf-rmp-safety__go">
        {copy.ui.safetyLink}
        <UiIcon name="chevron-right" size={16} />
      </span>
    </Link>
  );
}
