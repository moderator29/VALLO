import { Skeleton } from "@/components/ui/Skeleton";
import { CardRowsSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The directory, while it loads (SW12, round 3): the large top with its
 * line, the search field, the kind switch, the place switch, then the
 * people as rows. It used to fall to the app's generic header and three rows.
 */
export default function LoadingDirectory() {
  return (
    <LoadingShell label="Loading the directory" className="mx-auto w-full max-w-2xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <Skeleton height="3rem" radius="md" />
      <Skeleton className="mt-sm" height="2.75rem" radius="md" />
      <Skeleton className="mx-auto mt-sm" width="12rem" height="2.75rem" radius="md" />
      <CardRowsSkeleton rows={4} height="4.5rem" className="mt-md" />
    </LoadingShell>
  );
}
