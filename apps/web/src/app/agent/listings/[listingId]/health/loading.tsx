import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The wait, on a listing's health: the head, the one-line state, the six
 * explanation rows at a two-line row's height, then two recommendation cards.
 */
export default function LoadingListingHealth() {
  return (
    <AgentScreenSkeleton label="Loading this listing's health">
      <div className="nf-g1page">
        <PageHeaderSkeleton layout="large" subtitle />
        <Skeleton className="mb-lg" width="80%" height="0.9375rem" radius="sm" />
        <Skeleton width="16rem" height="1.375rem" radius="sm" />
        <div className="mt-md space-y-xs">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height="3.75rem" radius="md" />
          ))}
        </div>
        <Skeleton className="mt-lg" width="7rem" height="1.375rem" radius="sm" />
        <div className="mt-sm space-y-sm">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} height="5.5rem" radius="lg" />
          ))}
        </div>
      </div>
    </AgentScreenSkeleton>
  );
}
