import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the Vallo passport: the header, the document, the whole-passport
 * switch and the list of line switches, in the order and at the heights they land.
 */
export default function LoadingPassport() {
  return (
    <LoadingShell label="Loading your Vallo passport" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" />
      <Skeleton height="3rem" radius="lg" className="mb-md" />
      <Skeleton height="26rem" radius="xl" />
      <Skeleton height="3.5rem" radius="lg" className="mt-block" />
      <div className="nf-panel nf-panel--card mt-block grid gap-md p-card">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} width={`${90 - i * 6}%`} height="1.25rem" radius="sm" />
        ))}
      </div>
    </LoadingShell>
  );
}
