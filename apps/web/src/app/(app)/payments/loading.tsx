import { CardRowsSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";
import { NairaFacePreload } from "@/components/app/NairaFacePreload";

/**
 * Payments, before the history arrives (details pass): the title, the hero
 * figure centred as `HistoryHero` draws it, then the rows. It replaces the
 * group's generic rows, which had no hero and so jumped when it landed.
 */
export default function LoadingPayments() {
  return (
    <LoadingShell label="Loading your payments" className="nf-page grid grid-cols-1 gap-md nf-history">
      {/* A money screen: the naira sign's face arrives with the shell. */}
      <NairaFacePreload />
      <PageHeaderSkeleton layout="large" />
      <div className="mt-inline flex flex-col items-center py-block">
        <Skeleton width="7rem" height="0.8125rem" radius="sm" />
        <Skeleton className="mt-xs" width="11rem" height="2.5rem" radius="md" />
        <Skeleton className="mt-xs" width="9rem" height="0.8125rem" radius="sm" />
      </div>
      <CardRowsSkeleton rows={4} height="2.75rem" className="mt-block" />
    </LoadingShell>
  );
}
