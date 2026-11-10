import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { CardRowsSkeleton, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { HostScreenSkeleton } from "@/components/host/HostScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The wait, on the host workspace home (SPEED-2), and for any host route
 * added later without a skeleton of its own.
 *
 * No host route had a `loading.tsx`, and `HostShell` renders inside each page
 * after an identity read, so a host screen showed the ROOT boundary (the
 * landing hero) and then the whole workspace arrived at once. This draws the
 * same frame `HostShell` does (`HostScreenSkeleton`: the desk sidebar from
 * 1024px, the workspace bar with its chips, the wide `nf-host__body`), then
 * the page frame the home now opens with: the large title with no Back (the
 * workspace root), the Today band and rows under it.
 */
export default async function LoadingHost() {
  const label = getDictionary(await getLocale()).hostWorkspace.loading;
  return (
    <HostScreenSkeleton label={label} wide>
      <div className="nf-g1page" data-width="wide">
        <PageHeaderSkeleton layout="large" back={false} />
        {/* The Today band: date, title, the line under it and the figure. */}
        <Skeleton className="mb-lg" height="12rem" radius="xl" />
        <CardRowsSkeleton rows={3} />
      </div>
    </HostScreenSkeleton>
  );
}
