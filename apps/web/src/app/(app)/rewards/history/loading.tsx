import { ListGroupSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * Rewards history: one list of what was earned and paid.
 *
 * SW12 (round 3): the page's own shape under the frame's large title, so
 * nothing moves when the read lands.
 */
export default function LoadingRewardsHistory() {
  return (
    <LoadingShell label="Loading your rewards history" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <ListGroupSkeleton rows={5} label={false} />
    </LoadingShell>
  );
}
