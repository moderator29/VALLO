import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the referral hub: the header with its line, the explanation
 * plate, the gift, the ticket with its code and its two actions, and the rows.
 * The shapes match the loaded page so nothing moves when it arrives.
 */
export default function LoadingInviteSettings() {
  return (
    <LoadingShell label="Loading your invite" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <Skeleton height="4.5rem" radius="lg" className="mb-md" />
      <Skeleton circle width="6rem" className="mx-auto mb-md" />
      <div aria-hidden="true" className="nf-panel nf-panel--card mx-auto block max-w-[28rem] p-lg">
        <Skeleton width="40%" height="0.875rem" radius="sm" className="mx-auto" />
        <Skeleton className="mx-auto mt-md" width="80%" height="2.75rem" radius="lg" />
        <div className="mt-lg grid grid-cols-[1.4fr_1fr] gap-sm">
          <Skeleton height="3rem" radius="lg" />
          <Skeleton height="3rem" radius="lg" />
        </div>
      </div>
      <Skeleton height="10rem" radius="lg" className="mt-block" />
    </LoadingShell>
  );
}
