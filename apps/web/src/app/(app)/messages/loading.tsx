import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on the inbox.
 *
 * Conversations are read per viewer, so this route is dynamic on every visit.
 * The list is a single divided card rather than separate cards, and each row is
 * an avatar beside two lines - reproduced here at `px-4 py-3.5`, the real row
 * padding, so the first conversation lands where the placeholder sat.
 */
export default async function LoadingMessages() {
  const t = getDictionary(await getLocale());
  return (
    <LoadingShell label={t.memberFlows.loading.messages} className="mx-auto w-full max-w-2xl">
      <PageHeaderSkeleton subtitle />

      {/* Hairline rows on the ground, matching `Inbox`, which has not drawn a
          card around this list for some time. A skeleton that reserves a
          bordered box the screen then dissolves is a layout shift dressed as a
          transition. It also reserves the search field and the tab row above
          the list, both of which used to arrive and push the first
          conversation down by ninety pixels. */}
      <Skeleton height="3.5rem" radius="lg" />
      <Skeleton className="mt-heading" height="2.75rem" radius="pill" />

      <ul className="mt-heading divide-y divide-[var(--nf-border-subtle)]">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex items-start gap-md py-group">
            <Skeleton circle width="2.5rem" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <Skeleton width="45%" height="1rem" radius="sm" />
              <Skeleton className="mt-inline-tight" width="80%" height="0.90625rem" radius="sm" />
            </div>
            <Skeleton width="2.5rem" height="0.75rem" radius="sm" className="shrink-0" />
          </li>
        ))}
      </ul>
    </LoadingShell>
  );
}
