import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton, SettingsGroupSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the people you blocked.
 *
 * A narrower column (`max-w-lg`): the header, the intro line, then the list
 * of people, each an avatar, a name and an unblock control.
 */
export default function LoadingBlockedSettings() {
  return (
    <LoadingShell label="Loading the people you blocked" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" />
      <div className="space-y-block">
        <Skeleton width="85%" height="0.875rem" radius="sm" />
        <SettingsGroupSkeleton rows={3} label={false} />
      </div>
    </LoadingShell>
  );
}
