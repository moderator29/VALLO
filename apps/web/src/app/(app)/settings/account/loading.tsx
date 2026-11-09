import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton, SettingsGroupSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on account information.
 *
 * The header with its line, then the page's stacked sections (`space-y-block`):
 * the account group (name, email, password, the way out) and the place card.
 */
export default function LoadingAccountSettings() {
  return (
    <LoadingShell label="Loading your account" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      {/* The explanation plate every settings page opens on (W6, D25). */}
      <Skeleton height="4.5rem" radius="lg" className="mb-md" />
      <div className="space-y-block">
        <SettingsGroupSkeleton rows={4} />
        <SettingsGroupSkeleton rows={3} />
      </div>
    </LoadingShell>
  );
}
