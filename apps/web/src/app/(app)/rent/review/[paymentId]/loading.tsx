import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/** The wait, on the tenancy review: a header and five question rows. */
export default function LoadingTenancyReview() {
  return (
    <LoadingShell label="Loading your tenancy review" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" />
      <div className="nf-panel nf-panel--card grid gap-md p-card">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i}>
            <Skeleton width="70%" height="1rem" radius="sm" />
            <Skeleton className="mt-xs" width="100%" height="2.75rem" radius="sm" />
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}
