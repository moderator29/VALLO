import type { ReactNode } from "react";

import { PageFrame } from "@/components/app/PageFrame";
import { CardGrid, RoomCardView, RoommateCardView, RoommatesEmpty, lagosDay, type RoommatesCopy } from "@/components/roommates";
import { ButtonLink } from "@/components/ui/Button";
import { ROOMMATES_ROUTES, type InstitutionRef, type PeopleFilters, type RoomCard, type RoomFilters, type RoommateCard } from "@/lib/features/roommates/model";

import { DiscoverControls, ModeSwitch, SaveSearchButton } from "./DiscoverControls";
import { discoverHref } from "./href";

/** At most this many pages are read for one address (`?more=`). */
export const MAX_PAGES = 10;

export type DiscoverResult =
  | { mode: "people"; state: "not-open" | "signed-out" | "need-profile" | "ok"; items: RoommateCard[]; next: number | null }
  | { mode: "rooms"; state: "not-open" | "ok"; items: RoomCard[]; next: number | null };

/**
 * DISCOVER, THE SCREEN (server safe): People | Rooms, the search bar, the
 * filter chips and sheet, then the cards and "Show more". Every state is its
 * own honest card: not open, signed out (sign in and come back here), no
 * profile yet (make one, or look at rooms), nothing matches (save the search).
 */
export function DiscoverView({
  t,
  result,
  people,
  rooms,
  schools,
  pages,
  now,
}: {
  t: RoommatesCopy;
  result: DiscoverResult;
  people: PeopleFilters;
  rooms: RoomFilters;
  schools: InstitutionRef[];
  /** How many pages are drawn (the address's `more`, 1 by default). */
  pages: number;
  now: number;
}) {
  const mode = result.mode;
  const today = lagosDay(now);
  const filters = mode === "people" ? people : rooms;
  const here = discoverHref(mode, filters);
  const signIn = `/sign-in?next=${encodeURIComponent(here)}`;
  const moreHref = `${here}${here.includes("?") ? "&" : "?"}more=${pages + 1}`;
  const more = result.state === "ok" && result.next !== null && pages < MAX_PAGES ? <More href={moreHref} label={t.ui.discover.loadMore} /> : null;

  let body: ReactNode;
  if (result.state === "not-open") {
    body = (
      <RoommatesEmpty icon="info" testId="discover-not-open">
        {t.notOpen}
      </RoommatesEmpty>
    );
  } else if (result.state === "signed-out") {
    body = (
      <RoommatesEmpty icon="lock" testId="discover-signed-out" action={<ButtonLink href={signIn} variant="primary" size="md">{t.ui.signInCta}</ButtonLink>}>
        {t.ui.discover.signedOut}
      </RoommatesEmpty>
    );
  } else if (result.state === "need-profile") {
    body = (
      <RoommatesEmpty
        icon="user-pen"
        testId="discover-need-profile"
        action={
          <>
            <ButtonLink href={ROOMMATES_ROUTES.profile} variant="primary" size="md">
              {t.ui.discover.needProfileCta}
            </ButtonLink>
            <ButtonLink href={ROOMMATES_ROUTES.rooms} variant="secondary" size="md">
              {t.ui.discover.tryRooms}
            </ButtonLink>
          </>
        }
      >
        {t.discover.needProfile}
      </RoommatesEmpty>
    );
  } else if (result.mode === "people") {
    body = result.items.length ? (
      <>
        <CardGrid testId="discover-people">
          {result.items.map((p) => (
            <li key={p.userId}>
              <RoommateCardView card={p} t={t} />
            </li>
          ))}
        </CardGrid>
        {more}
      </>
    ) : (
      <RoommatesEmpty icon="users" testId="discover-empty" action={<SaveSearchButton mode="people" filters={people} variant="primary" />}>
        {t.discover.empty}
      </RoommatesEmpty>
    );
  } else {
    body = result.items.length ? (
      <>
        <CardGrid kind="rooms" testId="discover-rooms">
          {result.items.map((r) => (
            <li key={r.id}>
              <RoomCardView room={r} t={t} today={today} />
            </li>
          ))}
        </CardGrid>
        {more}
      </>
    ) : (
      <RoommatesEmpty icon="bed" testId="discover-empty" action={<SaveSearchButton mode="rooms" filters={rooms} variant="primary" />}>
        {t.discover.emptyRooms}
      </RoommatesEmpty>
    );
  }

  return (
    <PageFrame title={t.ui.discover.title} subtitle={t.ui.discover.subtitle} fallback={ROOMMATES_ROUTES.home} width="wide" tabs={<ModeSwitch mode={mode} />}>
      <div className="nf-rmp" data-testid="roommates-discover">
        <DiscoverControls mode={mode} people={people} rooms={rooms} schools={schools} canSave={result.state === "ok"} />
        {body}
      </div>
    </PageFrame>
  );
}

function More({ href, label }: { href: string; label: string }) {
  return (
    <div className="nf-rmp-more">
      <ButtonLink href={href} variant="secondary" size="md" scroll={false} data-testid="discover-more">
        {label}
      </ButtonLink>
    </div>
  );
}
