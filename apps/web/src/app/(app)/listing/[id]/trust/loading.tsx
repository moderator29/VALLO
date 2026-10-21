import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell } from "@/components/app/ScreenSkeleton";

/**
 * The trust page's wait, shaped like what arrives (never a spinner): the
 * header line, the lede, then the dated rows as Plate rows with a date on the
 * right, then the lister card. The heights match `nf-trust__row` and the agent
 * card, so nothing jumps when the real page streams in over it.
 */
export default async function LoadingSpaceTrust() {
  const t = getDictionary(await getLocale());
  return (
    <LoadingShell label={t.memberFlows.loading.listingTrust} className="mx-auto w-full max-w-2xl">
      <div className="flex items-center gap-sm py-md">
        <Skeleton width="2.75rem" height="2.75rem" radius="pill" />
        <div className="grid flex-1 gap-2xs">
          <Skeleton width="55%" height="1.375rem" radius="sm" />
          <Skeleton width="35%" height="0.875rem" radius="sm" />
        </div>
      </div>
      <div className="mt-md grid gap-xs">
        <Skeleton height="0.9375rem" radius="sm" />
        <Skeleton width="70%" height="0.9375rem" radius="sm" />
      </div>
      <div className="mt-block grid gap-xs">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-sm">
            <Skeleton width="2.25rem" height="2.25rem" radius="sm" />
            <Skeleton className="flex-1" height="1rem" radius="sm" />
            <Skeleton width="6rem" height="1rem" radius="sm" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-section" height="5rem" radius="lg" />
    </LoadingShell>
  );
}
