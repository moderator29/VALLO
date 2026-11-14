import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

export default function LoadingReviewDetail() {
  return (
    <LoadingShell label="Loading review" className="mx-auto grid max-w-2xl gap-md px-gutter">
      <PageHeaderSkeleton />
      <div className="nf-panel nf-panel--card block p-lg">
        <Skeleton width="50%" height="1.25rem" radius="sm" />
        <Skeleton className="mt-sm" width="80%" height="0.875rem" radius="sm" />
        <Skeleton className="mt-sm" width="65%" height="0.875rem" radius="sm" />
        <Skeleton className="mt-md" height="3rem" radius="lg" />
      </div>
    </LoadingShell>
  );
}
