import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/** The wait, on one referral: the header, then the track. */
export default function LoadingInviteReferral() {
  return (
    <LoadingShell label="Loading this referral" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div aria-hidden="true" className="nf-panel nf-panel--card block p-xs">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-sm px-sm py-sm">
            <Skeleton width="2.25rem" height="2.25rem" radius="md" className="shrink-0" />
            <div className="grid flex-1 gap-xs">
              <Skeleton width="40%" height="1rem" radius="sm" />
              <Skeleton width="55%" height="0.75rem" radius="sm" />
            </div>
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}
