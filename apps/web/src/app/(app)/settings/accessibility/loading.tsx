import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton, SettingsGroupSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on accessibility.
 *
 * The settings area's own navigation stays drawn above this (it lives in
 * `app/(app)/settings/layout.tsx`, so it is never held twice). Then the header with its
 * line, the one-line lede, "Seeing" (contrast, reduced transparency, text
 * size) and "Motion" (three rows and its note), the shapes the loaded page
 * draws, so nothing moves when it arrives.
 */
export default function LoadingAccessibilitySettings() {
  return (
    <LoadingShell label="Loading accessibility" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <Skeleton width="80%" height="1rem" radius="sm" className="mb-block" />
      <div className="space-y-block">
        <SettingsGroupSkeleton rows={3} />
        <SettingsGroupSkeleton rows={3} note />
      </div>
    </LoadingShell>
  );
}
