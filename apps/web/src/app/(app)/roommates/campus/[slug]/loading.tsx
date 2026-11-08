import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { RoomCardSkeleton } from "@/components/roommates";
import { Skeleton } from "@/components/ui/Skeleton";

/** The wait, in a school's shape: the header with its counts, then rooms near it. */
export default function LoadingCampus() {
  return (
    <LoadingShell label="Loading school" className="mx-auto w-full max-w-6xl">
      <PageHeaderSkeleton layout="large" />
      <div className="nf-rmp">
        <Skeleton height="11rem" radius="xl" />
        <div className="nf-rm-grid">
          <RoomCardSkeleton />
          <RoomCardSkeleton />
          <RoomCardSkeleton />
        </div>
      </div>
    </LoadingShell>
  );
}
