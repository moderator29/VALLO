import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/** The wait, on Talk to a person: the header, a line of words, the question box and its button. */
export default function LoadingPerson() {
  return (
    <LoadingShell label="Loading" className="mx-auto w-full max-w-2xl">
      <PageHeaderSkeleton />
      <div className="grid gap-block">
        <Skeleton width="90%" height="0.875rem" radius="sm" />
        <Skeleton width="100%" height="8rem" radius="md" />
        <Skeleton width="100%" height="3.125rem" radius="md" />
      </div>
    </LoadingShell>
  );
}
