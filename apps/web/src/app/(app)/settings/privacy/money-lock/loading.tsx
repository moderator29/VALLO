import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/** The wait, on a privacy page: the header, the explanation plate, then the group's rows. */
export default function LoadingPrivacyMoneyLock() {
  return (
    <LoadingShell label="Loading the money lock" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" />
      <Skeleton height="4.5rem" radius="lg" className="mb-md" />
      <Skeleton height="9rem" radius="lg" />
    </LoadingShell>
  );
}
