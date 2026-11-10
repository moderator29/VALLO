import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { HostScreenSkeleton } from "@/components/host/HostScreenSkeleton";
import "../host-desk.css";

/**
 * The wait, on the rate calendar.
 *
 * The month grid is the shape that must not move: a host opens this to close
 * or price a night, and a grid that arrives a different size from the one
 * drawn moves the night they were reaching for. So the grid is drawn with
 * the calendar's own classes (`nf-rcal`, its weeks), at the real cell
 * heights (60px, 84px from 768px), under the plan line, the month bar
 * and the quick-select chips. From 1024px the side panel is reserved too.
 */
export default async function LoadingHostCalendar() {
  return (
    <HostScreenSkeleton label={getDictionary(await getLocale()).hostWorkspace.loadingScreens.calendar} wide>
      {/* The page frame (wide): the large title with Back and the property's name. */}
      <div className="nf-g1page" data-width="wide">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="nf-rcal" aria-hidden="true">
        <div className="nf-rcal__main">
          <div className="nf-rcal__plan">
            <div className="min-w-0 flex-1">
              <Skeleton width="10rem" height="1.25rem" radius="sm" />
              <Skeleton className="mt-2xs" width="80%" height="0.75rem" radius="sm" />
            </div>
            <Skeleton width="6.5rem" height="2.75rem" radius="pill" className="shrink-0" />
          </div>
          <div className="nf-rcal__monthbar">
            <Skeleton circle width="2.75rem" />
            <Skeleton width="9rem" height="1.25rem" radius="sm" className="mx-auto" />
            <Skeleton circle width="2.75rem" />
          </div>
          <div className="nf-rcal__presets">
            {["8.5rem", "8.5rem", "6rem"].map((w, i) => (
              <Skeleton key={i} width={w} height="2.25rem" radius="pill" />
            ))}
          </div>
          <div className="nf-rcal__grid">
            <div className="nf-rcal__week nf-rcal__week--head">
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} width="1.5rem" height="0.75rem" radius="sm" className="mx-auto my-3xs" />
              ))}
            </div>
            {Array.from({ length: 6 }, (_, w) => (
              <div key={w} className="nf-rcal__week">
                {Array.from({ length: 7 }, (_, d) => (
                  <Skeleton key={d} radius="md" className="h-[60px] md:h-[84px]" />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="nf-rcal__side">
          <div className="nf-panel nf-panel--card block p-md">
            <Skeleton width="60%" height="1.125rem" radius="sm" />
            <Skeleton className="mt-sm" height="3.25rem" radius="lg" />
            <Skeleton className="mt-sm" height="3.25rem" radius="lg" />
            <Skeleton className="mt-md" height="3rem" radius="pill" />
          </div>
        </div>
      </div>
      </div>
    </HostScreenSkeleton>
  );
}
