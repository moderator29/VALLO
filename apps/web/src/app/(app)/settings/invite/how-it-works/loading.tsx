import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/** The wait, on how invites work: the header, then the four reasons in one card. */
export default function LoadingInviteHow() {
  return (
    <LoadingShell label="Loading how invites work" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div aria-hidden="true" className="nf-panel nf-panel--card block p-md">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-sm py-sm">
            <Skeleton circle width="2.25rem" className="shrink-0" />
            <div className="grid flex-1 gap-xs">
              <Skeleton width="45%" height="1rem" radius="sm" />
              <Skeleton width="100%" height="0.875rem" radius="sm" />
            </div>
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}
