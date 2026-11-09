import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/** The wait, on a Record lookup: a header and five counted lines. */
export default function LoadingRecord() {
  return (
    <LoadingShell label="Loading the Record" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" />
      <div className="nf-panel nf-panel--card grid gap-md p-card">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} width={`${90 - i * 8}%`} height="1rem" radius="sm" />
        ))}
      </div>
    </LoadingShell>
  );
}
