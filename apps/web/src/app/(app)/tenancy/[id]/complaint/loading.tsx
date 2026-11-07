import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait for a tenancy file: the header, the money block and two report
 * cards, in the shapes they arrive in, so nothing jumps when the file lands.
 */
export default function LoadingComplaint() {
  return (
    <LoadingShell label="Loading the complaint pack">
      <PageHeaderSkeleton layout="large" />
      <div className="mt-md space-y-xs">
        <Skeleton width="70%" height="1.25rem" radius="sm" />
        <Skeleton width="45%" height="0.9375rem" radius="sm" />
      </div>
      <div className="mt-lg space-y-xs">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height="0.9375rem" radius="sm" />
        ))}
      </div>
      <div className="mt-lg grid gap-md sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="nf-panel nf-panel--card block space-y-xs p-md">
            <Skeleton width="40%" height="1rem" radius="sm" />
            {Array.from({ length: 8 }, (_, j) => (
              <Skeleton key={j} height="0.875rem" radius="sm" />
            ))}
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}
