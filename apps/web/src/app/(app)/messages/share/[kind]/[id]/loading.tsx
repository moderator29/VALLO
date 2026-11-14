import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton, CardRowsSkeleton } from "@/components/app/ScreenSkeleton";

export default function LoadingSharePicker() {
  return (
    <LoadingShell label="Loading share" className="mx-auto grid max-w-2xl gap-md px-gutter">
      <PageHeaderSkeleton />
      <Skeleton height="2.75rem" radius="lg" />
      <CardRowsSkeleton rows={4} height="3.5rem" />
    </LoadingShell>
  );
}
