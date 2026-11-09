import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/** The wait for a flatmate's share: the header, the share line, the control. */
export default function LoadingRentShare() {
  return (
    <LoadingShell label="Loading your share">
      <PageHeaderSkeleton layout="large" />
      <div className="mt-md space-y-xs">
        <Skeleton width="80%" height="1.25rem" radius="sm" />
        <Skeleton width="50%" height="0.9375rem" radius="sm" />
      </div>
      <div className="mt-lg">
        <Skeleton height="2.75rem" radius="md" />
      </div>
    </LoadingShell>
  );
}
