import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { RoomCardSkeleton, RoommateCardSkeleton } from "@/components/roommates";
import { Skeleton } from "@/components/ui/Skeleton";

/** The wait, in the home's own shape: the hero, the journeys, then a row of cards. */
export default function LoadingRoommates() {
  return (
    <LoadingShell label="Loading Vallo Roommates" className="mx-auto w-full max-w-6xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="nf-rmp">
        <Skeleton height="18rem" radius="xl" />
        <div className="nf-rm-journeys">
          <Skeleton height="9rem" radius="lg" />
          <Skeleton height="9rem" radius="lg" />
          <Skeleton height="9rem" radius="lg" />
          <Skeleton height="9rem" radius="lg" />
        </div>
        <div className="nf-rm-grid">
          <RoommateCardSkeleton />
          <RoomCardSkeleton />
          <RoommateCardSkeleton />
        </div>
      </div>
    </LoadingShell>
  );
}
