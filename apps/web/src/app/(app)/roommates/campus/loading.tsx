import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton, CardRowsSkeleton } from "@/components/app/ScreenSkeleton";

export default function LoadingCampusDirectory() {
  return (
    <LoadingShell label="Loading campus directory" className="mx-auto w-full max-w-6xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <Skeleton height="2.75rem" radius="lg" className="mb-md" />
      <CardRowsSkeleton rows={5} height="3.5rem" />
    </LoadingShell>
  );
}
