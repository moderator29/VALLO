import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * One booking, while it loads.
 *
 * PERF-SWEEP 7: this route used to inherit `/bookings`' list skeleton (a
 * small row card and a "how booking works" strip), so the screen redrew
 * itself into a different shape when the booking arrived. This is the
 * detail's own geometry, from `BookingDetailCard`: a 5.75rem photo (6 by
 * 8rem from `sm`), the title and place, the dates and the guests, then the
 * price bar under a hairline, and the money record panel below it.
 */
export default async function LoadingBooking() {
  const t = getDictionary(await getLocale());
  return (
    <LoadingShell label={t.memberFlows.loading.booking} className="mx-auto w-full max-w-2xl">
      <PageHeaderSkeleton />

      <div className="nf-panel nf-panel--card block overflow-hidden p-0">
        <div className="flex gap-md p-md">
          <Skeleton
            radius="md"
            className="h-[5.75rem] w-[5.75rem] shrink-0 sm:h-24 sm:w-32"
            style={{ width: undefined, height: undefined }}
          />
          <div className="min-w-0 flex-1">
            <Skeleton width="4.5rem" height="0.75rem" radius="pill" />
            <Skeleton className="mt-xs" width="70%" height="1rem" radius="sm" />
            <Skeleton className="mt-2xs" width="50%" height="0.8125rem" radius="sm" />
            <Skeleton className="mt-sm" width="60%" height="0.875rem" radius="sm" />
            <Skeleton className="mt-2xs" width="35%" height="0.875rem" radius="sm" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-md border-t border-[var(--nf-border-subtle)] px-md py-sm">
          <Skeleton width="6rem" height="1rem" radius="sm" />
          <Skeleton width="5rem" height="0.8125rem" radius="sm" />
        </div>
      </div>

      <div className="nf-panel nf-panel--card mt-lg block p-md">
        <Skeleton width="8rem" height="0.75rem" radius="sm" />
        <Skeleton className="mt-sm" width="100%" height="0.875rem" radius="sm" />
        <Skeleton className="mt-xs" width="75%" height="0.875rem" radius="sm" />
      </div>
    </LoadingShell>
  );
}
