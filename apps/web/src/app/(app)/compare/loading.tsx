import { Skeleton } from "@/components/ui/Skeleton";
import { CardRowsSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * Compare places: the lede, then the side by side columns.
 *
 * SW12 (round 3): the page's own shape under the frame's large title, so
 * nothing moves when the read lands.
 */
export default function LoadingCompare() {
  return (
    <LoadingShell label="Loading the comparison" className="mx-auto w-full max-w-5xl">
      <PageHeaderSkeleton layout="large" />
      <Skeleton width="80%" height="0.9375rem" radius="sm" />
      <div className="mt-md grid grid-cols-2 gap-sm">
        <Skeleton height="9rem" radius="lg" />
        <Skeleton height="9rem" radius="lg" />
      </div>
      <CardRowsSkeleton rows={5} height="3rem" className="mt-md" />
    </LoadingShell>
  );
}
