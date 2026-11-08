import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/** The wait, in the post's shape: the gallery, the price, the side panel. */
export default function LoadingRoomListing() {
  return (
    <LoadingShell label="Loading room" className="mx-auto w-full max-w-6xl">
      <PageHeaderSkeleton layout="large" />
      <div className="nf-rmv">
        <div className="nf-rmv__main">
          <Skeleton height="20rem" radius="xl" />
          <Skeleton height="4rem" radius="lg" />
          <Skeleton height="6rem" radius="lg" />
        </div>
        <div className="nf-rmv__side">
          <Skeleton height="12rem" radius="lg" />
          <Skeleton height="14rem" radius="lg" />
        </div>
      </div>
    </LoadingShell>
  );
}
