import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton, SettingsGroupSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the passcode.
 *
 * A narrower column (`max-w-lg`): the header, the lock's face (the person's
 * picture and a line), then the passcode rows.
 */
export default function LoadingPasscodeSettings() {
  return (
    <LoadingShell label="Loading your passcode" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" />
      <div aria-hidden="true" className="mb-block flex flex-col items-center">
        <Skeleton circle width="4rem" />
        <Skeleton className="mt-sm" width="60%" height="0.9375rem" radius="sm" />
      </div>
      <SettingsGroupSkeleton rows={3} />
    </LoadingShell>
  );
}
