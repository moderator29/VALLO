import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { HostScreenSkeleton } from "@/components/host/HostScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on rooms and nights.
 *
 * The page frame's large title with Back and its sentence, then
 * `RoomNightsEditor`: the
 * horizon note and one `nf-host-group` card per room type, each a name and
 * meta line, a note, the two figure tiles side by side and the save pill.
 */
export default async function LoadingHostRooms() {
  return (
    <HostScreenSkeleton label={getDictionary(await getLocale()).hostWorkspace.loadingScreens.rooms}>
      <div className="nf-g1page">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="flex flex-col gap-block" aria-hidden="true">
        <Skeleton width="80%" height="0.8125rem" radius="sm" />
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="nf-panel nf-panel--card block nf-host-group">
            <Skeleton width="55%" height="1.125rem" radius="sm" />
            <Skeleton className="mt-2xs" width="40%" height="0.8125rem" radius="sm" />
            <Skeleton className="mt-row" width="90%" height="0.8125rem" radius="sm" />
            <div className="mt-md grid grid-cols-2 gap-sm">
              <Skeleton height="4.5rem" radius="lg" />
              <Skeleton height="4.5rem" radius="lg" />
            </div>
            <Skeleton className="mt-md" height="3rem" radius="pill" />
          </div>
        ))}
      </div>
      </div>
    </HostScreenSkeleton>
  );
}
