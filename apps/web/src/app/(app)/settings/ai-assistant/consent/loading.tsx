import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The assistant agreement: the text to read, the tick, then the decision.
 *
 * SW12 (round 3): the page's own shape under the frame's large title, so
 * nothing moves when the read lands.
 */
export default function LoadingAiConsent() {
  return (
    <LoadingShell label="Loading the agreement" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="grid gap-sm">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} width={i % 3 === 2 ? "70%" : "100%"} height="0.9375rem" radius="sm" />
        ))}
      </div>
      <Skeleton className="mt-block" width="80%" height="1.5rem" radius="sm" />
      <Skeleton className="mt-block" height="3.125rem" radius="md" />
    </LoadingShell>
  );
}
