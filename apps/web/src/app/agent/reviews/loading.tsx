import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The wait, on your reviews.
 *
 * A review is a heading, a body of two or three lines and a reply beneath it, and the body is what sets the card height.
 */
export default function LoadingAgentReviews() {
  return (
    <AgentScreenSkeleton label="Loading your reviews">
      {/* The page frame's geometry, with its large title. */}
      <div className="nf-g1page" data-width="wide">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="space-y-sm">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="nf-panel nf-panel--card block p-md">
            <Skeleton width="38%" height="1.0625rem" radius="sm" />
            <Skeleton className="mt-sm" width="92%" height="0.875rem" radius="sm" />
            <Skeleton className="mt-xs" width="70%" height="0.875rem" radius="sm" />
          </div>
        ))}
      </div>
      </div>
    </AgentScreenSkeleton>
  );
}
