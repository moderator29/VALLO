import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { RoomCardSkeleton, RoommateCardSkeleton } from "@/components/roommates";
import { Skeleton } from "@/components/ui/Skeleton";

/** The wait, in discovery's shape: the switch, the search bar, the chips, the cards. */
export default function LoadingDiscover() {
  return (
    <LoadingShell label="Loading discover" className="mx-auto w-full max-w-6xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="nf-rmp">
        <Skeleton height="2.75rem" radius="md" />
        <Skeleton height="3rem" radius="xl" />
        <div className="nf-rm-grid">
          <RoommateCardSkeleton />
          <RoomCardSkeleton />
          <RoommateCardSkeleton />
          <RoomCardSkeleton />
        </div>
      </div>
    </LoadingShell>
  );
}
