import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getSide } from "@/lib/side";
import { getMyBookings } from "@/lib/bookings/queries";
import { getMyReservations } from "@/lib/reservations/queries";
import { BillReturnCheck } from "@/components/app/reservations/TableSeatingPanel";
import { resolveSession } from "@/lib/actions/session";
import {
  readInspectionsForLister,
  readInspectionsForRequester,
} from "@/lib/inspections/queries";
import { PageFrame } from "@/components/app/PageFrame";
import { PageScene } from "@/components/app/PageScene";
import { Reveal } from "@/components/site/Reveal";
import { EmptyActions } from "@/components/app/EmptyActions";
import { EmptyState, Row, RowList, Section, TYPE } from "@/components/app/Screen";
import { TenancyCard } from "@/components/app/bookings/TenancyCard";
import { TripSpine } from "@/components/app/plans/TripSpine";
import { lagosToday } from "@/components/app/plans/trip-spine";
import { InspectionsBoard } from "@/components/app/plans/InspectionsBoard";
import { ComingUp } from "@/components/app/plans/ComingUp";
import { RentCountdowns } from "@/components/app/plans/RentCountdowns";
import {
  groupPlans,
  inFilter,
  lagosDay,
  planFilterFrom,
  type PlanFilter,
  type PlanItem,
  isLiveTenancy,
} from "@/components/app/plans/plans";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { isBillReference } from "@/lib/payments/references";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).shape.plans.title };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPEN_INSPECTION = new Set(["REQUESTED", "CONFIRMED", "PROPOSED"]);

/**
 * PLANS: one dated list of everything this person has committed to (V-76).
 *
 * This route was Bookings, and beside it stood `/trips` (stays and tables on
 * a date spine) and `/inspections` (the Property side's diary). Three lists
 * whose empty states were signposts to each other, and none of them answered
 * "what am I doing this weekend". They are one page now:
 *
 *   Coming up     every kind, still ahead, grouped Today / This week / Later
 *   Property      the tenancies (with Pay while payable) and the inspections
 *                 board, both sides of it, with every control it had
 *   Stays         the date spine: stays and tables, with pay, review and cancel
 *
 * A filter (All / Property / Stays) opens on the side the shell is on; its
 * `?side=` never moves the shell. `/trips` and `/inspections` redirect here
 * (`next.config.ts`) with `?side=stays&from=stays` and
 * `?kind=inspection&from=property`, and only `from=` picks the shell
 * (`sideOfPlansQuery`); `?changed=<id>` still expands the
 * inspection a thread just answered, and `?justBooked=<id>` still marks the
 * stay checkout just confirmed. Each kind keeps its own detail route; only
 * the lists merged.
 *
 * Every read degrades on its own: a failed stays read says so in the stays
 * half, and the inspections board says so for itself, so one broken read
 * never empties the whole page into a false "nothing planned".
 */
