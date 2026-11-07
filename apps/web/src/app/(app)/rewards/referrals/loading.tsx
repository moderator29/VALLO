import { Skeleton } from "@/components/ui/Skeleton";
import { ListGroupSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * Your referrals: one row per person, where they stand.
 *
 * SW12 (round 3): the page's own shape under the frame's large title, so
 * nothing moves when the read lands.
 */
export default function LoadingReferrals() {
  return (
    <LoadingShell label="Loading your referrals" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <ListGroupSkeleton rows={5} label={false} />
    </LoadingShell>
  );
}
