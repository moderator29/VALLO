import { LoadingShell, PageHeaderSkeleton, SettingsGroupSkeleton } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The wait, on privacy.
 *
 * The header with its line, the explanation plate, the section menu, then the
 * visibility switches, the security rows and the three doors that replaced the
 * groups that used to follow.
 */
export default function LoadingPrivacySettings() {
  return (
    <LoadingShell label="Loading your privacy" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <Skeleton height="4.5rem" radius="lg" className="mb-md" />
      <Skeleton circle width="2.75rem" className="mb-md" />
      <div className="space-y-block">
        <SettingsGroupSkeleton rows={4} />
        <SettingsGroupSkeleton rows={2} />
        <SettingsGroupSkeleton rows={3} />
      </div>
    </LoadingShell>
  );
}
