import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { getMyBusinesses, getPrimaryAccommodation } from "@/lib/host/queries";
import { readRateCalendar } from "@/lib/host/rate-calendar-queries";
import { CALENDAR_HORIZON_MONTHS, addMonths, lagosToday, openingMonth, parseMonth } from "@/lib/host/rate-calendar";
import { siteUrl } from "@/lib/site";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { EmptyState } from "@/components/app/Screen";
import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { HostShell } from "@/components/host/HostShell";
import { RateCalendar } from "@/components/host/calendar/RateCalendar";
import "../host-desk.css";
import { HostInnerNav } from "@/components/host/HostInnerNav";
import { hostInnerNavCopy } from "@/components/host/host-inner-nav";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceHost.calendar.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * /host/calendar: RATES AND NIGHTS ON ONE CALENDAR (C1), and calendar sync
 * with the other sites a host sells on (C2).
 *
 * The month grid writes the host's inputs to the two tables the database
 * already prices from (`rate_calendar`, `room_inventory`) and to the rate
 * plan itself. It never prices a stay and never touches a booking: see
 * `lib/host/calendar-actions.ts`.
 */
export default async function HostCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const session = await resolveSession();
  const words = getDictionary(locale).experienceHost.calendar;
  const params = await searchParams;
  const one = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  if (session.state !== "signed-in") {
    return (
      <HostShell fallback="/host">
        <EmptyState
          icon="calendar-grid"
          title={words.signedOutTitle}
          body={words.signedOutBody}
          action={
            <ButtonLink href={authHref(returnHref("/host/calendar", "", "list"), "sign-in")} variant="primary" size="lg">
              {getDictionary(locale).common.signIn}
            </ButtonLink>
          }
        />
      </HostShell>
    );
  }

  const today = lagosToday();
  const thisMonth = today.slice(0, 7);
  const maxMonth = addMonths(thisMonth, CALENDAR_HORIZON_MONTHS);
  const asked = parseMonth(one("month"));
  const month = asked && asked >= thisMonth && asked <= maxMonth ? asked : openingMonth(today);

  const businesses = (await getMyBusinesses()).filter((row) => row.kind !== "restaurant");
  const chosen = businesses.find((row) => row.id === one("business")) ?? businesses[0] ?? null;
  const accommodation = chosen ? await getPrimaryAccommodation(chosen.id) : null;

  if (!chosen || !accommodation) {
    const hw = getDictionary(locale).hostWorkspace;
    return (
      <HostShell fallback="/host">
        <EmptyState
          icon="calendar-grid"
          title={chosen ? hw.calendar.saveFirstTitle : hw.calendar.noPropertyTitle}
          body={hw.calendar.emptyBody}
          action={
            <ButtonLink href="/host/apply" variant="primary" size="lg">
              {chosen ? hw.doors.openApplication : hw.doors.startApplication}
            </ButtonLink>
          }
        />
      </HostShell>
    );
  }

  const read = await readRateCalendar(accommodation.id, { from: month, to: month });

  return (
    /* The frame's header carries the one way back (Grade 1 page frame); the
       bar keeps the host's destinations. */
    <HostShell fallback="/host" wide chromeBack={false} nav>
      <HostInnerNav active="calendar" {...hostInnerNavCopy(getDictionary(locale))} />
      <PageFrame
        title={words.title}
        subtitle={accommodation.name}
        fallback="/host"
        width="wide"
        tabs={
          businesses.length > 1 ? (
            <nav className="nf-rcal__places" aria-label={words.propertiesLabel}>
              {businesses.map((business) => (
                <Link
                  key={business.id}
                  href={`/host/calendar?business=${business.id}&month=${month}`}
                  className={`nf-chip${business.id === chosen.id ? " nf-chip--active" : ""}`}
                  aria-current={business.id === chosen.id ? "page" : undefined}
                >
                  {business.name}
                </Link>
              ))}
            </nav>
          ) : undefined
        }
      >
      <div>

      {read.state === "unavailable" || read.state === "signed-out" ? (
        <p className="nf-body mt-block" role="alert">
          {words.unavailable}
        </p>
      ) : read.rooms.length === 0 ? (
        <EmptyState
          icon="hotel-bed"
          title={words.noRoomTypesTitle}
          body={words.noRoomTypesBody}
          action={
            <ButtonLink href="/host/apply" variant="primary" size="lg">
              {words.addRoomType}
            </ButtonLink>
          }
        />
      ) : (
        <RateCalendar
          key={month}
          accommodationName={accommodation.name}
          businessId={chosen.id}
          rooms={read.rooms}
          rates={[...read.rows.rates.entries()]}
          inventory={[...read.rows.inventory.entries()]}
          imported={[...read.rows.imported.entries()]}
          held={[...(read.rows.held?.entries() ?? [])]}
          month={month}
          today={today}
          initialRoomId={one("room") ?? null}
          maxMonth={maxMonth}
          sync={read.sync}
          feedBase={siteUrl()}
          locale={locale}
          clearSelectionLabel={getDictionary(locale).experienceUi.clearSelection}
        />
      )}
      </div>
      </PageFrame>
    </HostShell>
  );
}
