import { Skeleton } from "@/components/ui/Skeleton";
import { CardRowsSkeleton, ListGroupSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * Rewards: the balance card, the invite, then the rows to the inner pages.
 *
 * SW12 (round 3): the page's own shape under the frame's large title, so
 * nothing moves when the read lands.
 */
export default function LoadingRewards() {
  return (
    <LoadingShell label="Loading your rewards" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="grid gap-block">
        <Skeleton height="10rem" radius="xl" />
        <CardRowsSkeleton rows={1} height="5rem" />
        <ListGroupSkeleton rows={3} />
      </div>
    </LoadingShell>
  );
}
