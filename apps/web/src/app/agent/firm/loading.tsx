import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/** The wait, on the firm desk: listings, team and the enquiry record, at their sizes. */
export default function LoadingFirmDesk() {
  return (
    <AgentScreenSkeleton label="Loading the firm desk">
      {/* The page frame's geometry (wide), with its large title and lede. */}
      <div className="nf-g1page" data-width="wide">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="space-y-lg">
        {[5, 3, 4].map((rows, i) => (
          <div key={i} className="nf-panel nf-panel--card block p-md sm:p-panel">
            <Skeleton width="9rem" height="1.125rem" radius="sm" />
            <div className="mt-md space-y-sm">
              {Array.from({ length: rows }, (_, row) => (
                <Skeleton key={row} height="1.5rem" radius="sm" />
              ))}
            </div>
          </div>
        ))}
      </div>
      </div>
    </AgentScreenSkeleton>
  );
}
