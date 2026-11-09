import { Skeleton } from "@/components/ui/Skeleton";
import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on a listing's status kit.
 *
 * The page frame (narrow): the large title with Back and the lede, then the
 * column (`max-w-md`, `gap-group`): the status picture at phone scale (9:16, at most 18rem wide, which is the
 * measurement that sets the page's height), the share pills, the numbers
 * line and the note.
 */
export default function LoadingListingStatus() {
  return (
    <AgentScreenSkeleton label="Loading the status picture">
      <div className="nf-g1page" data-width="narrow">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="flex max-w-md flex-col gap-group">
        <Skeleton radius="md" className="mx-auto aspect-[9/16] w-full max-w-[18rem]" />
        <div className="flex flex-col gap-row">
          <Skeleton height="3rem" radius="pill" />
          <Skeleton height="3rem" radius="pill" />
        </div>
        <Skeleton width="70%" height="0.875rem" radius="sm" />
        <Skeleton width="55%" height="0.75rem" radius="sm" />
      </div>
      </div>
    </AgentScreenSkeleton>
  );
}