export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, params, shellSide] = await Promise.all([getLocale(), searchParams, getSide()]);
  const t = getDictionary(locale);
  const copy = t.shape.plans;
  const { filter, inspectionsOnly } = planFilterFrom(params, shellSide);
  const justBooked = typeof params.justBooked === "string" ? params.justBooked : undefined;
  /* Founder decision D: back from paying a restaurant bill on Paystack. */
  const billReturn =
    typeof params.bill === "string" && isBillReference(params.bill) ? params.bill : undefined;
  const changedRaw = Array.isArray(params.changed) ? params.changed[0] : params.changed;
  const changed = changedRaw && UUID_RE.test(changedRaw) ? changedRaw : null;

  const [loaded, tables, asked, shown, session] = await Promise.all([
    getMyBookings(locale),
    getMyReservations(),
    readInspectionsForRequester(),
    readInspectionsForLister(),
    resolveSession(),
  ]);
  const userId = session.state === "signed-in" ? session.user.id : null;
  const unavailable = loaded === "unavailable";
  const groups = unavailable ? null : loaded;
  const reservations = Array.isArray(tables) ? tables : [];
  const today = lagosToday();

  /* ------------------------------------------------ the one dated list */
  const items: PlanItem[] = [];
  for (const row of [...asked.inspections, ...shown.inspections]) {
    if (!OPEN_INSPECTION.has(row.state)) continue;
    const at = row.slotAt ?? row.requestedAt;
    items.push({
      id: row.id,
      kind: "inspection",
      side: "property",
      on: lagosDay(at),
      at,
      title: row.listingTitle ?? copy.inspectionFallback,
      where: row.counterpartName ?? "",
      href: `/bookings?kind=inspection&from=property&changed=${row.id}#ix-${row.id}`,
    });
  }
  for (const tenancy of groups?.rent ?? []) {
    if (!isLiveTenancy(tenancy.status, tenancy.moveIn, today)) continue;
    items.push({
      id: tenancy.id,
      kind: "tenancy",
      side: "property",
      on: tenancy.moveIn,
      title: tenancy.title,
      where: [tenancy.area, tenancy.city].filter(Boolean).join(", "),
      href: tenancy.href,
    });
  }
  for (const stay of groups?.upcoming ?? []) {
    if (stay.status === "CANCELLED") continue;
    items.push({
      id: stay.id,
      kind: "stay",
      side: "stays",
      on: stay.checkIn,
      title: stay.title,
      where: [stay.area, stay.city].filter(Boolean).join(", "),
      href: `/bookings/${stay.id}`,
    });
  }
  for (const table of reservations) {
    if (table.status === "CANCELLED" || table.status === "NO_SHOW") continue;
    items.push({
      id: table.id,
      kind: "table",
      side: "stays",
      on: lagosDay(table.reservedFor),
      at: table.reservedFor,
      title: table.listingTitle,
      where: table.location,
      href: table.conversationId ? `/messages/${table.conversationId}` : "/bookings?side=stays",
    });
  }
  const upcoming = groupPlans(
    items.filter((item) => inFilter(item, filter) && (!inspectionsOnly || item.kind === "inspection")),
    today,
  );

  const showProperty = filter !== "stays";
  const showStays = filter !== "property" && !inspectionsOnly;
  const rent = showProperty && !inspectionsOnly ? (groups?.rent ?? []) : [];
  const stays = groups ? [...groups.upcoming, ...groups.completed, ...groups.cancelled] : [];
  const hasInspections =
    asked.inspections.length + shown.inspections.length > 0 || asked.readFailed || shown.readFailed;
  const hasStays = stays.length > 0 || reservations.length > 0;
  const nothing =
    !unavailable &&
    (!showProperty || (!hasInspections && rent.length === 0)) &&
    (!showStays || !hasStays);

  return (
    <PullToRefresh className="nf-cat-surface mx-auto max-w-2xl">
      <div className="relative">
        {/* The scene sits behind the title band only, as it did when it
            framed the bare header. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[9rem]">
          <PageScene art="calendar-check" />
        </div>
        <PageFrame title={copy.title} subtitle={copy.lede}>
        <div>

      <FilterLinks filter={inspectionsOnly ? "property" : filter} copy={copy} />
      {billReturn && <BillReturnCheck reference={billReturn} />}

      {nothing ? (
        <EmptyState
          icon="calendar-check"
          title={copy.emptyTitle}
          body={
            filter === "stays" ? copy.emptyStays : filter === "property" ? copy.emptyProperty : copy.emptyAll
          }
          action={
            <EmptyActions
              primary={
                filter === "stays"
                  ? { label: copy.findStay, href: "/stays/search" }
                  : { label: copy.findPlace, href: "/search" }
              }
              {...(filter === "all" ? { secondary: { label: copy.findStay, href: "/stays/search" } } : {})}
            />
          }
          data-testid="plans-empty"
        />
      ) : (
        <>
          <ComingUp
            groups={upcoming}
            copy={copy}
            partial={unavailable || asked.readFailed || shown.readFailed}
          />

          {showProperty && (rent.length > 0 || hasInspections || unavailable) && (
            <Reveal className="mt-block">
              <h2 className="nf-group-label">{copy.propertyTitle}</h2>
              {/* The tenancies come from the same read as the stays: when it
                  failed, say so here too rather than showing no move-ins. */}
              {unavailable && !inspectionsOnly && (
                <div className="py-heading text-center" data-testid="plans-property-unavailable">
                  <p className={TYPE.rowTitle}>{t.catalogue.bookings.unavailableTitle}</p>
                  <p className={`mx-auto mt-row max-w-sm ${TYPE.body}`}>{t.catalogue.bookings.unavailableBody}</p>
                </div>
              )}
              {rent.length > 0 && (
                <Section title={copy.tenanciesTitle}>
                  {/* B10: when the rent is due again, for the tenant. */}
                  <RentCountdowns tenancies={rent} locale={locale} />
                  <ul className="flex flex-col gap-md">
                    {rent.map((tenancy) => (
                      <TenancyCard key={tenancy.id} tenancy={tenancy} locale={locale} />
                    ))}
                  </ul>
                </Section>
              )}
              <InspectionsBoard
                locale={locale}
                asked={asked}
                shown={shown}
                userId={userId}
                changed={changed}
              />
            </Reveal>
          )}

          {showStays && (unavailable || hasStays) && (
            <Reveal className="mt-block">
              <h2 className="nf-group-label">{copy.staysTitle}</h2>
              {unavailable ? (
                <div className="py-heading text-center" data-testid="plans-stays-unavailable">
                  <p className={TYPE.rowTitle}>{t.catalogue.bookings.unavailableTitle}</p>
                  <p className={`mx-auto mt-row max-w-sm ${TYPE.body}`}>
                    {t.catalogue.bookings.unavailableBody}
                  </p>
                </div>
              ) : (
                <TripSpine
                  bookings={stays}
                  reservations={reservations}
                  today={today}
                  locale={locale}
                  justBookedId={justBooked}
                />
              )}
            </Reveal>
          )}
        </>
      )}

      {showStays && <HowItWorks locale={locale} />}
        </div>
        </PageFrame>
      </div>
    </PullToRefresh>
  );
}

