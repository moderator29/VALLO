import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/** The wait, in the rebuilt home's own shape: the hero, the eight destination tiles, the tab row, then the featured cards. */
export default function LoadingCircle() {
  return (
    <LoadingShell label="Loading Circle" className="mx-auto w-full max-w-5xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <Skeleton height="clamp(22rem, 62vw, 28rem)" radius="lg" className="mb-xl" />
      <Skeleton height="1.25rem" width="9rem" className="mb-sm" />
      <div className="mb-xl grid grid-cols-4 gap-sm md:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="grid justify-items-center gap-2xs">
            <Skeleton height="4.5rem" width="100%" radius="lg" />
            <Skeleton height="0.75rem" width="70%" />
          </div>
        ))}
      </div>
      <Skeleton height="2.75rem" className="mb-xl" />
      <div className="grid gap-sm">
        <Skeleton height="7rem" radius="lg" />
        <Skeleton height="7rem" radius="lg" />
        <Skeleton height="7rem" radius="lg" />
      </div>
    </LoadingShell>
  );
}
