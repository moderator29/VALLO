import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InternalNotes } from "../../../_components/InternalNotes";
import { Panel, DeskHead } from "../../../_review/parts";
import { LiveRefresh } from "@/app/admin/_components/LiveRefresh";
import { referenceOf } from "../../rows";
import { listingStatusWord } from "../../tabs";
import { ListingReview } from "../ListingReview";
import { PropertyMatchPanel } from "../PropertyMatchPanel";
import { FeeAcceptancePanel } from "../FeeAcceptancePanel";
import { PhotoProvenance } from "../PhotoProvenance";
import { isListingSection, loadListingReview } from "../review-data";
import { listingHubHref, listingSectionLinks } from "../section-links";
import "../../../_review/review.css";

export const metadata: Metadata = {
  title: "Listing under review",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** One part of a listing review, on its own page, with a way back to the listing. */
export default async function ListingSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, section } = await params;
  if (!isListingSection(section)) notFound();
  const raw = await searchParams;
  const data = await loadListingReview(id, raw);
  const { found, extra, copy, t, locale, ui } = data;

  if (!found) {
    return (
      <div className="nf-rv">
        <DeskHead title="Listing under review" />
        <Panel title="This listing could not be opened">
          <p className="nf-rv-msg">Go back to the queue and open it again.</p>
        </Panel>
      </div>
    );
  }

  const { provenance, feeAcceptance, tiles, payeeCtx } = data;
  const hubHref = listingHubHref(found.id, raw);
  const links = listingSectionLinks({ listing: found, extra, provenance, feeAcceptance, raw });

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
        tiles={tiles}
        keepers={{
          moveIn: t.moveIn,
          purchase: t.purchase,
          payee: payeeCtx ? { ctx: payeeCtx, copy: t.afterTheGate.moneyMap } : null,
        }}
        compoundCopy={t.shape.compound}
        section={section}
        hubHref={hubHref}
        sectionLinks={links}
        photoProvenance={<PhotoProvenance provenance={provenance} total={found.photos.length} />}
        actions={null}
        sectionSlots={{
          fees: <FeeAcceptancePanel read={feeAcceptance} locale={locale} />,
          matches: extra?.isDemo ? null : <PropertyMatchPanel listingId={found.id} copy={t.landlord.admin} locale={locale} />,
          notes: extra?.lister ? (
            <InternalNotes subjectId={extra.lister.userId} path={`/admin/listings/${found.id}/notes`} />
          ) : (
            <Panel>
              <p className="nf-rv-msg">There is no lister on record to write a note about.</p>
            </Panel>
          ),
        }}
      />
    </>
  );
}
