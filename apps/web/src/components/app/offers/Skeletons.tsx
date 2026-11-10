import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { Panel } from "@/components/ui/Panel";

const wrap = "grid gap-lg px-gutter py-lg";

/** The offer flow's first screen, in its own shape. */
export function OfferFlowSkeleton() {
  return (
    <div className={wrap} role="status" aria-label="Loading the offer form">
      <Skeleton height={44} width="40%" />
      <Panel variant="card" className="p-card">
        <SkeletonText lines={3} />
      </Panel>
      <Skeleton height={56} />
      <Skeleton height={96} />
    </div>
  );
}

/** My offers: tabs, filters and three cards. */
export function OffersListSkeleton() {
  return (
    <div className={wrap} role="status" aria-label="Loading your offers">
      <Skeleton height={40} width="60%" />
      <Skeleton height={36} />
      {[0, 1, 2].map((i) => (
        <Panel key={i} variant="card" className="p-card">
          <SkeletonText lines={3} />
        </Panel>
      ))}
    </div>
  );
}

/** The Deal Room: header, tracker and a panel. */
export function DealRoomSkeleton() {
  return (
    <div className={wrap} role="status" aria-label="Loading the Deal Room">
      <div className="flex items-center gap-md">
        <Skeleton width={56} height={56} radius="lg" />
        <div className="grid flex-1 gap-xs">
          <Skeleton height={14} width="30%" />
          <Skeleton height={20} width="80%" />
        </div>
      </div>
      <Skeleton height={36} />
      <Panel variant="card" className="p-card">
        <SkeletonText lines={4} />
      </Panel>
      <Panel variant="card" className="p-card">
        <SkeletonText lines={3} />
      </Panel>
    </div>
  );
}
