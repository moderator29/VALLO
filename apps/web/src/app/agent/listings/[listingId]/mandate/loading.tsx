import { Skeleton } from "@/components/ui/Skeleton";
import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on a listing's mandate.
 *
 * The page frame (narrow): the large title with Back and the lede, then the
 * column (`max-w-md`, `gap-group`): why it matters, a status line, then the
 * mandate form (the principal's name, the dates, the document) and its pill.
 */
export default function LoadingListingMandate() {
  return (
    <AgentScreenSkeleton label="Loading the mandate">
      <div className="nf-g1page" data-width="narrow">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="flex max-w-md flex-col gap-group">
        <Skeleton width="70%" height="0.875rem" radius="sm" />
        <Skeleton width="80%" height="0.875rem" radius="sm" />
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
