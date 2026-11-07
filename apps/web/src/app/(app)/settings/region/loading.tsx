import { LoadingShell, PageHeaderSkeleton, SettingsGroupSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on language and region.
 *
 * The settings area's own navigation stays drawn above this (it lives in
 * `app/(app)/settings/layout.tsx`, so it is never held twice). Then the header with its
 * line, "Language" (one row) and "Money display" (currency, dates, numbers),
 * the shapes the loaded page draws, so nothing moves when it arrives.
 */
export default function LoadingRegionSettings() {
  return (
    <LoadingShell label="Loading language and region" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="space-y-block">
        <SettingsGroupSkeleton rows={1} />
        <SettingsGroupSkeleton rows={3} />
      </div>
    </LoadingShell>
  );
}
