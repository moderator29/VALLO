import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the phone number.
 *
 * The header, the line on why, the confirmed-number card, then the form:
 * a labelled number field and its pill.
 */
export default function LoadingPhoneSettings() {
  return (
    <LoadingShell label="Loading your phone number" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="space-y-block" aria-hidden="true">
        <div>
          <Skeleton height="1rem" radius="sm" />
          <Skeleton className="mt-2xs" width="70%" height="1rem" radius="sm" />
        </div>
        <Skeleton height="4rem" radius="lg" />
        <div>
          <Skeleton width="8rem" height="0.875rem" radius="sm" />
          <Skeleton className="mt-xs" height="3.25rem" radius="lg" />
          <Skeleton className="mt-md" height="3rem" radius="pill" />
        </div>
      </div>
    </LoadingShell>
  );
}
