import { Skeleton } from "@/components/ui/Skeleton";
import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on incoming bookings.
 *
 * The screen an agent checks most often and the one where the wait is worst
 * understood: a blank column looks exactly like "no new bookings", which is the
 * single most expensive wrong impression this product can give a host.
 *
 * The tab strip is drawn at its real 44px so the list below it does not jump
 * once the counts resolve.
 */
export default function LoadingAgentBookings() {
  return (
    <AgentScreenSkeleton label="Loading your bookings">
      {/* The page frame's geometry (wide), with its large title and lede. */}
      <div className="nf-g1page" data-width="wide">
      <PageHeaderSkeleton layout="large" subtitle />

      <Skeleton className="mb-md" width="18rem" height="2.75rem" radius="pill" />

      <ul className="space-y-sm">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="nf-panel nf-panel--card block overflow-hidden p-0">
            <div className="p-md sm:p-md">
              <div className="flex items-start justify-between gap-xs">
                <div className="min-w-0 flex-1">
                  <Skeleton width="40%" height="0.9375rem" radius="sm" />
                  <Skeleton className="mt-xs" width="65%" height="0.8125rem" radius="sm" />
                </div>
                <Skeleton width="5rem" height="1.25rem" radius="pill" className="shrink-0" />
              </div>
              {/* The dates row and the accept / decline pair beneath it. */}
              <Skeleton className="mt-sm" width="55%" height="0.8125rem" radius="sm" />
              <div className="mt-md flex gap-sm">
                <Skeleton height="2.75rem" radius="pill" />
                <Skeleton height="2.75rem" radius="pill" />
              </div>
            </div>
          </li>
        ))}
      </ul>
      </div>
    </AgentScreenSkeleton>
  );
}
