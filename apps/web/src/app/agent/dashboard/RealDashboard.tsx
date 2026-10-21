import type { ReactNode } from "react";
import Link from "next/link";
import { formatDate, type Dictionary, type Locale } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import type { AgentNumbers } from "@/lib/agent/listings-queries";
import { fill } from "../_copy";
import { ButtonLink } from "@/components/ui/Button";
import { Amount } from "@/components/ui/Amount";
import { StatusPill, toneForStatus } from "@/components/ui/StatusPill";
import { Stack, TYPE } from "@/components/app/Screen";
import { InspectionRows } from "@/components/app/inspections/InspectionRows";
import type { InspectionList } from "@/lib/inspections/queries";
import { isOpen } from "@/lib/inspections/types";
import { HeroBand } from "@/components/ui/HeroBand";
import { KpiTile } from "@/components/ui/KpiTile";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { IconPlate } from "@/components/ui/IconPlate";
import { Gauge, type GaugeStage } from "@/components/ui/charts/Gauge";
import { TodayHero } from "@/components/workspace/TodayHero";
import { waitingOn } from "@/lib/inspections/types";
import { PROMOTION_HUB_HREF } from "@/lib/promotion/links";
import { lagosDay, type OwnerView } from "@/lib/workspace/dashboard-model";
import { AgentBand, AgentBody, OwnerBand, OwnerBody, type AgentDash } from "@/components/workspace/dashboard/Sections";
import "@/app/css/site.css";

/**
 * The signed-in agent's real dashboard.
 *
 * Live counts, never seeded ones. There is deliberately no month-over-month
 * delta on the figures: the platform has no history to compare against yet,
 * and an invented trend arrow would be a lie dressed as a number.
 *
 * ---------------------------------------------------------------------------
 * ELEVEN SURFACES BECAME FOUR
 * ---------------------------------------------------------------------------
 *
 * This screen was five stat cards, two panels each carrying its own heading
 * INSIDE its own border, and four square quick-action cards: eleven bordered,
 * rounded, shadowed rectangles down one column on a phone, for what is really
 * four groups of related things. The rule is one surface per GROUP, not one
 * per item, and it is most of why the reference platforms' screens read as
 * calm while carrying the same amount.
 *
 * So the five figures are one surface of rows. The listing breakdown is one
 * surface of rows with its heading OUTSIDE it. The stays are rows. The quick
 * actions are rows. Nothing is nested and no heading sits inside a card.
 *
 * ---------------------------------------------------------------------------
 * INSPECTIONS COME FIRST, AND THAT IS THE PRODUCT ARGUMENT
 * ---------------------------------------------------------------------------
 *
 * In this market an inspection is the deal. An annual tenancy is agreed after
 * somebody has stood in the flat; a sale is agreed after somebody has walked
 * the land. Until now the platform could not represent that step at all - it
 * lived as sentences inside a chat thread, which meant an agent with nine
 * properties tracked their most valuable queue by scrolling, and a request
 * that went unanswered for three days looked exactly like one that never
 * arrived.
 *
 * It is therefore the FIRST thing on this screen, above the numbers, and it
 * only appears when there is something waiting. A section that renders an
 * empty state above the figures every day would train an agent to scroll past
 * the one place that costs them money.
 *
 * ---------------------------------------------------------------------------
 * REFERENCE 7033: THE FIGURE HERO AND THE NEXT ACTION (Session 3, 6 October)
 * ---------------------------------------------------------------------------
 *
 * The band leads with "Needs you today": open inspection requests plus unread
 * messages, the two queue tiles beneath it, and only the ones that were read.
 * An inspections read that failed used to draw its tile as 0; it is now left
 * out of the tiles and the figure, the rule the host home already kept. The
 * oldest request still waiting on the agent (REQUESTED, the ball in their
 * court) is promoted to the one next action and leaves the list below.
 */

