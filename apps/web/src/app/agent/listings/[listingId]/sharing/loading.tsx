import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The wait, on a listing's "Good for sharing" page: the title and its lede,
 * the one toggle row, and the "up to N people" stepper under it. Its own
 * shape, not `/agent/listings`'s filter rail and photograph rows (X2, point
 * 12), so nothing moves when the read lands.
 */
export default function LoadingSharing() {
  return (
    <AgentScreenSkeleton label="Loading the sharing settings">
      <div className="mx-auto flex max-w-2xl flex-col gap-group py-lg">
        <div>
          <Skeleton width="14rem" height="1.75rem" radius="sm" />
          <Skeleton className="mt-inline" width="20rem" height="2.5rem" radius="sm" />
        </div>
        <Skeleton height="4.5rem" radius="lg" />
        <Skeleton height="4.5rem" radius="lg" />
        <Skeleton width="10rem" height="3rem" radius="md" />
      </div>
    </AgentScreenSkeleton>
  );
}
