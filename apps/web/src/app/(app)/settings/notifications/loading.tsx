import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton, SettingsGroupSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on notifications.
 *
 * The header with its line, the channel groups (switch rows), then "On your
 * phone": its title, the push control and the devices under it.
 */
export default function LoadingNotificationSettings() {
  return (
    <LoadingShell label="Loading your notifications" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      {/* The explanation plate every settings page opens on (W6, D25). */}
      <Skeleton height="4.5rem" radius="lg" className="mb-md" />
      <div className="space-y-block">
        <SettingsGroupSkeleton rows={4} />
        <SettingsGroupSkeleton rows={3} />
      </div>
      <div className="mt-block space-y-block" aria-hidden="true">
        <Skeleton width="9rem" height="1.25rem" radius="sm" />
        <SettingsGroupSkeleton rows={2} label={false} />
      </div>
    </LoadingShell>
  );
}
