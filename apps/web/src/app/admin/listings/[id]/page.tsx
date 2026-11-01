import type { Metadata } from "next";
import { ReviewCallAction } from "@/components/calls/admin/ReviewCallAction";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { DeskHead, Panel } from "../../_review/parts";
import { LiveRefresh } from "@/app/admin/_components/LiveRefresh";
import { referenceOf } from "../rows";
import { listingStatusWord, reviewHref } from "../tabs";
import { ListingReview } from "./ListingReview";
import { ReviewActionBar } from "./ReviewActionBar";
import { ReopenControl } from "./PropertyMatchButtons";
import { PhotoProvenance } from "./PhotoProvenance";
import { loadListingReview } from "./review-data";
import { listingHubHref, listingSectionLinks } from "./section-links";
import "../../_review/review.css";

export const metadata: Metadata = {
  title: "Listing under review",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * One listing under review. The page leads with the decision and lists the
 * evidence as rows, each opening its own page with a way back (photos,
 * details, location, costs, the lister, the checklist, fee terms, matches and
 * notes). It used to lay every panel out on one long screen.
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
  const raw = await searchParams;
  const data = await loadListingReview(id, raw);
  const { found, extras, extra, copy, common, t, locale, ui, queueHref, query } = data;

  if (!found) {
    return (
      <div className="nf-rv">
        <DeskHead title="Listing under review" />
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

  const { closedReason, decidable, nextId, provenance, feeAcceptance, tiles, payeeCtx } = data;
  const { offset: _offset, ...carried } = query;
  const hubHref = listingHubHref(found.id, raw);

  return (
    <>
      <LiveRefresh seconds={30} />
      <ListingReview
        listing={found}
        extras={extra}
        reference={referenceOf(found)}
        copy={copy}
        locale={locale}
        sqm={t.catalogue.card.sqm}
        statusLabel={(status) => listingStatusWord(status, ui.statusLabel)}
        backHref={queueHref}
        tiles={tiles}
        keepers={{
          moveIn: t.moveIn,
          purchase: t.purchase,
          payee: payeeCtx ? { ctx: payeeCtx, copy: t.afterTheGate.moneyMap } : null,
        }}
        compoundCopy={t.shape.compound}
        hubHref={hubHref}
        sectionLinks={listingSectionLinks({ listing: found, extra, provenance, feeAcceptance, raw })}
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
            {/* VC1: a review call with the lister (listing approval scope, both switches on). */}
            <ReviewCallAction caseKind="listing" caseId={found.id} />
          </>
        }
      />
    </>
  );
}
