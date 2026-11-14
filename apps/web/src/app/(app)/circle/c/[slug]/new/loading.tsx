import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

export default function LoadingNewDiscussion() {
  return (
    <LoadingShell label="Loading new discussion" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton />
      <div className="space-y-md">
        <Skeleton height="3rem" radius="lg" />
        <Skeleton height="10rem" radius="lg" />
        <Skeleton height="3rem" radius="lg" width="8rem" />
      </div>
    </LoadingShell>
  );
}
