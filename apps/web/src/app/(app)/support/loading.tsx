import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton, SettingsGroupSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the support home (Round 3 sweep, C3).
 *
 * It fell through to the `(app)` skeleton, a page header over three card
 * rows, and then redrew as a round back control over the help card. This is
 * the loaded page's own order: the 44px round back control, the hero card
 * (greeting, the reply promise, the 64px art, the one primary action and the
 * three round doors under it), "Your support" with its one Messages row, the
 * search panel, then the trust and legal rows.
 */
export default function LoadingSupport() {
  return (
    <LoadingShell label="Loading help and support" className="mx-auto w-full max-w-xl">
      {/* E2 (round 3): the page's large top, Back inside it. */}
      <PageHeaderSkeleton layout="large" />
      <div className="space-y-block">
        <div aria-hidden="true" className="rounded-[var(--nf-radius-xl)] border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-primary)] p-card">
          <div className="flex items-start gap-group">
            <div className="min-w-0 flex-1">
              <Skeleton width="80%" height="1.75rem" radius="sm" />
              <Skeleton className="mt-row" width="95%" height="0.875rem" radius="sm" />
              <Skeleton className="mt-2xs" width="60%" height="0.875rem" radius="sm" />
            </div>
            <Skeleton width="4rem" height="4rem" radius="lg" className="shrink-0" />
          </div>
          <Skeleton className="mt-block" height="3.5rem" radius="md" />
          <div className="mt-block grid grid-cols-3 gap-xs">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-row">
                <Skeleton circle width="3.5rem" />
                <Skeleton width="70%" height="0.75rem" radius="xs" />
              </div>
            ))}
          </div>
        </div>
        <SettingsGroupSkeleton rows={1} />
        <div aria-hidden="true" className="space-y-row">
          <Skeleton width="7rem" height="0.75rem" radius="sm" />
          <Skeleton height="3rem" radius="lg" />
        </div>
        <SettingsGroupSkeleton rows={3} />
      </div>
    </LoadingShell>
  );
}
