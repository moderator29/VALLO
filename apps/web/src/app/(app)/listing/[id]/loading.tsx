import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { panelClass } from "@/components/ui/Panel";
import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { ListingHandoffShell } from "@/components/app/listing/ListingHandoffShell";
import { NairaFacePreload } from "@/components/app/NairaFacePreload";
import "@/app/css/space-card.css";

/**
 * The wait, on a listing.
 *
 * This is the screen that sells the product, and the one users arrive at from a
 * shared link on a cold cache. It awaits the listing, its photographs, its
 * saved state and its reviews.
 *
 * Two measurements matter more than the rest and both are reproduced exactly:
 * the gallery's aspect ratio, which changes at the sm breakpoint (3:2 on
 * phones, 16:10 from sm), and the lead panel under the inset photograph, both
 * inside the one space card. Get either wrong and the photograph lands at a
 * different height than the placeholder, pushing the price - the single most
 * important figure on the page - down the screen as the user is reaching for it.
 */
export default async function LoadingListing() {
  const t = getDictionary(await getLocale());
  /* B4: a tap from a card paints the card's own facts in one frame
     (ListingHandoffShell); a cold open keeps this skeleton. */
  return (
    <LoadingShell label={t.memberFlows.loading.listing} className="mx-auto w-full max-w-5xl">
      {/* The move-in total is in the first viewport: its naira sign arrives with the page. */}
      <NairaFacePreload />
      <ListingHandoffShell verifiedLabel={t.common.verified} fallback={<ListingSkeleton />} />
    </LoadingShell>
  );
}

function ListingSkeleton() {
  return (
    <div className="grid gap-xl lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="min-w-0">
        {/* The space card's top: the inset photograph, then the separate panel. */}
        <div className="nf-sc nf-sc-top">
          <div className="nf-gallery--framed">
            <Skeleton radius="none" className="aspect-[3/2] w-full sm:aspect-[16/10]" />
          </div>
          <div className="nf-sc-top__panel nf-detail-lead">
            {/* Status row, title, location, then the hero price. */}
            <div className="flex flex-wrap items-center gap-xs">
              <Skeleton width="5.5rem" height="1.375rem" radius="sm" />
              <Skeleton width="4.5rem" height="1.375rem" radius="sm" />
            </div>
            <Skeleton className="mt-sm" width="80%" height="2.25rem" radius="sm" />
            <Skeleton className="mt-xs" width="45%" height="1rem" radius="sm" />
            <Skeleton className="mt-md" width="12rem" height="3rem" radius="sm" />
          </div>
        </div>

        <div className="mt-section-tight space-y-xs">
          <Skeleton height="0.875rem" radius="sm" />
          <Skeleton height="0.875rem" radius="sm" />
          <Skeleton width="72%" height="0.875rem" radius="sm" />
        </div>

        {/* The amenity grid. */}
        <div className="mt-lg grid grid-cols-2 gap-sm sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height="2.75rem" radius="sm" />
          ))}
        </div>
      </div>

      {/* The reserve panel, pinned beside the content from lg up. */}
      <aside className={panelClass({ className: "p-lg" })}>
        <Skeleton width="60%" height="1.5rem" radius="sm" />
        <Skeleton className="mt-md" height="3rem" radius="sm" />
        <Skeleton className="mt-sm" height="3rem" radius="sm" />
        <Skeleton className="mt-md" height="3.5rem" radius="sm" />
        <Skeleton className="mt-md" width="70%" height="0.8125rem" radius="sm" />
      </aside>
    </div>
  );
}
