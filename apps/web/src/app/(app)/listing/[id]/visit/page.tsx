import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { listingById } from "@/lib/listings/listing-by-id";
import { marketOf } from "@/lib/listings/market";
import { readVisitPlanner } from "@/lib/inspections/visit-queries";
import { StateMoment } from "@/components/ui/StateMoment";
import { ButtonLink } from "@/components/ui/Button";
import { VisitHeader } from "@/components/app/inspections/visit/VisitHeader";
import { VisitPropertyCard } from "@/components/app/inspections/visit/VisitPropertyCard";
import { VisitListerCard } from "@/components/app/inspections/visit/VisitListerCard";
import { VisitPlanner } from "@/components/app/inspections/visit/VisitPlanner";
import { roleWordsOf, visitPropertyOf } from "@/components/app/inspections/visit/property";
import "@/app/css/visit.css";
import { requestNow } from "@/lib/format/when";

/**
 * SCHEDULE A VISIT, STEP 1 (`/listing/[id]/visit`).
 *
 * Signed in only: a signed-out reader is sent to sign in and brought back
 * here (`next`). A reader who already has a live visit of this home goes to
 * its status screen instead of being offered a second one the action would
 * refuse. Stays, restaurants, example listings and the reader's own listing
 * each get a plain sentence and the way back, never a form that cannot work.
 *
 * The lister's open times come from `viewing_slots` (`readViewingSlots`),
 * on Lagos time; with none the renter suggests a time and the lister
 * confirms it. Viewing never takes money, so nothing here prices anything
 * but the property itself.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.visit.title, robots: { index: false, follow: false } };
}

export default async function ScheduleVisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ slot?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.visit;
  const listing = await listingById(id);
  if (!listing) notFound();

  const here = `/listing/${listing.id}`;
  const header = (
    <VisitHeader
      title={copy.title}
      step={1}
      progressLabel={copy.progress.replace("{step}", "1").replace("{total}", "2")}
      fallback={here}
    />
  );

  const market = marketOf(listing);
  if (market !== "tenancy" && market !== "sale") {
    return (
      <div className="nf-visit">
        {header}
        <StateMoment
          kind="empty"
          inset
          title={copy.page.notViewableTitle}
          body={copy.page.notViewable}
          actions={
            <ButtonLink href={here} variant="primary" size="lg" full>
              {copy.page.backToListing}
            </ButtonLink>
          }
        />
      </div>
    );
  }
  if (listing.isDemo) {
    return (
      <div className="nf-visit">
        {header}
        <StateMoment
          kind="empty"
          inset
          title={copy.page.exampleTitle}
          body={copy.page.example}
          actions={
            <ButtonLink href="/search" variant="primary" size="lg" full>
              {copy.page.openSearch}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const planner = await readVisitPlanner(listing.id, {
    listerName: listing.listerName ?? null,
    listingRole: listing.listerRole ?? null,
  });
  if (planner.state === "signed-out") redirect(`/sign-in?next=${encodeURIComponent(`${here}/visit`)}`);
  if (planner.state === "existing") redirect(`${here}/visit/${planner.inspectionId}`);
  if (planner.state === "own") {
    return (
      <div className="nf-visit">
        {header}
        <StateMoment
          kind="empty"
          inset
          title={copy.page.ownTitle}
          body={copy.page.own}
          actions={
            <ButtonLink href={here} variant="primary" size="lg" full>
              {copy.page.backToListing}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  /* The render's clock, handed down so the server and the first client
     render agree on which times are still ahead. */
  const now = requestNow();
  const roles = roleWordsOf(planner.lister.role, t.socialProfile.roleLine, copy.roleNoun);
  const asked = typeof query.slot === "string" ? query.slot : null;
  const initialSlot = asked && planner.slots?.some((slot) => slot.slotAt === asked) ? asked : null;

  return (
    <div className="nf-visit" data-testid="visit-planner">
      {header}
      <aside className="nf-visit__aside">
        <VisitPropertyCard
          property={visitPropertyOf(listing, t.catalogue.card)}
          locale={locale}
          label={copy.property.label}
          sizeWord={copy.property.size}
        />
      </aside>
      <VisitPlanner
        listingId={listing.id}
        locale={locale}
        now={now}
        copy={copy}
        slots={planner.slots}
        videoOn={planner.videoOn}
        initialSlot={initialSlot}
        roleNoun={roles.noun}
        lister={
          <VisitListerCard
            lister={planner.lister}
            roleLabel={roles.label}
            messageHref={planner.conversationId ? `/messages/${planner.conversationId}` : `/messages/new?listing=${listing.id}`}
            call={planner.videoOn && planner.conversationId ? { kind: "app", conversationId: planner.conversationId } : null}
            copy={copy.lister}
          />
        }
      />
    </div>
  );
}
