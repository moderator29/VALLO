import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { agentProfileFrom, getAgentContext } from "@/lib/agent/listings-queries";
import { readInspectionsForLister, readNoShowsFor } from "@/lib/inspections/queries";
import { InspectionHero, InspectionSheet } from "@/components/app/inspections/InspectionSheet";
import { InspectionsLive } from "@/components/app/inspections/InspectionsLive";
import { EmptyState, TYPE } from "@/components/app/Screen";
import { resolveSession } from "@/lib/actions/session";
import { readListingFacts } from "@/components/app/plans/inspection-facts";
import { readRentGateFor, readReportsFor } from "@/lib/inspections/report-queries";
import { reportStorageLive } from "@/lib/inspections/report-flag";
import { ButtonLink } from "@/components/ui/Button";
import { tagSide } from "@/components/app/inspections/grouping";
import { SUPPLY_DOOR_HREF } from "@/components/agent/agent-doors";
import { readMyListings } from "@/lib/agent/listings-queries";
import { readMyViewingWindows } from "@/lib/viewings/queries";
import { lagosDay, nextStop, routeFor } from "@/lib/viewings/route";
import { ViewingWindows } from "@/components/agent/ViewingWindows";
import { SaturdayRoute } from "@/components/agent/SaturdayRoute";
import { VisitCalendar, type CalendarRow } from "@/components/agent/visit-calendar/VisitCalendar";
import { readVisitModes } from "@/lib/visit-calendar/lister-queries";
import { formatDate } from "@vallo/i18n";

/** Lagos today, from the clock, once per request (V-94). */
function lagosToday(): { day: string; now: number } {
  const now = Date.now();
  return { day: lagosDay(now), now };
}

/**
 * The most rows `readInspectionsForLister` returns (`HOME_LIMIT` in
 * `lib/inspections/queries.ts`, open ones first). At the cap the page says it
 * is showing the most recent ones rather than implying it is the whole diary.
 */
const LIST_CAP = 20;

export const metadata: Metadata = {
  title: "Inspections",
  robots: { index: false, follow: false },
};

/**
 * EVERY VISIT SOMEBODY HAS ASKED YOU FOR, AS A CALENDAR (13 October 2026).
 *
 * The page used to be two lists (open, closed). It is now the lister's visit
 * calendar (`VisitCalendar`): Today, Next 7 days and Needs your answer at the
 * top, the requests waiting on this lister as rows, then a week strip or a
 * month grid with each day's visits listed (time, renter, listing, visit
 * mode, state), filtered by state. A tap opens the SAME inspection sheet the
 * lists drew, with confirm, propose a time, decline and the day kit; the
 * sheets are built here exactly as before and handed in by id.
 *
 * Beside the calendar (below it on a phone): the viewing windows a lister
 * sets to say when they can show, and the day's route (V-94).
 *
 * A visit sits on the Lagos day it is for: the agreed time, or the asked
 * time until one is agreed (`lib/visit-calendar/model.ts`).
 */
