import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the saved board.
 *
 * IT WAS RESERVING THE BOARD THAT WAS REPLACED.
 *
 * Saved used to be a wall of `ListingCard`s, and this file drew four
 * `SkeletonCard`s in a two column grid to hold their space. The board is now
 * a run of SHELVES (`SavedShelf.tsx`): one full width row each, a 64px
 * framed thumbnail, the name and area beside it, the figure and its status
 * right aligned, and a lit ledge under the row. Measured in Chromium with
 * four saved places: a landed shelf is 98px tall and the full width of the
 * board at 360, 390 and 440, and 106px at 1280. The skeleton it replaced
 * drew 367px cards at 390 and TWO COLUMNS from 640px up, so the wait was
 * nearly four times the height of the board and a different shape from it.
 *
 * The stand-in is now drawn from the board's own class names rather than
 * from a copy of its measurements, which is how `HomeLists` has always done
 * it: `.nf-shelves` sets the gap, `.nf-shelf` sets the row's grid, padding,
 * corner and ledge, so the two cannot drift again without the board itself
 * changing shape.
 */
export default function LoadingSaved() {
  return (
    <LoadingShell label="Loading your saved places" className="mx-auto w-full max-w-3xl">
      <PageHeaderSkeleton layout="large" />

      <ul className="nf-shelves" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i}>
            <div className="nf-shelf">
              <span className="nf-shelf__frame">
                <span className="nf-shelf__thumb">
                  <Skeleton className="h-full w-full" radius="none" />
                </span>
              </span>
              <span className="nf-shelf__words">
                <Skeleton width="70%" height="1rem" radius="sm" />
                <Skeleton width="45%" height="0.75rem" radius="sm" />
              </span>
              <span className="nf-shelf__value">
                <Skeleton width="4.5rem" height="1rem" radius="sm" />
                <Skeleton width="3rem" height="0.6875rem" radius="sm" />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </LoadingShell>
  );
}
