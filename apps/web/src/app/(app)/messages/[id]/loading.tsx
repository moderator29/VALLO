import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on this conversation.
 *
 * A thread alternates sides, so the placeholder does too: a wall of identical bars reads as a list and this is not a list.
 */
export default async function LoadingThread() {
  const t = getDictionary(await getLocale());
  return (
    <LoadingShell label={t.memberFlows.loading.conversation} className="mx-auto w-full max-w-3xl">
      <PageHeaderSkeleton />
      <div className="space-y-sm">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="nf-panel nf-panel--card p-md">
            <Skeleton width="62%" height="1.0625rem" radius="sm" />
            <Skeleton className="mt-xs" width="44%" height="0.875rem" radius="sm" />
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}