export function RealDashboard({
  t,
  locale,
  displayName,
  numbers,
  inspections,
  figure,
  workspace,
  now,
}: {
  t: Dictionary;
  locale: Locale;
  displayName: string;
  numbers: AgentNumbers;
  /** What this person has been asked to show. See the header. */
  inspections: InspectionList;
  /** The figure card (reference 5), drawn first under the band; the page reads its rows. */
  figure?: ReactNode;
  /**
   * WHICH SIDE THIS ACCOUNT HOLDS (`agents.role`), AND WHAT THAT SIDE'S CARDS
   * ARE. One account holds one side, so the dashboard is one component with
   * two sets of cards: an owner sees units, rent paid through Vallo, leases
   * ending and agreements waiting; an agent sees the pipeline, reminders,
   * visits and contacts. Absent (the old callers), neither set is drawn.
   */
  workspace?:
    | { role: "owner"; view: OwnerView; places: ReadonlyMap<string, string> }
    | { role: "agent"; dash: AgentDash };
  /** The request's moment, read once by the page. */
  now?: Date;
}) {
  const a = t.agent.dashboard;
  const d = t.agentListings.dashboard;
  const quickActions: { icon: UiIconName; label: string; href: string }[] = [
    { icon: "plus", label: a.addListing, href: "/agent/list" },
    { icon: "calendar-booking", label: a.viewBookings, href: "/agent/bookings" },
    { icon: "house", label: a.manageListings, href: "/agent/listings" },
    { icon: "wallet", label: a.earningsReport, href: "/agent/earnings" },
  ];

  const openInspections = inspections.readFailed
    ? []
    : inspections.inspections.filter((one) => isOpen(one.state));
  /* The next action: the oldest request waiting on this agent. */
  const nextInspection =
    [...openInspections]
      .filter((one) => waitingOn(one.state) === "lister")
      .sort((x, y) => x.requestedAt.localeCompare(y.requestedAt))[0] ?? null;
  const listedInspections = openInspections.filter((one) => one.id !== nextInspection?.id);
  /* The figure is the sum of the queue tiles that were read; with neither
     read there is no figure at all. */
  const needsYou =
    inspections.readFailed && numbers.unreadMessages === null
      ? null
      : /* Only the requests waiting on this lister: an offered time waits on
           the renter, so it is not something that "needs you". */
        openInspections.filter((one) => waitingOn(one.state) === "lister").length + (numbers.unreadMessages ?? 0);

  const k = t.desk.agent;
  const tag = locale === "en" ? "en-NG" : locale;
  const dateLine = new Intl.DateTimeFormat(tag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Lagos",
  }).format(new Date());
  const by = numbers.byStatus;
  /* The listings' real statuses folded into the four stages of spec 13.1.
     Every listing lands in exactly one, so the total is `totalListings`. */
  const stages: GaugeStage[] = [
    { key: "draft", label: k.stage.draft, count: by.DRAFT, tone: "neutral" },
    {
      key: "review",
      label: k.stage.review,
      count: by.SUBMITTED + by.UNDER_REVIEW + by.MORE_INFO_REQUIRED,
      tone: "warning",
    },
    { key: "live", label: k.stage.live, count: by.PUBLISHED + by.APPROVED, tone: "brand" },
    { key: "other", label: k.stage.other, count: by.REJECTED + by.SUSPENDED, tone: "error" },
  ];

  return (
    <div className="nf-desk-home">
      {/* THE WORKSPACE HOME (plan item 14): the navy band with the date,
          "Today", the one action and the KPI row on it. Every figure is a
          count this page already read; unread is left out when it could not
          be read, and no tile carries a delta because none of these counts
          has a measured previous period. */}
      <HeroBand
        lap
        label={dateLine}
        title={t.desk.today.title}
        titleAs="h1"
        sub={fill(d.standing, { name: displayName })}
        action={
          <ButtonLink href="/agent/list" variant="primary">
            <UiIcon name="plus" size={20} />
            {a.addListing}
          </ButtonLink>
        }
      >
        <TodayHero
          caption={t.desk.today.needsYou}
          count={needsYou}
          busy={t.desk.today.sumLine}
          idle={t.desk.today.nothing}
          tag={tag}
          next={
            nextInspection
              ? {
                  href: "/agent/inspections",
                  leading: (
                    <IconPlate size="sm" shape="round" tone="warning">
                      <UiIcon name="calendar-clock" size={20} />
                    </IconPlate>
                  ),
                  title: nextInspection.listingTitle ?? k.kpi.inspections,
                  sub: [
                    nextInspection.counterpartName,
                    formatDate(new Date(nextInspection.requestedAt), locale, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    }),
                  ]
                    .filter(Boolean)
                    .join(" · "),
                }
              : null
          }
        />
        {/* The workspace dashboards' band: four tiles for the side this
            account holds. The old four-count row stays for a caller that does
            not say which side (nothing now does). */}
        {workspace?.role === "owner" ? (
          <OwnerBand view={workspace.view} t={t} locale={locale} tag={tag} />
        ) : workspace?.role === "agent" ? (
          <AgentBand dash={workspace.dash} now={now ?? new Date()} t={t} tag={tag} />
        ) : (
        <div className="nf-desk-kpis">
          <KpiTile label={k.kpi.live} icon="house" value={numbers.liveListings} href="/agent/listings" tag={tag} />
          {inspections.readFailed ? null : (
            <KpiTile
              label={k.kpi.inspections}
              icon="calendar-clock"
              value={openInspections.length}
              href="/agent/inspections"
              tag={tag}
            />
          )}
          <KpiTile label={k.kpi.review} icon="file-search" value={numbers.inReview} href="/agent/listings" tag={tag} />
          {numbers.unreadMessages !== null ? (
            <KpiTile
              label={k.kpi.unread}
              icon="chat-bubble"
              value={numbers.unreadMessages}
              href="/agent/messages"
              tag={tag}
              className={numbers.unreadMessages > 0 ? "nf-kpi--spark" : undefined}
            />
          ) : null}
        </div>
        )}
      </HeroBand>

      <Stack>
        {/* The side's cards first (what needs action, then the figures), then
            the sections every account shares. The owner's units ring replaces
            the listing-status gauge, which says less about a rental. */}
        {workspace?.role === "owner" ? (
          <OwnerBody view={workspace.view} places={workspace.places} t={t} locale={locale} />
        ) : workspace?.role === "agent" ? (
          <AgentBody dash={workspace.dash} today={lagosDay(now ?? new Date())} t={t} locale={locale} />
        ) : null}
        {workspace?.role === "owner" ? null : figure}
        {listedInspections.length > 0 || (workspace?.role !== "owner" && numbers.totalListings > 0) ? (
          <div className="nf-desk-grid">
            {listedInspections.length > 0 ? (
              <section className="nf-list-section">
                <div className="nf-list-section__head">
                  <h2 className="nf-section-label">{t.desk.today.needsAttention}</h2>
                  <Link href="/agent/inspections" className="nf-list-section__action nf-link-quiet nf-tap">
                    {t.common.viewAll}
                  </Link>
                </div>
                <InspectionRows inspections={listedInspections.slice(0, 4)} side="lister" locale={locale} viewingCopy={t.threads.rental} flowCopy={t.memberFlows.inspection} />
              </section>
            ) : null}
            {workspace?.role === "owner" ? null : numbers.totalListings > 0 ? (
              <section className="nf-list-section">
                <div className="nf-list-section__head">
                  <h2 className="nf-section-label">{k.pipeline}</h2>
                  <Link href="/agent/listings" className="nf-list-section__action nf-link-quiet nf-tap">
                    {t.common.viewAll}
                  </Link>
                </div>
                <div className="nf-desk-card">
                  <Gauge stages={stages} totalLabel={k.pipelineTotal} label={k.pipeline} tag={tag} />
                </div>
              </section>
            ) : (
              <p className={TYPE.body}>{d.noListings}</p>
            )}
          </div>
        ) : workspace?.role === "owner" ? null : (
          <p className={TYPE.body}>{d.noListings}</p>
        )}

        {/* -------------------------------------------------------- stays */}
        <ListGroup
          label={d.upcomingStays}
          action={
            <Link href="/agent/bookings" className="nf-link-quiet nf-tap">
              {t.common.viewAll}
            </Link>
          }
        >
          {numbers.upcomingBookings.length === 0 ? (
            <ListRow title={d.noStays} />
          ) : (
            numbers.upcomingBookings.map((booking) => (
              <ListRow
                key={booking.id}
                href="/agent/bookings"
                leading={
                  /* A content row: the round tinted plate (section 17). */
                  <IconPlate size="sm" shape="round" tone="brand">
                    <UiIcon name="calendar-booking" size={20} />
                  </IconPlate>
                }
                title={<span className="line-clamp-2 [overflow-wrap:anywhere]">{booking.listingTitle}</span>}
                sub={fill(d.stayDates, {
                  from: formatDate(new Date(`${booking.checkIn}T00:00:00Z`), locale, {
                    day: "numeric",
                    month: "short",
                  }),
                  to: formatDate(new Date(`${booking.checkOut}T00:00:00Z`), locale, {
                    day: "numeric",
                    month: "short",
                  }),
                })}
                value={<Amount minorUnits={booking.totalMinor} locale={locale} />}
                status={
                  <StatusPill tone={toneForStatus(booking.status)}>
                    {booking.status === "CONFIRMED" ? a.confirmed : a.pending}
                  </StatusPill>
                }
              />
            ))
          )}
        </ListGroup>

        {/* ---------------------------------------------------- promotion */}
        {/* D60: paid promotion's door on the screen a lister lands on. It
            opens `/agent/promotion` (the live listings, each with Promote);
            it shows no figure and sells nothing, because buying is not open
            until payments for promotion are live (`PROMOTION_NOT_ON_SALE`). */}
        <ListGroup data-testid="dashboard-promotion">
          <ListRow
            href={PROMOTION_HUB_HREF}
            leading={
              <IconPlate size="sm" shape="round" tone="brand">
                <UiIcon name="trending-up" size={20} />
              </IconPlate>
            }
            title={t.experienceFeatures.promotion.hub.title}
            sub={t.experienceFeatures.promotion.hub.dashboardSub}
            chevron
          />
        </ListGroup>

        {/* ------------------------------------------------------ actions */}
        <ListGroup label={a.quickActions}>
          {quickActions.map((action) => (
            <ListRow
              key={action.href}
              href={action.href}
              leading={
                <IconPlate size="sm">
                  <UiIcon name={action.icon} size={20} />
                </IconPlate>
              }
              title={action.label}
              chevron
            />
          ))}
        </ListGroup>
      </Stack>
    </div>
  );
}
