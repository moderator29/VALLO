import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { HostScreenSkeleton } from "@/components/host/HostScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on host settings: the page frame's large title with Back and its
 * line, the businesses list (each a name,
 * a kind and tier line, a state and its row of doors), the notification
 * card, the assistant door and the "everything else" card.
 */
export default async function LoadingHostSettings() {
  return (
    <HostScreenSkeleton label={getDictionary(await getLocale()).experienceHost.loadingScreens.settings}>
      <div className="nf-g1page">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="grid gap-block" aria-hidden="true">
        <div>
          <Skeleton width="9rem" height="1.25rem" radius="sm" />
          <div className="nf-panel nf-panel--card mt-sm block p-md">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className={i ? "mt-md border-t border-[var(--nf-divider)] pt-md" : undefined}>
                <Skeleton width="55%" height="1.0625rem" radius="sm" />
                <Skeleton className="mt-2xs" width="35%" height="0.875rem" radius="sm" />
                <div className="mt-sm flex flex-wrap gap-xs">
                  <Skeleton width="8rem" height="2.75rem" radius="pill" />
                  <Skeleton width="7rem" height="2.75rem" radius="pill" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <Skeleton height="12rem" radius="lg" />
        <Skeleton height="4.5rem" radius="lg" />
        <Skeleton height="8rem" radius="lg" />
      </div>
      </div>
    </HostScreenSkeleton>
  );
}
