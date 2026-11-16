import type { ReactNode } from "react";
import { SkeletonText } from "@/components/ui/Skeleton";
import { stateRole } from "@/lib/design/voice";

/**
 * THE LOADING STATE OF THE ONE STATE KIT (`State kind="loading"`), on its own.
 *
 * `State` draws it by calling this, so there is still one drawing. It lives in
 * its own module because loading is the only kind that needs no glyph, no
 * plate, no art and no actions, and the kit's other kinds import all of those
 * (the icon alias tables, `IconPlate`, `Icon3D`, `EmptyActions`).
 *
 * MEASURED, 16 November 2026. `LoadingShell` (components/app/ScreenSkeleton)
 * imported the whole kit for this one branch, and `SignalHold`, which every
 * error boundary now draws while a page is tried again, imports
 * `LoadingShell`. So the `(site)` boundary chunk, loaded on every public page,
 * carried the icon tables and the plate a second time: 22,970 bytes of script
 * where it had carried 1,977, and the root boundary's group carried a 31 KB
 * chunk of icon tables beside its own. The weight gate read /check, the scams
 * guide and the docs over budget. Loading reaches nothing it does not draw
 * now: the `(site)` boundary chunk is 9,665 bytes, and /check went from 457 KB
 * to 441 on the same instrument.
 *
 * Server-safe: no hooks, no client boundary.
 */
export function StateLoading({
  title,
  className,
  children,
  "data-testid": testId,
}: {
  /** Read out, not shown: the live region announces it. */
  title: string;
  className?: string | undefined;
  /** The route's own skeleton; without one, three lines stand in. */
  children?: ReactNode;
  "data-testid"?: string | undefined;
}) {
  /* The title is read out, not shown: a live region announces its text, and
     an aria-label on a status region is not reliably spoken. A route that
     draws its own skeleton (the shape of the page that is coming) passes it
     as children; without one, three lines stand in. */
  return (
    <div
      data-testid={testId}
      data-state-kind="loading"
      role={stateRole("loading")}
      aria-busy="true"
      aria-live="polite"
      className={children ? className : `flex flex-col px-lg py-section ${className ?? ""}`}
    >
      <span className="sr-only">{title}</span>
      {children ?? <SkeletonText lines={3} />}
    </div>
  );
}
