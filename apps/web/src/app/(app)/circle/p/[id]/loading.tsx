import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/** The wait, in Circle's own shape: the header, a card, then a list of cards. */
export default function LoadingCircle() {
  return (
    <LoadingShell label="Loading Circle" className="mx-auto w-full max-w-3xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <Skeleton height="10rem" radius="lg" className="mb-md" />
      <div className="grid gap-sm">
        <Skeleton height="6rem" radius="lg" />
        <Skeleton height="6rem" radius="lg" />
        <Skeleton height="6rem" radius="lg" />
      </div>
    </LoadingShell>
  );
}
