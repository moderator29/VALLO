import { LoadingShell, PageHeaderSkeleton, CardRowsSkeleton } from "@/components/app/ScreenSkeleton";

export default function LoadingReviews() {
  return (
    <LoadingShell label="Loading review invitations" className="mx-auto grid max-w-2xl gap-md px-gutter">
      <PageHeaderSkeleton />
      <CardRowsSkeleton rows={3} />
    </LoadingShell>
  );
}
