import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { requestNow } from "@/lib/format/when";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { getMyBusinesses, getMyHostDraft } from "@/lib/host/queries";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { HostShell } from "@/components/host/HostShell";
import { SuccessFromFlag } from "@/components/ui/SuccessFromFlag";
import { businessArrival } from "@/lib/ui/arrival-moments";
import { readHostRoomBookings } from "@/lib/host/room-bookings";
import { loadUnreadCounts } from "@/lib/messages/unread";
import { readHostTableBoard } from "./reservations/board";
import { hostToday } from "./today";
import { gateFirstRun } from "@/components/app/feature-onboarding/first-run-store";
import { DeskFigure } from "@/components/workspace/DeskFigure";
import { readHostBookingSeries } from "./booking-series";
import { HostStandingBody } from "./HostStandingBody";
import { readHotelDesk } from "@/lib/host/tape-chart-read";
import { readRestaurantExtras } from "@/components/host/dashboard/restaurant-reads";
import { buildRestaurantFigures } from "@/components/host/dashboard/restaurant-figures";
import { HotelDashboard } from "@/components/host/dashboard/HotelDashboard";
import { RestaurantSummary } from "@/components/host/dashboard/RestaurantSummary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceHost.home.metaTitle, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

export default async function HostPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const session = await resolveSession();

  if (session.state !== "signed-in") {
    const next = returnHref("/host", "", "list");
    return (
      <HostShell logoLabel={t.a11y.logoHome}>
        <EmptyState
          icon="hotel"
          title={t.hostWorkspace.home.signedOutTitle}
          body={t.hostWorkspace.home.signedOutBody}
          action={
            <ButtonLink href={authHref(next, "sign-in")} variant="primary" size="lg">
              {t.common.signIn}
            </ButtonLink>
          }
        />
      </HostShell>
    );
  }

  /* ONE WAVE OF READS, THE GATE DECIDED FROM THE BUSINESSES ALONE. All five
     reads start together, as they always did, so a returning host waits for
     one round trip, not two (auditor A7). The first run can redirect, and that
     is decided from the businesses read; a redirect simply discards the other
     four, which keep running and are never awaited (the catch below only stops
     an abandoned rejection from being reported; the await further down still
     sees any failure). */
  const figureNow = new Date(requestNow());
  const rest = Promise.all([
    getMyHostDraft(),
    readHostRoomBookings(),
    readHostTableBoard(),
    loadUnreadCounts(session.supabase).then((counts) => counts?.total ?? null, () => null),
    /* The figure card (reference 5): room bookings made at this host's places. */
    readHostBookingSeries(figureNow),
    /* The hotel's two weeks and the restaurant's week: each answers "none" or
       an empty read quickly for a host without that kind of business. */
    readHotelDesk(figureNow),
    readRestaurantExtras(figureNow),
  ]);
  rest.catch(() => {});
  const businesses = await getMyBusinesses();
  /* THE DESK'S FIRST RUN (north star 14.1, D11): once, for a member who
     hosts, so a first-time host meets what the figure at the top means. A
     guest who opens /host is not shown it and it is not marked seen for them
     (A3-S2). At most once per device until Session 2's record lands (W7-R1),
     never a block: the gate fails towards drawing the desk. */
  if (businesses.length > 0) await gateFirstRun("host", "/host", await searchParams);
  /* The workspace home's figures (plan item 14): the host's own rows. A read
     that fails comes back as null and its tile is left out. */
  const [draft, rooms, tables, unread, bookingRows, hotel, restaurantExtras] = await rest;
  const openDraft = draft.businessId ? draft : null;
  const today = hostToday({
    now: new Date(requestNow()),
    rooms: rooms.state === "ok" ? rooms : null,
    tables: tables.state === "ok" ? tables.board : null,
    unread,
    businesses: businesses.map((b) => ({ id: b.id, name: b.name, status: b.status })),
    /* The application in progress draws its own row under the dashboard,
       with its state and what is missing, so it is not listed twice. */
    draft: null,
  });
  /* A business approved or published in the staff console, whose notice
     lands here: once per device, while it is news (docs/SUCCESS_MOMENTS.md). */
  const approval = businessArrival(businesses, requestNow());

  /* The hospitality dashboards (track/hospitality-workspace). A hotel shows
     where a hotel, serviced apartment or guest house exists and its read
     answered; a restaurant where a restaurant business exists. A read that
     failed leaves its dashboard out rather than drawing zeros. */
  const hasRestaurant = businesses.some((b) => b.kind === "restaurant");
  const dashboard = (
    <>
      {hotel.state === "ok" ? <HotelDashboard read={hotel} locale={locale} variant="home" t={t} /> : null}
      {hasRestaurant && tables.state === "ok" ? (
        <RestaurantSummary
          figures={buildRestaurantFigures({
            board: tables.board,
            now: figureNow,
            week: restaurantExtras.week,
            noShowsMonth: restaurantExtras.noShowsMonth,
          })}
          words={t.hostDash.restaurant}
          locale={locale}
        />
      ) : null}
    </>
  );
  /* The room-bookings figure counts rooms; a restaurant-only host has none. */
  const showRoomFigure = businesses.length > 0 && (hotel.state === "ok" || !hasRestaurant);

  return (
    <HostShell logoLabel={t.a11y.logoHome} wide>
      <SuccessFromFlag
        copy={t.success}
        show={approval !== null}
        moment={approval?.moment ?? "hostApproved"}
        values={approval?.values}
        seenKey={approval?.seenKey ?? "host-approved:none"}
        haptic={false}
      />
      <HostStandingBody
        businesses={businesses}
        draft={openDraft}
        locale={locale}
        today={today}
        t={t}
        dashboard={hotel.state === "ok" || (hasRestaurant && tables.state === "ok") ? dashboard : null}
        figure={
          showRoomFigure ? (
            <DeskFigure rows={bookingRows} kind="bookings" t={t} locale={locale} now={figureNow} />
          ) : null
        }
      />
    </HostShell>
  );
}
