import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on a new sign-in alert.
 *
 * A narrower column (`max-w-lg`): the header, then the one card that asks
 * "was this you" (the device, when it was first seen, the question and the
 * yes pill), and the panel for "this was not me" under it.
 */
export default function LoadingSignInAlert() {
  return (
    <LoadingShell label="Loading the sign-in" className="mx-auto w-full max-w-xl space-y-block">
      <PageHeaderSkeleton layout="large" />
      <div aria-hidden="true" className="nf-panel nf-panel--card block p-card">
        <Skeleton width="35%" height="0.75rem" radius="sm" />
        <Skeleton className="mt-row" width="70%" height="1.375rem" radius="sm" />
        <Skeleton className="mt-row" width="55%" height="0.875rem" radius="sm" />
        <Skeleton className="mt-group" width="60%" height="1rem" radius="sm" />
        <Skeleton className="mt-row" height="2.75rem" radius="pill" />
        <Skeleton className="mt-row" width="65%" height="0.75rem" radius="sm" />
      </div>
      <div aria-hidden="true" className="nf-panel nf-panel--card block p-card">
        <Skeleton width="50%" height="1rem" radius="sm" />
        <Skeleton className="mt-row" width="85%" height="0.875rem" radius="sm" />
        <Skeleton className="mt-row" height="2.75rem" radius="pill" />
      </div>
    </LoadingShell>
  );
}
