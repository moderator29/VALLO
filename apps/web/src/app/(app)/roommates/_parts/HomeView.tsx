import Link from "next/link";

import { RoommatesDashboard, RoommatesDirectory } from "./Dashboard";

import { PageFrame } from "@/components/app/PageFrame";
import { RoommatesFeed } from "@/components/roommates/RoommatesFeed";
import { ToolsSheet } from "@/components/roommates/ToolsSheet";
import { RoommatesFirstRun } from "@/components/roommates/RoommatesFirstRun";
import { RoommatesWelcome } from "@/components/roommates/Welcome";
import type { FeedFilters, FeedTab } from "@/lib/features/roommates/feed";
import type { FeedPage } from "@/lib/features/roommates/actions";
import {
  CardRail,
  HowItWorks,
  JourneyTiles,
  RoomCardView,
  RoommateCardView,
  RoommatesEmpty,
  SectionHead,
  StatTiles,
  TrustTiles,
  counted,
  type RoommatesCopy,
  fill,
  institutionKind,
  lagosDay,
} from "@/components/roommates";
import { PromoBanner } from "@/components/app/PromoBanner";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { FirstRunCard } from "@/components/roommates/FirstRunCard";
import { PeopleDeck } from "@/components/roommates/PeopleDeck";
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
export function RoommatesHomeView({ home, t: copy, now, feed }: { home: RoommatesHome; t: RoommatesCopy; now: number; feed?: { tab: FeedTab; filters: FeedFilters; initial: FeedPage | null } }) {
  const today = lagosDay(now);
  const postHref = home.signedIn ? ROOMMATES_ROUTES.create : signInTo(ROOMMATES_ROUTES.create);
  const greeting = home.signedIn && home.viewerName ? fill(copy.home.welcome, { name: home.viewerName.split(" ")[0] ?? home.viewerName }) : null;

  const hero = <RoommatesWelcome t={copy} createHref={postHref} exploreHref="#rmfd-title" counts={home.stats ? { people: home.stats.people, rooms: home.stats.rooms } : null} greeting={greeting} />;

  if (!home.live) {
    return (
      <PageFrame title={copy.title} fallback="/home" width="wide">
        <PullToRefresh>
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
        </PullToRefresh>
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
        <>
        <PeopleDeck people={home.recommended} />
        <CardRail testId="roommates-recommended">
          {home.recommended.map((p) => (
            <li key={p.userId}>
              <RoommateCardView card={p} t={copy} />
            </li>
          ))}
        </CardRail>
        </>
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
            <ButtonLink href={home.signedIn ? `${ROOMMATES_ROUTES.create}?kind=room_offer` : signInTo(`${ROOMMATES_ROUTES.create}?kind=room_offer`)} variant="primary" size="md" leadingIcon="door">
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

  const promo = (
    <PromoBanner
      key="promo"
      eyebrow={copy.ui.promo.eyebrow}
      title={copy.ui.promo.title}
      body={copy.ui.promo.body}
      cta={copy.ui.promo.cta}
      href={home.signedIn ? ROOMMATES_ROUTES.newGroup : signInTo(ROOMMATES_ROUTES.newGroup)}
      art="handover"
      testId="roommates-promo"
    />
  );
  /*
   * ONE ORDER, AND ONLY WHAT HAS SOMETHING IN IT (13 November 2026; the
   * founder: "don't just scatter the platform, upgrade and flow").
   *
   * The page had grown to seven screens of stacked sections: the four doors,
   * then a second grid of eight doors, then three shelves that were empty
   * boxes with a button each, then the same routes again. It now reads top
   * to bottom as one path: what do you want to do (the four doors, once),
   * what is here (the posts), what is waiting on you (the desk), then the
   * live shelves, then how it works and where else to go.
   *
   * A SHELF WITH NOTHING ON IT IS NOT DRAWN. Each empty shelf carried one
   * action, and every one of those actions is still on the page: "Create
   * your roommate profile" is the profile card and the desk's next step,
   * "Offer a room" is the third door, "Start a group" is the fourth door and
   * the promo. The posts list keeps its own empty state, so an empty
   * platform says so once, not five times.
   *
   * The counts are drawn when at least two of them are above zero; one
   * figure beside two zeros is a row of noughts, and the hero already
   * carries the live count.
   */
  const shelves = [
    home.recommended.length ? recommended : null,
    home.rooms.length ? rooms : null,
    home.together.length ? together : null,
  ];
  const figures = home.stats ? [home.stats.people, home.stats.rooms, home.stats.groups].filter((n) => n > 0).length : 0;
  const order = active
    ? [...shelves, promo, schools, nysc, how, figures >= 2 ? stats : null]
    : [how, ...shelves, promo, schools, nysc, figures >= 2 ? stats : null];

  return (
    <PageFrame title={copy.title} fallback="/home" width="wide">
      <PullToRefresh>
        <div className="nf-rmp" data-testid="roommates-home">
        {hero}
        <RoommatesFirstRun startHref="#rmfd-title" />
        {journeys}
        {feed ? (
          <>
            <RoommatesFeed initial={feed.initial} tab={feed.tab} filters={feed.filters} signedIn={home.signedIn} now={now} />
            {/* THE PLATFORM'S FLOATING ACTION BUTTON, not a round icon button that
                had to be told where to float. `.nf-btn--fab` (buttons.css, the
                recipe `components/ui/Fab.tsx` uses) is what gives it its width:
                without it the control is fixed with only an inline-end inset,
                so it shrank to the glyph and drew 24 by 50 instead of a 56px
                circle, measured in WebKit at 390. `.nf-rmfd__fab` keeps its
                placement and nothing else. */}
            <ButtonLink href={postHref} variant="primary" size="lg" iconOnly round leadingIcon="plus" aria-label={copy.welcome.create} className="nf-btn--fab nf-rmfd__fab" data-testid="roommates-fab" />
            <div className="nf-rmfd__head">
              <h2 className="nf-rmfd__title">{copy.feed.toolsTitle}</h2>
              <ToolsSheet />
            </div>
          </>
        ) : null}
        <RoommatesDashboard home={home} t={copy} />
        {home.myStatus === "none" ? (
          <FirstRunCard href={home.signedIn ? ROOMMATES_ROUTES.profile : signInTo(ROOMMATES_ROUTES.profile)} />
        ) : needsProfile ? (
          <CompleteCard home={home} t={copy} />
        ) : null}
        {order}
        <TrustTiles t={copy} />
        {/* Everything else in Vallo Roommates, as one compact list at the
            foot: every area keeps its way in (the safety guide and "add a
            check" among them), without a second grid of doors above the
            content. */}
        <RoommatesDirectory t={copy} />
        </div>
      </PullToRefresh>
    </PageFrame>
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
