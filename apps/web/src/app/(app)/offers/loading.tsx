import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { OffersListSkeleton } from "@/components/app/offers/Skeletons";

/** The wait on My offers: tabs, filters and cards. */
export default function LoadingOffers() {
  return (
    <LoadingShell label="Loading your offers">
      <OffersListSkeleton />
    </LoadingShell>
  );
}
