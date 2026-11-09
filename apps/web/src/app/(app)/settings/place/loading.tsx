import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on your place.
 *
 * A state and a local government, both read from the profile, both pickers at a real control height rather than a line of text.
 */
export default function LoadingPlaceSettings() {
  return (
    <LoadingShell label="Loading your place" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" />
      <div className="space-y-sm">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="nf-panel nf-panel--card block p-md">
            <Skeleton width="40%" height="1.0625rem" radius="sm" />
            <Skeleton className="mt-xs" width="66%" height="0.875rem" radius="sm" />
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}
