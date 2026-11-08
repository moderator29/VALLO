import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/** The wait, in the profile's shape: the photograph header, the facts, the panel. */
export default function LoadingRoommateProfile() {
  return (
    <LoadingShell label="Loading profile" className="mx-auto w-full max-w-6xl">
      <PageHeaderSkeleton layout="large" />
      <div className="nf-rmv">
        <div className="nf-rmv__main">
          <Skeleton height="16rem" radius="xl" />
          <Skeleton height="5rem" radius="lg" />
          <Skeleton height="10rem" radius="lg" />
        </div>
        <div className="nf-rmv__side">
          <Skeleton height="9rem" radius="lg" />
          <Skeleton height="14rem" radius="lg" />
        </div>
      </div>
    </LoadingShell>
  );
}
