import { Skeleton } from "@/components/ui/Skeleton";
import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on a listing's calendar.
 *
 * A month grid is six rows of seven, and it is the one placeholder on this
 * platform where the shape matters more than the content: an agent opens this
 * to close a night, and a grid that arrives a different size from the one that
 * was drawn moves the night they were reaching for.
 */
export default function LoadingCalendar() {
  return (
    <AgentScreenSkeleton label="Loading the calendar">
      {/* The page frame's geometry (wide), with its large title and line. */}
      <div className="nf-g1page" data-width="wide">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="nf-panel nf-panel--card block p-md">
        <div className="mb-sm flex items-center justify-between">
          <Skeleton width="9rem" height="1.25rem" radius="sm" />
          <Skeleton width="6rem" height="2.75rem" radius="pill" />
        </div>
        <div className="grid grid-cols-7 gap-xs">
          {Array.from({ length: 42 }, (_, i) => (
            <Skeleton key={i} height="2.75rem" radius="md" />
          ))}
        </div>
      </div>
      </div>
    </AgentScreenSkeleton>
  );
}
