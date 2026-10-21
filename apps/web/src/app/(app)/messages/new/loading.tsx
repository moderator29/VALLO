import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on a new message.
 *
 * The listing this message is about is read first, and it sits above the composer as a card. Reserving it stops the composer starting high and dropping.
 */
export default async function LoadingNewMessage() {
  const t = getDictionary(await getLocale());
  return (
    <LoadingShell label={t.memberFlows.loading.newMessage} className="mx-auto w-full max-w-2xl">
      <PageHeaderSkeleton />
      <div className="space-y-sm">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="nf-panel nf-panel--card p-md">
            <Skeleton width="50%" height="1.0625rem" radius="sm" />
            <Skeleton className="mt-xs" width="78%" height="0.875rem" radius="sm" />
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}
