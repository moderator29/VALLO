import { formatMoneyGlance, type Dictionary, type Locale } from "@vallo/i18n/core";
import type { Featured } from "@/lib/workspace/dashboard-agent";
import {
  agentMonthly,
  recentContacts,
  type ContactThread,
  type EnquiryRow,
  type OwnerView,
  type Reminder,
  type Visit,
  enquiriesInLastDays,
  upcomingVisits,
  visitCountsByDay,
} from "@/lib/workspace/dashboard-model";
import { CalendarCard, ContactsCard, FeaturedCard, PerformanceCard, RemindersCard } from "./AgentCards";
import { LeaseTodayCard, PaymentDueCard, PropertyCard, RentMonthCard, RentTrendCard, UpcomingCard } from "./OwnerCards";
import { StatBand, StatTile } from "./StatBand";
import { UnitsDonut } from "./UnitsDonut";

type Common = { t: Dictionary; locale: Locale };

/* ----------------------------------------------------------------- owner */

/** The owner's four tiles. A tile whose read failed is left out, never drawn as zero. */
export function OwnerBand({ view, t, locale, tag }: Common & { view: OwnerView; tag: string }) {
  const b = t.workspaceDash.owner.band;
  return (
    <StatBand label={t.workspaceDash.owner.upcoming.title}>
      {view.paidThisMonthMinor !== null ? (
        <StatTile label={b.paid} icon="banknote" text={formatMoneyGlance(view.paidThisMonthMinor, locale)} sub={b.paidSub} href="/agent/earnings" tag={tag} />
      ) : null}
      {view.renewals !== null ? (
        <StatTile label={b.renewals} icon="calendar-clock" count={view.renewals.length} sub={b.renewalsSub} href="/agent/portfolio" tag={tag} />
      ) : null}
      {view.visitsWeek !== null ? (
        <StatTile label={b.visits} icon="calendar-booking" count={view.visitsWeek.length} sub={b.visitsSub} href="/agent/inspections" tag={tag} />
      ) : null}
      {view.agreements !== null ? (
        <StatTile
          label={b.waiting}
          icon="file-text"
          count={view.agreements.length}
          sub={b.waitingSub}
          href="/agreements"
          attention={view.agreements.length > 0}
          tag={tag}
        />
      ) : null}
    </StatBand>
  );
}

/**
 * The owner's cards, in the order a phone reads them (what needs action
 * first). The desk grid places the same cards in areas.
 */
export function OwnerBody({ view, places, t, locale }: Common & { view: OwnerView; places: ReadonlyMap<string, string> }) {
  return (
    <div className="wsd-grid wsd-grid--owner" data-testid="wsd-owner">
      {view.leaseToday && view.leaseToday.length > 0 ? <LeaseTodayCard refs={view.leaseToday} t={t} locale={locale} area="lease" /> : null}
      <UpcomingCard
        visits={view.visitsWeek}
        renewals={view.renewals}
        agreements={view.agreements}
        places={places}
        t={t}
        locale={locale}
        area="up"
      />
      <PaymentDueCard next={view.nextDue} t={t} locale={locale} area="due" />
      <RentMonthCard rent={view.rentMonth} t={t} locale={locale} area="rent" />
      <UnitsDonut split={view.units} t={t} locale={locale} area="units" />
      <RentTrendCard trend={view.trend} t={t} locale={locale} area="trend" />
      <PropertyCard property={view.property} tenancyId={view.propertyTenancyId} t={t} locale={locale} area="prop" />
    </div>
  );
}

/* ----------------------------------------------------------------- agent */

export type AgentDash = {
  enquiries: EnquiryRow[] | null;
  visits: Visit[] | null;
  closedDeals: number | null;
  liveListings: number;
  featured: Featured | null;
  reminders: { items: Reminder[]; unread: string[] };
  threads: ContactThread[] | null;
  callNumbers: ReadonlyMap<string, string>;
};

/** The agent's four tiles: new enquiries, viewings booked, listings live, deals closed. */
export function AgentBand({ dash, now, t, tag }: Pick<Common, "t"> & { dash: AgentDash; now: Date; tag: string }) {
  const b = t.workspaceDash.agent.band;
  return (
    <StatBand label={t.workspaceDash.agent.reminders.title}>
      {dash.enquiries !== null ? (
        <StatTile
          label={b.enquiries}
          icon="messages"
          count={enquiriesInLastDays(dash.enquiries, now, 30).length}
          sub={b.enquiriesSub}
          href="/agent/messages?filter=all"
          tag={tag}
        />
      ) : null}
      {dash.visits !== null ? (
        <StatTile label={b.viewings} icon="calendar-booking" count={upcomingVisits(dash.visits, now).length} sub={b.viewingsSub} href="/agent/inspections" tag={tag} />
      ) : null}
      <StatTile label={b.live} icon="house" count={dash.liveListings} sub={b.liveSub} href="/agent/listings" tag={tag} />
      {dash.closedDeals !== null ? (
        <StatTile label={b.deals} icon="circle-check" count={dash.closedDeals} sub={b.dealsSub} href="/agent/listings" tag={tag} />
      ) : null}
    </StatBand>
  );
}

/** The agent's cards, reminders first on a phone; the desk grid lays them out as the reference does. */
export function AgentBody({ dash, today, t, locale }: Common & { dash: AgentDash; today: string }) {
  const monthly = agentMonthly(dash.enquiries, dash.visits, today);
  return (
    <div className="wsd-grid wsd-grid--agent" data-testid="wsd-agent">
      <RemindersCard items={dash.reminders.items} unread={dash.reminders.unread} t={t} locale={locale} area="rem" />
      <CalendarCard today={today} counts={dash.visits ? visitCountsByDay(dash.visits) : null} t={t} locale={locale} area="cal" />
      <FeaturedCard featured={dash.featured} hasLive={dash.liveListings > 0} t={t} locale={locale} area="feat" />
      <ContactsCard
        contacts={dash.threads ? recentContacts(dash.threads, 5) : null}
        numbers={dash.callNumbers}
        t={t}
        locale={locale}
        area="con"
      />
      <PerformanceCard enquiries={monthly.enquiries} visits={monthly.visits} t={t} locale={locale} area="chart" />
    </div>
  );
}
