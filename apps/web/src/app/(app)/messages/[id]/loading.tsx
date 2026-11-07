import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on this conversation, in the thread's own shape (Grade 1): the
 * header (back, the person, the options), bubbles that alternate sides at
 * the widths words take, and the chat box pinned at the foot, so the real
 * thread lands where its placeholder sat.
 */
const BUBBLES: { mine: boolean; width: string }[] = [
  { mine: false, width: "62%" },
  { mine: false, width: "38%" },
  { mine: true, width: "48%" },
  { mine: false, width: "70%" },
  { mine: true, width: "34%" },
  { mine: true, width: "56%" },
];

export default async function LoadingThread() {
  const t = getDictionary(await getLocale());
  return (
    <LoadingShell label={t.memberFlows.loading.conversation} className="mx-auto flex h-full w-full max-w-3xl flex-col px-gutter">
      <div className="flex items-center gap-inline py-inline">
        <Skeleton circle width="2.75rem" className="shrink-0" />
        <Skeleton circle width="2.75rem" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <Skeleton width="40%" height="1rem" radius="sm" />
          <Skeleton className="mt-inline-tight" width="28%" height="0.75rem" radius="sm" />
        </div>
        <Skeleton circle width="2.75rem" className="shrink-0" />
      </div>
      <div className="flex flex-1 flex-col justify-end gap-row py-group">
        {BUBBLES.map((b, i) => (
          <div key={i} className={`flex ${b.mine ? "justify-end" : "justify-start"}`}>
            <Skeleton width={b.width} height="2.5rem" radius="lg" />
          </div>
        ))}
      </div>
      <Skeleton height="6rem" radius="xl" className="mb-sm" />
    </LoadingShell>
  );
}
