import { Skeleton } from "@/components/ui/Skeleton";
import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on a stay's arrival charges.
 *
 * The page frame: the large title with Back and the listing's name under
 * it, then the lede and the charges form, a few labelled fields and the
 * save pill.
 */
export default function LoadingListingArrival() {
  return (
    <AgentScreenSkeleton label="Loading the arrival charges">
      <div className="nf-g1page">
        <PageHeaderSkeleton layout="large" subtitle />
        <Skeleton width="90%" height="1rem" radius="sm" />
        <div className="mt-lg space-y-md">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i}>
              <Skeleton width="8rem" height="0.875rem" radius="sm" />
              <Skeleton className="mt-xs" height="3.25rem" radius="lg" />
            </div>
          ))}
          <Skeleton height="3rem" radius="pill" />
        </div>
      </div>
    </AgentScreenSkeleton>
  );
}
