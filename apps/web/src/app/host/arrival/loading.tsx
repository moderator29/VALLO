import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { HostScreenSkeleton } from "@/components/host/HostScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the charges at the door: the page frame's large title with
 * Back and its lede, then the
 * five charge cards (the charge's name and the None / An amount pair), then
 * the save button.
 */
export default async function LoadingHostArrival() {
  return (
    <HostScreenSkeleton label={getDictionary(await getLocale()).experienceHost.loadingScreens.arrival}>
      <div className="nf-g1page" aria-hidden="true">
        <PageHeaderSkeleton layout="large" subtitle />
        <div className="grid gap-md">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="nf-panel nf-panel--card block p-md">
              <Skeleton width="45%" height="1rem" radius="sm" />
              <div className="mt-sm flex gap-sm">
                <Skeleton width="5rem" height="2.75rem" radius="md" />
                <Skeleton width="7rem" height="2.75rem" radius="md" />
              </div>
            </div>
          ))}
          <Skeleton height="3rem" radius="pill" />
        </div>
      </div>
    </HostScreenSkeleton>
  );
}
