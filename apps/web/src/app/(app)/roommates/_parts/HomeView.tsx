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
export function RoommatesHomeView({ home, t, now }: { home: RoommatesHome; t: RoommatesCopy; now: number }) {
  const today = lagosDay(now);
  const postHref = home.signedIn ? ROOMMATES_ROUTES.create : signInTo(ROOMMATES_ROUTES.create);
  const faces = home.recommended.filter((p) => p.avatarUrl).slice(0, 3);
  const greeting = home.signedIn && home.viewerName ? fill(t.home.welcome, { name: home.viewerName.split(" ")[0] ?? home.viewerName }) : null;

  const hero = <RoommatesHero t={t} findHref={ROOMMATES_ROUTES.discover} postHref={postHref} faces={faces} greeting={greeting} />;

  if (!home.live) {
    return (
      <PageFrame title={t.title} subtitle={t.tagline} fallback="/home" width="wide">
        <div className="nf-rmp" data-testid="roommates-home">
          {hero}
          <RoommatesEmpty icon="info" testId="roommates-not-open">
            {t.notOpen}
          </RoommatesEmpty>
          <section className="nf-rm-section" aria-labelledby="rm-journeys">
            <SectionHead id="rm-journeys" title={t.ui.journeysTitle} />
            <JourneyTiles t={t} />
          </section>
          <HowItWorks t={t} />
          <TrustTiles t={t} />
          <SafetyStrip t={t} />
        </div>
      </PageFrame>
    );
  }

  const active = home.signedIn && home.myStatus === "active";
  const needsProfile = home.myStatus === "none" || home.myStatus === "draft";

  const journeys = (
    <section className="nf-rm-section" aria-labelledby="rm-journeys" key="journeys">
      <SectionHead id="rm-journeys" title={t.ui.journeysTitle} />
      <JourneyTiles t={t} />
    </section>
  );
  const recommended = (
    <section className="nf-rm-section" aria-labelledby="rm-recommended" key="recommended">
      <SectionHead id="rm-recommended" title={t.home.recommended} more={home.recommended.length ? ROOMMATES_ROUTES.discover : undefined} moreLabel={t.home.seeAll} />
      {home.recommended.length ? (
        <CardRail testId="roommates-recommended">
          {home.recommended.map((p) => (
            <li key={p.userId}>
              <RoommateCardView card={p} t={t} />
            </li>
          ))}
        </CardRail>
      ) : (
        <RoommatesEmpty
          icon="users"
          action={
            needsProfile ? (
              <ButtonLink href={home.signedIn ? ROOMMATES_ROUTES.profile : signInTo(ROOMMATES_ROUTES.profile)} variant="primary" size="md">
                {t.profile.create}
              </ButtonLink>
            ) : null
          }
        >
          {needsProfile ? t.discover.needProfile : t.ui.emptyRecommended}
        </RoommatesEmpty>
      )}
    </section>
  );
  const rooms = (
    <section className="nf-rm-section" aria-labelledby="rm-rooms" key="rooms">
      <SectionHead id="rm-rooms" title={t.home.roomsNear} more={home.rooms.length ? ROOMMATES_ROUTES.rooms : undefined} moreLabel={t.home.seeAll} />
      {home.rooms.length ? (
        <CardRail testId="roommates-rooms">
          {home.rooms.map((r) => (
            <li key={r.id}>
              <RoomCardView room={r} t={t} today={today} />
            </li>
          ))}
        </CardRail>
      ) : (
        <RoommatesEmpty
          icon="bed"
          action={
            <ButtonLink href={home.signedIn ? `${ROOMMATES_ROUTES.create}?kind=room_offer` : signInTo(`${ROOMMATES_ROUTES.create}?kind=room_offer`)} variant="primary" size="md" leadingIcon="key">
              {t.ui.offerRoom}
            </ButtonLink>
          }
        >
          {t.ui.emptyRooms}
        </RoommatesEmpty>
      )}
    </section>
  );
  const together = (
    <section className="nf-rm-section" aria-labelledby="rm-together" key="together">
      <SectionHead id="rm-together" title={t.home.together} more={home.together.length ? `${ROOMMATES_ROUTES.discover}?mode=rooms&kind=together` : undefined} moreLabel={t.home.seeAll} />
      {home.together.length ? (
        <CardRail testId="roommates-together">
          {home.together.map((r) => (
            <li key={r.id}>
              <RoomCardView room={r} t={t} today={today} />
            </li>
          ))}
        </CardRail>
      ) : (
        <RoommatesEmpty
          icon="circle-people"
          action={
            <ButtonLink href={home.signedIn ? ROOMMATES_ROUTES.newGroup : signInTo(ROOMMATES_ROUTES.newGroup)} variant="secondary" size="md" leadingIcon="plus">
              {t.ui.startGroup}
            </ButtonLink>
          }
        >
          {t.ui.emptyTogether}
        </RoommatesEmpty>
      )}
    </section>
  );
  const schools = <Schools home={home} t={t} key="schools" />;
  const nysc = <NyscStrip t={t} key="nysc" />;
  const how = <HowItWorks t={t} key="how" />;
  const stats = <StatTiles stats={home.stats} t={t} key="stats" />;

  const order = active ? [stats, recommended, rooms, together, journeys, schools, nysc, how] : [journeys, stats, how, rooms, recommended, together, schools, nysc];

  return (
    <PageFrame title={t.title} subtitle={t.tagline} fallback="/home" width="wide">
      <div className="nf-rmp" data-testid="roommates-home">
        {hero}
        <Pending home={home} t={t} />
        {needsProfile ? <CompleteCard home={home} t={t} /> : null}
        {order}
        <TrustTiles t={t} />
        <SafetyStrip t={t} />
      </div>
    </PageFrame>
  );
}

