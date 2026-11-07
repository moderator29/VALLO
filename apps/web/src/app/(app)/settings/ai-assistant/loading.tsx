import { Skeleton } from "@/components/ui/Skeleton";
import { CardRowsSkeleton, LoadingShell, PageHeaderSkeleton, SettingsGroupSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The assistant settings: the switch card, then the documents.
 *
 * SW12 (round 3): the page's own shape under the frame's large title, so
 * nothing moves when the read lands.
 */
export default function LoadingAiAssistant() {
  return (
    <LoadingShell label="Loading the assistant settings" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <div className="grid gap-block">
        <CardRowsSkeleton rows={1} height="6rem" />
        <SettingsGroupSkeleton rows={3} />
      </div>
    </LoadingShell>
  );
}
