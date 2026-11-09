import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { HostScreenSkeleton } from "@/components/host/HostScreenSkeleton";
import { PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the table desk: the wide host body, the page frame's large
 * title with Back and its line, the search field, Today's heading and its four figure
 * tiles (two by two on a phone, a row of four from 1024px), then a section of
 * table cards (time and status, the guest and party line, the two answer
 * buttons), one column on a phone and two from 1024px, like the desk.
 */
export default async function LoadingHostReservations() {
  return (
    <HostScreenSkeleton label={getDictionary(await getLocale()).hostWorkspace.loadingScreens.tables} wide>
      <div className="nf-g1page" data-width="wide">
      <PageHeaderSkeleton layout="large" subtitle />
      <Skeleton width="100%" height="2.75rem" radius="md" className="lg:max-w-[20rem]" />
      <section className="mt-block" aria-hidden="true">
        <Skeleton width="6rem" height="1.5rem" radius="sm" />
        <div className="nf-figure-tiles mt-row">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height="6.5rem" radius="lg" />
          ))}
        </div>
        <ul className="mt-row grid items-start gap-row lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <li key={i} className="nf-panel nf-panel--card block p-card">
              <div className="flex items-start justify-between gap-inline">
                <Skeleton width="4rem" height="1.25rem" radius="sm" />
                <Skeleton width="5rem" height="1.5rem" radius="pill" />
              </div>
              <Skeleton className="mt-inline-tight" width="60%" height="0.875rem" radius="sm" />
              <Skeleton className="mt-inline-tight" width="45%" height="0.75rem" radius="sm" />
              <div className="mt-row flex gap-inline">
                <Skeleton width="7rem" height="2.75rem" radius="pill" />
                <Skeleton width="7rem" height="2.75rem" radius="pill" />
              </div>
            </li>
          ))}
        </ul>
      </section>
      </div>
    </HostScreenSkeleton>
  );
}
