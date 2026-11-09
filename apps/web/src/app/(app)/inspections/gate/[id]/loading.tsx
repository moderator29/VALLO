import { Skeleton } from "@/components/ui/Skeleton";
import { CardRowsSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The gate code: the code card, then what to do with it.
 *
 * SW12 (round 3): the page's own shape under the frame's large title, so
 * nothing moves when the read lands.
 */
export default function LoadingGate() {
  return (
    <LoadingShell label="Loading the gate code" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" />
      <Skeleton height="9rem" radius="xl" />
      <CardRowsSkeleton rows={2} className="mt-block" />
    </LoadingShell>
  );
}
