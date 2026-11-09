import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/** The wait on the move-in ledger: the header, the summary, the rows. */
export default function LoadingMoveIn() {
  return (
    <LoadingShell label="Loading the move-in cost">
      <PageHeaderSkeleton layout="large" />
      <SkeletonCard />
      <div className="mt-md space-y-sm">
        <Skeleton height="3rem" radius="md" />
        <Skeleton height="3rem" radius="md" />
        <Skeleton height="3rem" radius="md" />
      </div>
    </LoadingShell>
  );
}
