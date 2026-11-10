import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The wait, on your messages.
 *
 * A conversation row is an avatar beside two lines, and the avatar sets the row height exactly as it does in the guest inbox.
 */
export default function LoadingAgentMessages() {
  return (
    <AgentScreenSkeleton label="Loading your messages">
      {/* The page frame's geometry, with its large title. */}
      <div className="nf-g1page" data-width="wide">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="space-y-sm">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="nf-panel nf-panel--card block p-md">
            <Skeleton width="42%" height="1.0625rem" radius="sm" />
            <Skeleton className="mt-sm" width="85%" height="0.875rem" radius="sm" />
            <Skeleton className="mt-xs" width="55%" height="0.875rem" radius="sm" />
          </div>
        ))}
      </div>
      </div>
    </AgentScreenSkeleton>
  );
}