function Pending({ home, t }: { home: RoommatesHome; t: RoommatesCopy }) {
  const p = home.pending;
  const lines = [
    p.requests ? counted(p.requests, t.ui.pending.requests) : null,
    p.invites ? counted(p.invites, t.ui.pending.invites) : null,
    p.viewings ? counted(p.viewings, t.ui.pending.viewings) : null,
  ].filter((x): x is string => Boolean(x));
  if (!home.signedIn || !lines.length) return null;
  return (
    <Link href={ROOMMATES_ROUTES.hub} className="nf-rmp-pending" data-testid="roommates-pending">
      <span className="nf-rm-plate" aria-hidden="true">
        <UiIcon name="bell" size={20} />
      </span>
      <span className="nf-rmp-pending__words">
        <span className="nf-rmp-pending__title">{t.ui.openHub}</span>
        <span className="nf-rmp-pending__line">{lines.join(" · ")}</span>
      </span>
      <UiIcon name="chevron-right" size={20} />
    </Link>
  );
}

function CompleteCard({ home, t }: { home: RoommatesHome; t: RoommatesCopy }) {
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
            {t.home.completeTitle}
          </h2>
          <p className="nf-rm-panel__sub">{t.home.completeBody}</p>
        </div>
      </div>
      <div className="nf-rmp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={fill(t.ui.completeness, { n: pct })}>
        <span className="nf-rmp-progress__fill" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <div className="nf-rmp-complete__foot">
        <span className="nf-rmp-complete__pct">{fill(t.ui.completeness, { n: pct })}</span>
        <ButtonLink href={href} variant="primary" size="md" arrow data-testid="roommates-complete-cta">
          {home.myStatus === "none" ? t.profile.create : t.ui.continueProfile}
        </ButtonLink>
      </div>
    </section>
  );
}

function Schools({ home, t }: { home: RoommatesHome; t: RoommatesCopy }) {
  return (
    <section className="nf-rm-section" aria-labelledby="rm-schools">
      <SectionHead id="rm-schools" title={t.home.campuses} more={ROOMMATES_ROUTES.campuses} moreLabel={t.home.seeAll} />
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
                    {[institutionKind(s.kind, t), s.city, s.people ? counted(s.people, t.ui.campus.people) : null, s.rooms ? counted(s.rooms, t.ui.campus.rooms) : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <UiIcon name="chevron-right" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <RoommatesEmpty icon="id-card" action={<ButtonLink href={ROOMMATES_ROUTES.campuses} variant="secondary" size="md">{t.ui.campusCta}</ButtonLink>}>
          {t.ui.emptyCampuses}
        </RoommatesEmpty>
      )}
    </section>
  );
}

function NyscStrip({ t }: { t: RoommatesCopy }) {
  return (
    <section className="nf-rm-panel nf-rmp-strip" aria-labelledby="rm-nysc" data-testid="roommates-nysc">
      <span className="nf-rm-plate nf-rm-plate--lg" aria-hidden="true">
        <UiIcon name="certificate" size={24} />
      </span>
      <div className="nf-rmp-strip__words">
        <h2 id="rm-nysc" className="nf-rm-panel__title">
          {t.home.nysc}
        </h2>
        <p className="nf-rm-panel__sub">{t.home.nyscBody}</p>
      </div>
      <ButtonLink href={ROOMMATES_ROUTES.nysc} variant="secondary" size="md" arrow>
        {t.ui.nyscCta}
      </ButtonLink>
    </section>
  );
}

function SafetyStrip({ t }: { t: RoommatesCopy }) {
  return (
    <Link href={ROOMMATES_ROUTES.safety} className="nf-rmp-safety" data-testid="roommates-safety-link">
      <span className="nf-rm-plate" aria-hidden="true">
        <UiIcon name="shield-check" size={20} />
      </span>
      <span className="nf-rmp-pending__words">
        <span className="nf-rmp-pending__title">{t.ui.safetyTitle}</span>
        <span className="nf-rmp-pending__line">{t.ui.safetyLine}</span>
      </span>
      <span className="nf-rmp-safety__go">
        {t.ui.safetyLink}
        <UiIcon name="chevron-right" size={16} />
      </span>
    </Link>
  );
}
