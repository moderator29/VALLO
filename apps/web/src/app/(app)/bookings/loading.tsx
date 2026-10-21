import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the guest's trips.
 *
 * Bookings reads the guest's own rows under RLS before it can distinguish "you
 * have no trips" from "we have not looked yet". Those two states look identical
 * on a blank screen and mean opposite things to someone who paid for a stay
 * yesterday, which is the whole argument for this file.
 */
export default async function LoadingBookings() {
  const t = getDictionary(await getLocale());
  return (
    <LoadingShell label={t.memberFlows.loading.plans} className="mx-auto w-full max-w-2xl">
      <PageHeaderSkeleton />

      <div className="nf-panel nf-panel--card block p-md sm:p-lg">
        <div className="flex items-start gap-md">
          <Skeleton width="4.5rem" height="4.5rem" radius="md" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <Skeleton width="60%" height="1rem" radius="sm" />
            <Skeleton className="mt-xs" width="80%" height="0.8125rem" radius="sm" />
            <Skeleton className="mt-xs" width="40%" height="0.8125rem" radius="sm" />
          </div>
        </div>
      </div>

      {/* "How booking works" - three steps, and they carry the fold on an
          account with no trips yet, so they are reserved rather than dropped. */}
      <Skeleton className="mb-sm mt-xl" width="10rem" height="0.75rem" radius="sm" />
      <ul className="grid gap-sm sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="nf-panel nf-panel--card flex-row items-start gap-md p-md sm:flex-col">
            <Skeleton width="3.5rem" height="3.5rem" radius="md" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <Skeleton width="70%" height="0.875rem" radius="sm" />
              <Skeleton className="mt-xs" width="100%" height="0.78rem" radius="sm" />
              <Skeleton className="mt-2xs" width="85%" height="0.78rem" radius="sm" />
            </div>
          </li>
        ))}
      </ul>
    </LoadingShell>
  );
}
