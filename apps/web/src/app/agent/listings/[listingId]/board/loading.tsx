import { Skeleton } from "@/components/ui/Skeleton";
import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on a listing's board.
 *
 * The page frame (narrow): the large title with Back and its line, then
 * `BoardPrint`'s column (`max-w-md`): the board preview (a tall bordered card holding the banner, the shape, the
 * code), the line about phones, then the two full-width pills with a caption
 * under each.
 */
export default function LoadingListingBoard() {
  return (
    <AgentScreenSkeleton label="Loading the board">
      <div className="nf-g1page" data-width="narrow">
        <PageHeaderSkeleton layout="large" subtitle />
        <div className="max-w-md">
        <Skeleton height="17rem" radius="md" />
        <Skeleton className="mt-group" width="75%" height="0.875rem" radius="sm" />
        <div className="mt-group flex flex-col gap-row">
          <Skeleton height="3rem" radius="pill" />
          <Skeleton width="70%" height="0.75rem" radius="sm" />
          <Skeleton height="3rem" radius="pill" />
          <Skeleton width="60%" height="0.75rem" radius="sm" />
        </div>
        </div>
      </div>
    </AgentScreenSkeleton>
  );
}
