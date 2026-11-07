import { Skeleton } from "@/components/ui/Skeleton";
import { CardRowsSkeleton, LoadingShell, PageHeaderSkeleton, SummaryCardSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * A table deposit: what it is for, the figure, then the way to pay.
 *
 * SW12 (round 3): the page's own shape under the frame's large title, so
 * nothing moves when the read lands.
 */
export default function LoadingDeposit() {
  return (
    <LoadingShell label="Loading the table deposit" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" />
      <SummaryCardSkeleton />
      <CardRowsSkeleton rows={2} className="mt-block" />
      <Skeleton className="mt-block" height="3.125rem" radius="md" />
    </LoadingShell>
  );
}
