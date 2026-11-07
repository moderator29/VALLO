import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton, SettingsGroupSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on appearance.
 *
 * The header with its line, the theme group (one segmented control of three
 * in a card, a note under it), the motion group and the appearance rows.
 */
export default function LoadingAppearanceSettings() {
  return (
    <LoadingShell label="Loading appearance" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      {/* The explanation plate every settings page opens on (W6, D25). */}
      <Skeleton height="4.5rem" radius="lg" className="mb-md" />
      <div aria-hidden="true" className="nf-sgroup mb-block">
        <div className="nf-sgroup__label">
          <Skeleton width="5rem" height="0.75rem" radius="sm" />
        </div>
        <div className="nf-sgroup__body nf-panel nf-panel--card px-md py-sm">
          <Skeleton height="2.75rem" radius="pill" />
        </div>
        <div className="nf-sgroup__note">
          <Skeleton width="65%" height="0.75rem" radius="sm" />
        </div>
      </div>
      <SettingsGroupSkeleton rows={4} className="mb-block" />
      <SettingsGroupSkeleton rows={2} />
    </LoadingShell>
  );
}
