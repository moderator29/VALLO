import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell } from "@/components/app/ScreenSkeleton";

/**
 * THE STEP FRAME'S WAIT (SW12, round 3). A route whose page opens a flow on
 * `StepFrame` (support/new, the registrations, the professional application,
 * the workspace chooser) waits in the frame's own geometry: the same
 * full-screen overlay classes, the round back and close, the 3px bar, the
 * eyebrow, the title, the subtitle, `rows` answer cards and the sticky foot
 * with its count and Continue. Built from the frame's own classes
 * (`grade1.css`, `.nf-g1step*`), so the real frame lands on it with nothing
 * moving.
 */
export function StepFrameSkeleton({
  label,
  rows = 3,
  art = false,
  eyebrow = true,
}: {
  label: string;
  rows?: number;
  /** The step's object above the eyebrow (the chooser). */
  art?: boolean;
  eyebrow?: boolean;
}) {
  return (
    <LoadingShell label={label}>
      <div className="nf-g1step nf-g1step--overlay" aria-hidden="true" data-testid="step-frame-skeleton">
        <div className="nf-g1step__top">
          <div className="nf-g1step__bar">
            <Skeleton circle width="2.75rem" />
            <span />
            <Skeleton circle width="2.75rem" />
          </div>
          <div className="nf-g1step__progress">
            <span className="nf-g1step__progress-fill" style={{ transform: "scaleX(0.25)" }} />
          </div>
        </div>
        <div className="nf-g1step__main">
          <div className="nf-g1step__page">
            {art ? <Skeleton width="3.5rem" height="3.5rem" radius="lg" className="mb-md" /> : null}
            {eyebrow ? <Skeleton width="7rem" height="0.75rem" radius="sm" /> : null}
            <Skeleton className="mt-sm" width="78%" height="2rem" radius="sm" />
            <Skeleton className="mt-xs" width="92%" height="1rem" radius="sm" />
            <div className="nf-g1step__content">
              {Array.from({ length: rows }, (_, i) => (
                <Skeleton key={i} height="4.5rem" radius="xl" />
              ))}
            </div>
          </div>
        </div>
        <div className="nf-g1step__foot">
          <Skeleton width="5.5rem" height="0.875rem" radius="sm" />
          <div className="nf-g1step__actions">
            <Skeleton width="7.5rem" height="2.75rem" radius="md" />
          </div>
        </div>
      </div>
    </LoadingShell>
  );
}
