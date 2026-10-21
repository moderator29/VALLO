import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on this stay.
 *
 * The stay is read to check it can be reviewed at all. The star row and the text box are the two things that must not move under a thumb already reaching for them.
 */
export default async function LoadingReview() {
  const t = getDictionary(await getLocale());
  return (
    <LoadingShell label={t.memberFlows.loading.stay} className="mx-auto w-full max-w-2xl">
      <PageHeaderSkeleton />
      <div className="nf-panel nf-panel--card block p-card">
        <Skeleton width="40%" height="0.8125rem" radius="sm" />
        <Skeleton className="mt-heading" height="2.25rem" radius="sm" />
        <Skeleton className="mt-block" height="3.5rem" radius="md" />
      </div>
    </LoadingShell>
  );
}
