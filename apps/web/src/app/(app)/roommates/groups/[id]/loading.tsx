import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/** The wait, in the page's own shape: the header, a card, then a list. */
export default function Loading() {
  return (
    <LoadingShell label="Loading Roommates" className="mx-auto w-full max-w-3xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <Skeleton height="7rem" radius="lg" className="mb-md" />
      <div className="grid gap-sm">
        <Skeleton height="5rem" radius="lg" />
        <Skeleton height="5rem" radius="lg" />
        <Skeleton height="5rem" radius="lg" />
      </div>
    </LoadingShell>
  );
}
