import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

export default function LoadingPro() {
  return (
    <LoadingShell label="Loading plans" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="space-y-md">
        <div className="nf-panel nf-panel--card block p-lg">
          <Skeleton width="40%" height="1.5rem" radius="sm" />
          <Skeleton className="mt-sm" width="25%" height="2rem" radius="sm" />
          <Skeleton className="mt-md" width="90%" height="0.875rem" radius="sm" />
          <Skeleton className="mt-xs" width="75%" height="0.875rem" radius="sm" />
          <Skeleton className="mt-xs" width="60%" height="0.875rem" radius="sm" />
          <Skeleton className="mt-lg" height="3.25rem" radius="lg" />
        </div>
        <div className="nf-panel nf-panel--card block p-lg">
          <Skeleton width="40%" height="1.5rem" radius="sm" />
          <Skeleton className="mt-sm" width="25%" height="2rem" radius="sm" />
          <Skeleton className="mt-md" width="90%" height="0.875rem" radius="sm" />
          <Skeleton className="mt-xs" width="75%" height="0.875rem" radius="sm" />
          <Skeleton className="mt-lg" height="3.25rem" radius="lg" />
        </div>
      </div>
    </LoadingShell>
  );
}
