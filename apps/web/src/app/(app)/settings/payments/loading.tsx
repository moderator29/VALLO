import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on /settings/payments. Two settings groups at the real row
 * height (56px, glyph, label, value), a label above each, so the first card
 * lands where its placeholder sat.
 */
export default function LoadingPayments() {
  return (
    <LoadingShell label="Loading payment methods" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" />
      <Skeleton width="88%" height="1rem" radius="sm" />
      <div className="mt-block space-y-block">
        {Array.from({ length: 2 }, (_, group) => (
          <div key={group}>
            <Skeleton width="6rem" height="0.875rem" radius="sm" className="mb-inline" />
            <div className="nf-panel nf-panel--card block overflow-hidden p-0">
              {Array.from({ length: group === 0 ? 2 : 3 }, (_, i) => (
                <div
                  key={i}
                  className="flex min-h-14 items-center gap-inline border-t border-[var(--nf-divider)] px-lg py-row first:border-t-0"
                >
                  <Skeleton width="1.75rem" height="1.75rem" radius="sm" className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Skeleton width="55%" height="1rem" radius="sm" />
                    <Skeleton className="mt-3xs" width="35%" height="0.8125rem" radius="sm" />
                  </div>
                  <Skeleton width="3.5rem" height="1.25rem" radius="pill" className="shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}
