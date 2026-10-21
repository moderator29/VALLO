import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { listingById } from "@/lib/listings/listing-by-id";
import { readVisit } from "@/lib/inspections/visit-queries";
import { StateMoment } from "@/components/ui/StateMoment";
import { ButtonLink } from "@/components/ui/Button";
import { VisitHeader } from "@/components/app/inspections/visit/VisitHeader";
import { VisitPropertyCard } from "@/components/app/inspections/visit/VisitPropertyCard";
import { VisitListerCard, type ListerCall } from "@/components/app/inspections/visit/VisitListerCard";
import { VisitStatus } from "@/components/app/inspections/visit/VisitStatus";
import { roleWordsOf, visitPlaceOf, visitPropertyOf } from "@/components/app/inspections/visit/property";
import "@/app/css/visit.css";
import { requestNow } from "@/lib/format/when";

/**
 * SCHEDULE A VISIT, STEP 2 (`/listing/[id]/visit/[inspectionId]`): where the
 * renter's visit stands, read from their own row under RLS.
 *
 * Another member's id is "not found", never a hint that it exists. The
 * lister opening this address is sent to answer it from their own screen,
 * since this one is the renter's. The listing may have been taken down since
 * the visit was asked for; the visit still stands, so the card is simply left
 * out rather than the page failing.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.visit.statusTitle, robots: { index: false, follow: false } };
}

export default async function VisitStatusPage({ params }: { params: Promise<{ id: string; inspectionId: string }> }) {
  const { id, inspectionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(inspectionId)) notFound();
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.visit;
  const here = `/listing/${id}`;

  const [record, listing] = await Promise.all([readVisit(id, inspectionId), listingById(id)]);
  if (record.state === "signed-out") redirect(`/sign-in?next=${encodeURIComponent(`${here}/visit/${inspectionId}`)}`);

  const header = (
    <VisitHeader
      title={copy.statusTitle}
      step={2}
      progressLabel={copy.progress.replace("{step}", "2").replace("{total}", "2")}
      fallback={here}
    />
  );

  if (record.state === "missing") {
    return (
      <div className="nf-visit">
        {header}
        <StateMoment
          kind="empty"
          inset
          title={copy.page.notFoundTitle}
          body={copy.page.notFoundBody}
          actions={
            <ButtonLink href="/bookings?kind=inspection&from=property" variant="primary" size="lg" full>
              {copy.page.openPlans}
            </ButtonLink>
          }
        />
      </div>
    );
  }
  if (record.state === "lister") {
    return (
      <div className="nf-visit">
        {header}
        <StateMoment
          kind="empty"
          inset
          title={copy.page.listerSideTitle}
          body={copy.page.listerSide}
          actions={
            <ButtonLink href="/agent/inspections" variant="primary" size="lg" full>
              {copy.page.openInspections}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const { row, lister, reminders } = record;
  const roles = roleWordsOf(lister.role, t.socialProfile.roleLine, copy.roleNoun);
  const call: ListerCall = lister.phone
    ? { kind: "tel", number: lister.phone }
    : record.videoOn && row.conversationId
      ? { kind: "app", conversationId: row.conversationId }
      : null;
  /* The render's clock, handed down so the server and the first client
     render agree on the phase of the visit. */
  const now = requestNow();
  const area = listing?.area || listing?.city || "";

  return (
    <div className="nf-visit" data-testid="visit-status-page">
      {header}
      {listing ? (
        <aside className="nf-visit__aside">
          <VisitPropertyCard
            property={visitPropertyOf(listing, t.catalogue.card)}
            locale={locale}
            label={copy.property.label}
            sizeWord={copy.property.size}
          />
        </aside>
      ) : null}
      <VisitStatus
        row={row}
        listingId={id}
        locale={locale}
        now={now}
        copy={copy}
        reminders={reminders}
        roleNoun={roles.noun}
        area={area}
        place={listing ? visitPlaceOf(listing) : area}
        calendarWords={t.memberKit.dayKit}
        lister={
          <VisitListerCard
            lister={lister}
            roleLabel={roles.label}
            messageHref={row.conversationId ? `/messages/${row.conversationId}` : `/messages/new?listing=${id}`}
            call={call}
            copy={copy.lister}
          />
        }
      />
    </div>
  );
}
