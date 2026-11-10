import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { FigureCardSkeleton } from "@/components/agent/intel/IntelSkeletons";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The wait, on one listing's week: the six stage tiles at the tile's own
 * rhythm, then the requests card, then the two actions.
 */
export default function LoadingListingWeek() {
  return (
    <AgentScreenSkeleton label="Loading this listing's week">
      <div className="nf-g1page">
        <PageHeaderSkeleton layout="large" subtitle />
        <Skeleton width="10rem" height="0.75rem" radius="sm" />
        <div className="nf-figure-tiles mt-sm">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="nf-kpi">
              <Skeleton width="60%" height="0.75rem" radius="sm" />
              <Skeleton className="mt-xs" width="3rem" height="1.75rem" radius="sm" />
              <Skeleton className="mt-xs" width="75%" height="0.75rem" radius="sm" />
            </div>
          ))}
        </div>
        <div className="mt-lg">
          <FigureCardSkeleton rows={0} />
        </div>
        <div className="mt-lg flex gap-sm">
          <Skeleton width="9rem" height="2.75rem" radius="md" />
          <Skeleton width="8rem" height="2.75rem" radius="md" />
        </div>
      </div>
    </AgentScreenSkeleton>
  );
}