export default async function AgentInspectionsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const context = await getAgentContext();

  if (context.state !== "agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/inspections" profile={null}>
        <EmptyState
          icon="calendar-check"
          art="checklist"
          title="Inspections open once you are approved"
          body="Once your Listing or selling profile is approved, every request to inspect one of your properties arrives here with a state on it that the other side can see too."
          action={
            <ButtonLink href={SUPPLY_DOOR_HREF} variant="primary" size="lg">
              Set up this profile
            </ButtonLink>
          }
        />
      </AgentShell>
    );
  }

  const [list, session] = await Promise.all([readInspectionsForLister(), resolveSession()]);
  const userId = session.state === "signed-in" ? session.user.id : null;
  const sided = tagSide(list.inspections, "lister");
  const ids = list.inspections.map((one) => one.id);
  const [facts, reports, rentGate, noShows, modes] = await Promise.all([
    readListingFacts(
      list.inspections.map((one) => one.listingId),
      locale,
    ),
    readReportsFor(ids),
    readRentGateFor(ids),
    readNoShowsFor(list.inspections.filter((one) => one.state === "NO_SHOW").map((one) => one.id)),
    readVisitModes(ids),
  ]);
  const reportLive = reportStorageLive();

  /* V-94: the lister's viewing windows, and the first day from today with
     booked viewings drawn as a route (today when there are none). */
  const [windows, mine] = await Promise.all([
    readMyViewingWindows(),
    /* A failed read is null, never "no published homes". */
    readMyListings(context.supabase, context.agent.id).catch(() => null),
  ]);
  const homes = mine === null ? null : mine.filter((one) => one.status === "PUBLISHED").map((one) => ({ id: one.id, title: one.title }));
  const areaOf = new Map((mine ?? []).map((one) => [one.id, one.area]));
  const clock = lagosToday();
  const booked = list.inspections.filter(
    (one) => one.state === "CONFIRMED" && one.slotAt !== null && lagosDay(one.slotAt) >= clock.day,
  );
  const routeDay = booked.map((one) => lagosDay(one.slotAt!)).sort()[0] ?? clock.day;
  const route = routeFor(
    booked
      .filter((one) => lagosDay(one.slotAt!) === routeDay)
      .map((one) => ({
        inspectionId: one.id,
        listingId: one.listingId,
        listingTitle: one.listingTitle,
        area: areaOf.get(one.listingId) ?? null,
        slotAt: one.slotAt!,
        counterpartName: one.counterpartName,
        conversationId: one.conversationId,
      })),
  );
  const routeLabel = formatDate(new Date(`${routeDay}T12:00:00+01:00`), locale, {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Lagos",
  });

  /* The existing sheet, one per visit, opened on arrival because it is drawn
     inside the calendar's sheet only when that visit is tapped. The day kit
     and "I feel unsafe" are for whichever side of the viewing this is (B5,
     V-63), so the lister's console carries them as Plans does. */
  const sheets = Object.fromEntries(
    sided.map((one) => [
      one.id,
      <InspectionSheet
        viewingCopy={t.threads.rental}
        flowCopy={t.memberFlows.inspection}
        success={t.success}
        gateCopy={t.platform.gate}
        dayKit={t.memberKit.dayKit}
        unsafe={t.trustVisible.unsafe}
        key={one.id}
        inspection={one}
        side="lister"
        facts={facts.get(one.listingId) ?? null}
        report={reports.get(one.id) ?? null}
        reportLive={reportLive}
        needPhotos={rentGate.needPhotos}
        agreement={rentGate.agreements.get(one.id) ?? null}
        noShow={noShows.get(one.id) ?? null}
        locale={locale}
        open
      />,
    ]),
  );
  const rows: CalendarRow[] = list.inspections.map((one) => ({
    id: one.id,
    at: one.slotAt ?? one.requestedAt,
    asked: one.slotAt === null,
    state: one.state,
    mode: modes?.get(one.id) ?? null,
    listingTitle: one.listingTitle,
    personName: one.counterpartName,
  }));

  const c = t.visitOps.calendar;
  const aside = (
    <>
      <ViewingWindows windows={windows} homes={homes} copy={t.frontDoor.viewings} locale={locale} className="" />
      <SaturdayRoute
        dayLabel={routeLabel}
        route={route}
        next={routeDay === clock.day ? nextStop(route, clock.now) : null}
        copy={t.frontDoor.viewings}
        locale={locale}
        className=""
      />
    </>
  );

  /* The wallet's rule, applied here: an empty calendar and an unreadable one
     look identical and mean opposite things, so a failed read says so. */
  const notice = list.readFailed ? (
    <p className={`nf-vcal-card ${TYPE.body}`} role="status">
      {c.readFailed}
    </p>
  ) : list.inspections.length === 0 ? (
    <div className="nf-vcal-card">
      <EmptyState
        icon="calendar-check"
        art="checklist"
        title={c.noneTitle}
        body={c.noneBody}
        action={
          <ButtonLink href="/agent/listings" variant="primary" size="lg">
            {c.noneAction}
          </ButtonLink>
        }
      />
    </div>
  ) : null;

  return (
    <AgentShell
      t={t}
      locale={locale}
      active="/agent/inspections"
      profile={agentProfileFrom(context.agent)}
    >
      <div className="nf-console">
        {/* F6A8A482 as the lister sees it: the console shell draws the way
            back, so the hero here carries the title and the house only. */}
        <InspectionHero
          back={false}
          sub="Check the property, confirm details, submit your report."
        />
        <InspectionsLive userId={userId} />

        <VisitCalendar
          rows={rows}
          sheets={sheets}
          today={clock.day}
          copy={t.visitOps}
          locale={locale}
          aside={aside}
          notice={notice}
          footnote={
            list.inspections.length >= LIST_CAP
              ? c.shownCap.replace("{count}", String(list.inspections.length))
              : null
          }
        />
      </div>
    </AgentShell>
  );
}
