import { Skeleton } from "@/components/ui/Skeleton";
import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on earnings.
 *
 * Money screens are where a blank pause is read as a fault rather than a delay:
 * an agent who taps Earnings and sees nothing assumes the figure is missing, not
 * that it is coming. The stat row and the ledger block are both drawn at their
 * real sizes so the first number to land does so in the box already reserved
 * for it.
 */
export default function LoadingAgentEarnings() {
  return (
    <AgentScreenSkeleton label="Loading your earnings">
      {/* The page frame's geometry (wide), with its large title and lede. */}
      <div className="nf-g1page" data-width="wide">
      <PageHeaderSkeleton layout="large" subtitle />

      <div className="space-y-lg">
        <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="nf-panel nf-panel--card flex flex-col gap-xs p-md sm:gap-sm sm:p-md">
              <Skeleton width="2.25rem" height="2.25rem" radius="md" className="sm:hidden" />
              <Skeleton width="2.5rem" height="2.5rem" radius="md" className="hidden sm:block" />
              <Skeleton width="75%" height="0.75rem" radius="sm" />
              <Skeleton width="55%" height="1.25rem" radius="sm" />
            </div>
          ))}
        </div>

        {/* The ledger. Header row plus rows at the table's real rhythm. */}
        <div className="nf-panel nf-panel--card block p-md sm:p-panel">
          <Skeleton width="10rem" height="1.125rem" radius="sm" />
          <div className="mt-md space-y-sm">
            <Skeleton height="0.75rem" radius="sm" />
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} height="1.75rem" radius="sm" />
            ))}
          </div>
        </div>
      </div>
      </div>
    </AgentScreenSkeleton>
  );
}
