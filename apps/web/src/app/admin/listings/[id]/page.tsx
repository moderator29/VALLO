import type { Metadata } from "next";
import { InternalNotes } from "../../_components/InternalNotes";
import { ReviewCallAction } from "@/components/calls/admin/ReviewCallAction";
import { readPayeeContext } from "@/lib/after-gate/payee";
import { getDictionary } from "@vallo/i18n";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { getLocale } from "@/lib/locale";
import { getListingSubmissions, type ListingReviewView } from "@/lib/admin/queries";
import { getListingReviewExtras } from "@/lib/admin/reads/listings";
import { tileProvider } from "@/lib/maps/tiles";
import { adminUi } from "../../_components/ui";
import { readQueueQuery } from "../../_components/QueueFilters";
import { DeskHead, Panel } from "../../_review/parts";
import { LiveRefresh } from "@/app/admin/_components/LiveRefresh";
import { referenceOf } from "../rows";
import { listingStatusWord, queueHrefFrom, reviewHref } from "../tabs";
import { ListingReview } from "./ListingReview";
import { ReviewActionBar } from "./ReviewActionBar";
import { PropertyMatchPanel } from "./PropertyMatchPanel";
import { ReopenControl } from "./PropertyMatchButtons";
import { readClosedReasons } from "@/lib/landlord/queries";
import { PhotoProvenance } from "./PhotoProvenance";
import { FeeAcceptancePanel } from "./FeeAcceptancePanel";
import { readFeeAcceptance } from "@/lib/admin/desk-reads/fee-acceptance-read";
import { readPhotoProvenance } from "@/lib/photo-hash/matches-read";
import "../../_review/review.css";

export const metadata: Metadata = {
  title: "Listing under review",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * One listing under review, C1D98B3C panel 2, with the flow of GOVERNING-12
 * panel 2.
 *
 * Two reads. `getListingReviewExtras` (lib/admin/reads/listings.ts) reads the
 * listing by id: its map pin, amenity names, availability, whether it is an
 * example, the lister's verification, and the next listing waiting in the
 * reviewer's queue. The listing itself (photos, walkthrough, the admission
 * checklist, the itemised costs) is the `getListingSubmissions` view,
 * found by the listing's own title and status so the checklist and the costs
 * are computed in one place only.
 *
 * The decision bar calls `reviewListing` and nothing else.
 */
export default async function ListingUnderReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.admin.listings;
  const common = t.admin.common;
  const ui = adminUi(t, locale);
  const query = readQueueQuery(await searchParams);
  const queueHref = queueHrefFrom(query);

  const extras = await getListingReviewExtras(id, query.status);
  const extra = extras.state === "ok" ? extras.data : null;

  let found: ListingReviewView | undefined;
  if (extra) {
    const read = await getListingSubmissions({ status: extra.status, q: extra.title });
    if (read.state === "ok") {
      found = [...read.data.waiting, ...read.data.decided].find((listing) => listing.id === id);
    }
  }

  if (!found) {
    return (
      <div className="nf-rv">
        <DeskHead
          title="Listing under review"
        />
        <Panel
          title={
            extras.state === "ok" && !extra
              ? "There is no listing with this id"
              : "This listing could not be opened"
          }
        >
          <p className="nf-rv-msg">
            {extras.state !== "ok"
              ? common.unavailableBody
              : !extra
                ? "It may have been deleted by its lister. Nothing about it is shown rather than a guess."
                : "It was found, but its photos and checklist could not be read just now. Try again, or find it from the queue by its title."}
          </p>
        </Panel>
      </div>
    );
  }

  /* Four independent reads, together rather than one after another. */
  const [payeeCtx, closedReasons, provenance, feeAcceptance] = await Promise.all([
    found.intent === "sale" ? Promise.resolve(null) : readPayeeContext(found.id),
    /* V-48: a closed listing is SUSPENDED underneath and is not a decision;
       it shows how it closed, and staff may reopen it with a reason. */
    readClosedReasons([found.id]),
    /* V-45: compared at review, whatever the status, so a published listing
       can still be checked after a report. */
    readPhotoProvenance(found.id),
    /* The fee terms the lister accepted (D61), for the reviewer who is asked. */
    readFeeAcceptance(found.id),
  ]);
  const closedReason = closedReasons[found.id] ?? null;
  const decidable = found.status !== "PUBLISHED" && found.status !== "REJECTED" && closedReason === null;
  const dark = tileProvider("dark");
  const nextId = extra?.nextId ?? null;
  const { offset: _offset, ...carried } = query;

  return (
    <>
      <LiveRefresh seconds={30} />
      {extra?.lister ? <InternalNotes subjectId={extra.lister.userId} path={`/admin/listings/${found.id}`} /> : null}
      {/* VC1: a review call with the lister (listing approval scope, both switches on). */}
      <ReviewCallAction caseKind="listing" caseId={found.id} />
      <ListingReview
        listing={found}
        extras={extra}
        reference={referenceOf(found)}
        copy={copy}
        locale={locale}
        sqm={t.catalogue.card.sqm}
        statusLabel={(status) => listingStatusWord(status, ui.statusLabel)}
        backHref={queueHref}
        tiles={{
          dark: dark.url,
          credit: dark.credits.map((credit) => credit.label).join(", "),
        }}
        keepers={{
          moveIn: t.moveIn,
          purchase: t.purchase,
          payee: payeeCtx ? { ctx: payeeCtx, copy: t.afterTheGate.moneyMap } : null,
        }}
        compoundCopy={t.shape.compound}
        exampleNote={
          extra?.isDemo ? (
            <p className="nf-rv-unwired" role="note">
              <UiIcon name="info" size={16} />
              <span>
                This is an example listing. It shows how the product looks and is never counted
                as real supply.
              </span>
            </p>
          ) : null
        }
        photoProvenance={<PhotoProvenance provenance={provenance} total={found.photos.length} />}
        actions={
          <>
          {closedReason ? (
            <Panel>
              <p className="nf-rv-msg" data-testid="review-closed">
                {t.landlord.close.closedLabel.replace(
                  "{reason}",
                  t.landlord.close.closedReasons[closedReason as keyof typeof t.landlord.close.closedReasons] ?? closedReason,
                )}{" "}
                {t.landlord.admin.closedStays}
              </p>
              <ReopenControl listingId={found.id} copy={t.landlord.admin} />
            </Panel>
          ) : decidable ? (
            <ReviewActionBar
              listingId={found.id}
              status={found.status}
              nextHref={nextId ? reviewHref(nextId, carried) : null}
              queueHref={queueHref}
            />
          ) : (
            <Panel>
              <p className="nf-rv-msg">
                {found.status === "PUBLISHED" ? copy.liveInSearch : copy.closed} {common.inAuditLog}
              </p>
            </Panel>
          )}
          <FeeAcceptancePanel read={feeAcceptance} locale={locale} />
          {/* V-37: the listings that may be this same flat, proposed for the
              reviewer to join or keep apart. Never decided automatically. */}
          {extra?.isDemo ? null : (
            <PropertyMatchPanel listingId={found.id} copy={t.landlord.admin} locale={locale} />
          )}
          </>
        }
      />
    </>
  );
}
