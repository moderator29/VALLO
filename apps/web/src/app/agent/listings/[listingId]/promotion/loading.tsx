import { AgentScreenSkeleton } from "@/components/agent/AgentScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The wait, on a listing's promotion results: the page frame's large title
 * with Back and its lede, the notice card, the section label, then the ten figure rows at a
 * one-line row's height (44px, as `.nf-promo-results__row` draws them), the
 * split note, and the four tiers of the purchase section. Without
 * this file the wait borrowed `/agent/listings`'s own skeleton, a filter rail
 * and photograph rows this page does not have (X2, point 12).
 */
export default function LoadingPromotionResults() {
  return (
    <AgentScreenSkeleton label="Loading this listing's promotion results">
      <div className="nf-g1page">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="flex flex-col gap-group">
        <Skeleton height="9rem" radius="lg" />
        <div>
          <Skeleton width="8rem" height="1rem" radius="sm" />
          <div className="mt-sm space-y-xs">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} height="2.75rem" radius="sm" />
            ))}
          </div>
        </div>
        <Skeleton width="20rem" height="2.5rem" radius="sm" />
        <div>
          <Skeleton width="8rem" height="1rem" radius="sm" />
          <div className="mt-sm space-y-xs">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height="5.5rem" radius="sm" />
            ))}
          </div>
        </div>
      </div>
      </div>
    </AgentScreenSkeleton>
  );
}
