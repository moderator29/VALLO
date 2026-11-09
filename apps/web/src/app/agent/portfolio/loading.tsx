import { Skeleton } from "@/components/ui/Skeleton";
import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on buildings and mandates (R3-17: one of the four agent screens
 * that waited on the generic rows in `app/agent/loading.tsx`).
 *
 * The page frame: the large title with Back and its line, no action beside
 * them (the generic title skeleton drew a button this page does not have),
 * then a column of
 * unit cards under a place name: a shape line and a let-or-vacant line.
 */
export default function LoadingAgentPortfolio() {
  return (
    <AgentScreenSkeleton label="Loading your buildings">
      <div className="nf-g1page">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="max-w-2xl">
        <Skeleton width="9rem" height="1.375rem" radius="sm" />
        <Skeleton className="mt-xs" width="70%" height="0.875rem" radius="sm" />
        <Skeleton className="mt-md" width="6rem" height="0.75rem" radius="xs" />
        <div className="mt-xs space-y-sm">
          {[0, 1, 2].map((i) => (
            <div key={i} className="nf-panel nf-panel--card p-panel">
              <Skeleton width="45%" height="1rem" radius="sm" />
              <Skeleton className="mt-2xs" width="75%" height="0.875rem" radius="sm" />
            </div>
          ))}
        </div>
      </div>
      </div>
    </AgentScreenSkeleton>
  );
}
