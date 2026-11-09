import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton, SettingsGroupSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on help.
 *
 * The header with its line, the support chat card (a few message lines and
 * the composer), what this person reported, and the About group.
 */
export default function LoadingHelpSettings() {
  return (
    <LoadingShell label="Loading help" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      {/* The explanation plate every settings page opens on (W6, D25). */}
      <Skeleton height="4.5rem" radius="lg" className="mb-md" />
      <div className="space-y-block">
        <div aria-hidden="true" className="nf-panel nf-panel--card block p-md">
          <Skeleton width="45%" height="1.0625rem" radius="sm" />
          <Skeleton className="mt-xs" width="80%" height="0.875rem" radius="sm" />
          <Skeleton className="mt-md" height="3.25rem" radius="pill" />
        </div>
        <SettingsGroupSkeleton rows={2} />
        <SettingsGroupSkeleton rows={5} note />
      </div>
    </LoadingShell>
  );
}
