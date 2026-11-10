import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { Panel } from "@/components/ui/Panel";
import "./offers.css";

const wrap = "grid gap-lg px-gutter py-lg";

/** The offer flow's first screen, in its own shape: progress, heading, requirement rows, the amount field and the figure card. */
export function OfferFlowSkeleton() {
  return (
    <div className={wrap} role="status" aria-label="Loading the offer form">
      <Skeleton height={6} radius="pill" />
      <Skeleton height={14} width="30%" />
      <Skeleton height={34} width="55%" />
      <Panel variant="card" className="grid gap-sm p-card">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-between gap-md">
            <Skeleton height={24} width="50%" />
            <Skeleton height={32} width={72} radius="pill" />
          </div>
        ))}
      </Panel>
      <Skeleton height={56} radius="lg" />
      <Panel variant="card" className="grid gap-sm p-card">
        <Skeleton height={44} width="70%" />
        <Skeleton height={8} radius="pill" />
      </Panel>
    </div>
  );
}

/** My offers: tabs, filter chips, then cards on a phone or a table on a desktop, each in its real shape. */
export function OffersListSkeleton() {
  return (
    <div className={wrap} role="status" aria-label="Loading your offers">
      <Skeleton height={44} radius="lg" />
      <div className="flex gap-xs">
        {[64, 110, 72, 120].map((w, i) => (
          <Skeleton key={i} height={36} width={w} radius="pill" />
        ))}
      </div>
      <div className="nf-ofr-skeleton-cards grid gap-sm">
        {[0, 1, 2].map((i) => (
          <Panel key={i} variant="card" className="grid gap-sm p-card">
            <div className="flex items-center gap-sm">
              <Skeleton width={48} height={48} radius="lg" />
              <div className="grid flex-1 gap-xs">
                <Skeleton height={16} width="75%" />
                <Skeleton height={12} width="45%" />
              </div>
              <Skeleton height={26} width={84} radius="pill" />
            </div>
            <Skeleton height={28} width="45%" />
            <Skeleton height={8} radius="pill" />
          </Panel>
        ))}
      </div>
      <Panel flush className="nf-ofr-skeleton-table">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="nf-ofr-skeleton-row">
            <Skeleton width={48} height={48} radius="lg" />
            <Skeleton height={16} width="70%" />
            <Skeleton height={16} />
            <Skeleton height={26} radius="pill" />
            <Skeleton height={26} radius="pill" />
          </div>
        ))}
      </Panel>
    </div>
  );
}

/** The Deal Room: header, the four-answer strip, the rail, tabs and a card. */
export function DealRoomSkeleton() {
  return (
    <div className={wrap} role="status" aria-label="Loading the Deal Room">
      <div className="flex items-center gap-md">
        <Skeleton width={56} height={56} radius="lg" />
        <div className="grid flex-1 gap-xs">
          <Skeleton height={12} width="35%" />
          <Skeleton height={22} width="80%" />
          <Skeleton height={26} width={110} radius="pill" />
        </div>
      </div>
      <Panel variant="card" className="grid gap-sm p-card">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={22} />
        ))}
      </Panel>
      <div className="flex gap-lg">
        {[70, 90, 80, 80].map((w, i) => (
          <Skeleton key={i} height={20} width={w} />
        ))}
      </div>
      <Panel variant="card" className="grid gap-sm p-card">
        <Skeleton height={14} width="30%" />
        <Skeleton height={44} width="65%" />
        <Skeleton height={8} radius="pill" />
        <SkeletonText lines={3} />
      </Panel>
    </div>
  );
}
