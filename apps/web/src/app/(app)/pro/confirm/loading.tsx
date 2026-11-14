import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

export default function LoadingConfirm() {
  return (
    <LoadingShell label="Loading confirmation" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton />
      <div className="nf-panel nf-panel--card block p-lg">
        <Skeleton width="50%" height="1.25rem" radius="sm" />
        <Skeleton className="mt-md" width="80%" height="0.875rem" radius="sm" />
        <Skeleton className="mt-xs" width="65%" height="0.875rem" radius="sm" />
        <Skeleton className="mt-lg" height="3.25rem" radius="lg" />
      </div>
    </LoadingShell>
  );
}
