import { LOADING_OFFER_FORM } from "@/lib/offers/words";
import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { OfferFlowSkeleton } from "@/components/app/offers/Skeletons";

/** The wait on the offer flow: the shape of its first screen. */
export default function LoadingOffer() {
  return (
    <LoadingShell label={LOADING_OFFER_FORM}>
      <OfferFlowSkeleton />
    </LoadingShell>
  );
}
