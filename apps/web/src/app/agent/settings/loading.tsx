import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The wait, on your settings.
 *
 * Grouped rows, each a label above a value, which is the one shape every account surface on this platform shares.
 */
export default function LoadingAgentSettings() {
  return (
    <AgentScreenSkeleton label="Loading your settings">
      {/* The page frame's geometry, with its large title. */}
      <div className="nf-g1page">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="space-y-sm">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="nf-panel nf-panel--card block p-md">
            <Skeleton width="40%" height="1.0625rem" radius="sm" />
            <Skeleton className="mt-sm" width="62%" height="0.875rem" radius="sm" />
          </div>
        ))}
      </div>
      </div>
    </AgentScreenSkeleton>
  );
}
