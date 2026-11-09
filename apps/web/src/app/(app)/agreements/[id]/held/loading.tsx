import { Skeleton } from "@/components/ui/Skeleton";
import { CardRowsSkeleton, LoadingShell, PageHeaderSkeleton, SummaryCardSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * Money held: the agreement in brief, the figure, then the one control.
 *
 * SW12 (round 3): the page's own shape under the frame's large title, so
 * nothing moves when the read lands.
 */
export default function LoadingHeld() {
  return (
    <LoadingShell label="Loading this payment" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" />
      <SummaryCardSkeleton />
      <CardRowsSkeleton rows={2} className="mt-block" />
      <Skeleton className="mt-block" height="3.125rem" radius="md" />
    </LoadingShell>
  );
}
