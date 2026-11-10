import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The wait, on your verification.
 *
 * A ladder of four rungs, each a card with a state and a next step, so the placeholder is four cards rather than a list of lines.
 */
export default function LoadingAgentVerification() {
  return (
    <AgentScreenSkeleton label="Loading your verification">
      {/* The page frame's geometry, with its large title. */}
      <div className="nf-g1page" data-width="wide">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="space-y-sm">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="nf-panel nf-panel--card block p-md">
            <Skeleton width="45%" height="1.0625rem" radius="sm" />
            <Skeleton className="mt-sm" width="80%" height="0.875rem" radius="sm" />
            <Skeleton className="mt-xs" width="60%" height="0.875rem" radius="sm" />
          </div>
        ))}
      </div>
      </div>
    </AgentScreenSkeleton>
  );
}
