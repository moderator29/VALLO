import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the inbox.
 *
 * Conversations are read per viewer, so this route is dynamic on every visit.
 * Hairline rows on the ground, each an avatar beside two lines at the real
 * row height, so the first conversation lands where the placeholder sat.
 */
export default async function LoadingMessages() {
  const t = getDictionary(await getLocale());
  return (
    <LoadingShell label={t.memberFlows.loading.messages} className="mx-auto w-full max-w-2xl">
      <PageHeaderSkeleton subtitle />

      {/* GRADE 1: the inbox's own shape. Search is a round button in the
          header now (R59), so no field is reserved; the chip row, the pinned
          assistant and the calmer 76px rows are. */}
      <div className="mt-sm flex gap-xs">
        <Skeleton width="3.5rem" height="2.25rem" radius="md" />
        <Skeleton width="5rem" height="2.25rem" radius="md" />
        <Skeleton width="5.5rem" height="2.25rem" radius="md" />
      </div>

      <ul className="mt-heading">
        {Array.from({ length: 7 }, (_, i) => (
          <li key={i} className="flex min-h-[4.75rem] items-center gap-md py-sm">
            <Skeleton circle width="3rem" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <Skeleton width={i === 0 ? "35%" : "45%"} height="1rem" radius="sm" />
              <Skeleton className="mt-inline-tight" width={i === 0 ? "60%" : "80%"} height="0.875rem" radius="sm" />
            </div>
            <Skeleton width="2.5rem" height="0.75rem" radius="sm" className="shrink-0" />
          </li>
        ))}
      </ul>
    </LoadingShell>
  );
}
