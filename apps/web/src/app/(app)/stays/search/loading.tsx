import { Skeleton } from "@/components/ui/Skeleton";
import { SpaceCardSkeleton } from "@/components/ui/space-card/SpaceCardSkeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait on stay search: header, the search card, a chip row, then cards.
 *
 * The cards are `SpaceCardSkeleton`, the stand-in for the `SpaceCard` this
 * shelf actually lands (`StayCard` draws one for every row). It was
 * `SkeletonCard`, which is the LISTING card's shape: its photograph is 4:3
 * where a space card's is 16:10, and its body is a title, a three fact row
 * and a price rather than the space card's head row and two lines. Measured
 * in Chromium, dark and light: the reserved photograph was 267px against the
 * 213 that lands at 390, and 245 against 194 at 360, so every card shrank as
 * the data arrived.
 */
export default function LoadingStaysSearch() {
  return (
    <LoadingShell label="Loading stays" className="mx-auto max-w-5xl">
      <PageHeaderSkeleton subtitle />
      <div className="flex flex-col gap-inline">
        <Skeleton height="3rem" radius="lg" />
        <Skeleton height="3.5rem" radius="lg" />
        <Skeleton height="3rem" radius="pill" />
      </div>
      <div className="mt-block flex gap-xs">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} width="5.5rem" height="2.75rem" radius="pill" />
        ))}
      </div>
      <ul className="mt-block grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <SpaceCardSkeleton body="stay" />
          </li>
        ))}
      </ul>
    </LoadingShell>
  );
}
