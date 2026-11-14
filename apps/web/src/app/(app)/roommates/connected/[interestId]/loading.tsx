import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

export default function LoadingConnected() {
  return (
    <LoadingShell label="Loading connection" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="nf-panel nf-panel--card block p-lg">
        <div className="flex items-center gap-md">
          <Skeleton circle width="3.5rem" />
          <div className="min-w-0 flex-1">
            <Skeleton width="55%" height="1.125rem" radius="sm" />
            <Skeleton className="mt-xs" width="40%" height="0.875rem" radius="sm" />
          </div>
        </div>
        <Skeleton className="mt-lg" height="3rem" radius="lg" />
      </div>
    </LoadingShell>
  );
}
