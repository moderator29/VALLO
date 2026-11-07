import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/** The wait, on a member's passport: the header and the document at the height it lands. */
export default function LoadingMemberPassport() {
  return (
    <LoadingShell label="Loading the passport" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" />
      <Skeleton height="26rem" radius="xl" />
    </LoadingShell>
  );
}