/** The three sides of the filter, as links: the address is the state. */
function FilterLinks({
  filter,
  copy,
}: {
  filter: PlanFilter;
  copy: ReturnType<typeof getDictionary>["shape"]["plans"];
}) {
  const options: { value: PlanFilter; label: string }[] = [
    { value: "all", label: copy.filterAll },
    { value: "property", label: copy.filterProperty },
    { value: "stays", label: copy.filterStays },
  ];
  return (
    <nav
      aria-label={copy.filterLabel}
      className="nf-segmented mb-block flex w-full items-center gap-2xs p-2xs"
      data-testid="plans-filter"
    >
      {options.map((option) => (
        <Link
          key={option.value}
          href={`/bookings?side=${option.value}`}
          aria-current={option.value === filter ? "true" : undefined}
          className={`nf-segmented__link min-h-11 flex-1 text-[length:var(--nf-text-caption)] ${
            option.value === filter ? "font-bold" : ""
          }`}
          prefetch={false}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

/** How a stay works, three rows: kept from Bookings for the Stays side. */
function HowItWorks({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).catalogue.bookings;
  const steps: { icon: UiIconName; title: string; body: string }[] = [
    { icon: "calendar-check", title: copy.step1Title, body: copy.step1Body },
    { icon: "credit-card", title: copy.step2Title, body: copy.step2Body },
    { icon: "key", title: copy.step3Title, body: copy.step3Body },
  ];
  return (
    <Reveal delay={100}>
      <h2 className="nf-group-label mt-block">{copy.howTitle}</h2>
      <RowList boxed>
        {steps.map((s) => (
          <Row key={s.title} className="items-start">
            <IconPlate size="sm" className="shrink-0">
              <UiIcon name={s.icon} size={20} />
            </IconPlate>
            <span className="min-w-0 leading-tight">
              <span className={`block ${TYPE.rowTitle}`}>{s.title}</span>
              <span className={`mt-inline-tight block ${TYPE.rowMeta}`}>{s.body}</span>
            </span>
          </Row>
        ))}
      </RowList>
    </Reveal>
  );
}
