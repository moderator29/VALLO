import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * Price Check: the intro, then the four numbered questions.
 *
 * SW12 (round 3): the page's own shape under the frame's large title, so
 * nothing moves when the read lands.
 */
export default function LoadingPrice() {
  return (
    <LoadingShell label="Loading Price Check" className="mx-auto w-full max-w-3xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="grid gap-sm">
        <Skeleton width="100%" height="0.9375rem" radius="sm" />
        <Skeleton width="85%" height="0.9375rem" radius="sm" />
      </div>
      <div className="mt-block grid gap-md">
        <div>
          <Skeleton width="30%" height="0.875rem" radius="sm" />
          <Skeleton className="mt-xs" height="3rem" radius="md" />
        </div>
        <div>
          <Skeleton width="30%" height="0.875rem" radius="sm" />
          <Skeleton className="mt-xs" height="3rem" radius="md" />
        </div>
        <div>
          <Skeleton width="30%" height="0.875rem" radius="sm" />
          <Skeleton className="mt-xs" height="3rem" radius="md" />
        </div>
        <Skeleton height="12rem" radius="lg" />
      </div>
    </LoadingShell>
  );
}
