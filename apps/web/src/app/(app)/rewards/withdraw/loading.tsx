import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * Withdraw: the minimum, the bank and account fields, then the one control.
 *
 * SW12 (round 3): the page's own shape under the frame's large title, so
 * nothing moves when the read lands.
 */
export default function LoadingRewardsWithdraw() {
  return (
    <LoadingShell label="Loading the withdrawal" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="grid gap-sm">
        <Skeleton width="70%" height="0.9375rem" radius="sm" />
        <div>
          <Skeleton width="30%" height="0.875rem" radius="sm" />
          <Skeleton className="mt-xs" height="3rem" radius="md" />
        </div>
        <div>
          <Skeleton width="30%" height="0.875rem" radius="sm" />
          <Skeleton className="mt-xs" height="3rem" radius="md" />
        </div>
      </div>
      <Skeleton className="mt-block" height="3.125rem" radius="md" />
    </LoadingShell>
  );
}
