import { SpaceCardSkeleton } from "@/components/ui/space-card/SpaceCardSkeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait on restaurant discovery: header, then the grid at card size.
 *
 * The cards are `SpaceCardSkeleton`, which is the shape of the `SpaceCard`
 * every restaurant row lands as. It was `SkeletonCard`, the listing card's
 * shape, whose photograph is 4:3 against the space card's 16:10: measured in
 * Chromium, dark and light, 267px reserved against 213 landed at 390 and 245
 * against 194 at 360.
 */
export default function LoadingRestaurants() {
  return (
    <LoadingShell label="Loading restaurants" className="mx-auto max-w-5xl">
      <PageHeaderSkeleton subtitle />
      <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <SpaceCardSkeleton body="venue" />
          </li>
        ))}
      </ul>
    </LoadingShell>
  );
}
