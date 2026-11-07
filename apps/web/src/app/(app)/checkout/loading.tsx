import { Skeleton } from "@/components/ui/Skeleton";
import { CardRowsSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * Checkout for a room: the room card, the dates, then the request.
 *
 * SW12 (round 3): the page's own shape under the frame's large title, so
 * nothing moves when the read lands.
 */
export default function LoadingRoomRequest() {
  return (
    <LoadingShell label="Loading the room" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <Skeleton height="11rem" radius="xl" />
      <CardRowsSkeleton rows={2} className="mt-block" />
      <Skeleton className="mt-block" height="3.125rem" radius="md" />
    </LoadingShell>
  );
}
