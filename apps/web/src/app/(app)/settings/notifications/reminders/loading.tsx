import { LoadingShell, PageHeaderSkeleton, SettingsGroupSkeleton } from "@/components/app/ScreenSkeleton";

/** The wait, on reminders: the header, then the three switch groups. */
export default function LoadingReminderSettings() {
  return (
    <LoadingShell label="Loading your reminders" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="space-y-block">
        <SettingsGroupSkeleton rows={2} />
        <SettingsGroupSkeleton rows={1} />
        <SettingsGroupSkeleton rows={5} />
      </div>
    </LoadingShell>
  );
}
