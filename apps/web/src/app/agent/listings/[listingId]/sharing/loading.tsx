import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The wait, on a listing's "Good for sharing" page: the page frame's large
 * title with Back and its lede,
 * the one toggle row, and the "up to N people" stepper under it. Its own
 * shape, not `/agent/listings`'s filter rail and photograph rows (X2, point
 * 12), so nothing moves when the read lands.
 */
export default function LoadingSharing() {
  return (
    <AgentScreenSkeleton label="Loading the sharing settings">
      <div className="nf-g1page" data-width="narrow">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="flex max-w-md flex-col gap-group">
        <Skeleton height="4.5rem" radius="lg" />
        <Skeleton height="4.5rem" radius="lg" />
        <Skeleton width="10rem" height="3rem" radius="md" />
      </div>
      </div>
    </AgentScreenSkeleton>
  );
}
