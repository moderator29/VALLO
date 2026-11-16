import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell } from "@/components/app/ScreenSkeleton";

/**
 * The wait, on VALLO Intelligence, in the screen's own shape: the wordmark
 * row, the title, the one wide field and the category chips, then a few
 * suggestion rows. Nothing moves when the screen lands.
 */
export default function LoadingIntelligence() {
  return (
    <LoadingShell label="Loading VALLO Intelligence" className="mx-auto grid w-full max-w-3xl gap-md">
      <div className="flex items-center justify-between">
        <Skeleton width="4rem" height="0.9375rem" radius="xs" />
        <Skeleton width="8.5rem" height="2.75rem" radius="md" />
      </div>
      <div className="mt-lg grid gap-xs">
        <Skeleton width="78%" height="2.25rem" radius="sm" />
        <Skeleton width="48%" height="1rem" radius="xs" />
      </div>
      <Skeleton height="3.75rem" radius="xl" />
      <div className="flex gap-xs overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} width="6.5rem" height="2.75rem" radius="md" className="shrink-0" />
        ))}
      </div>
      <div className="mt-md grid gap-sm">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-sm">
            <Skeleton width="2.75rem" height="2.75rem" radius="md" className="shrink-0" />
            <div className="grid flex-1 gap-2xs">
              <Skeleton width="45%" height="0.9375rem" radius="xs" />
              <Skeleton width="65%" height="0.75rem" radius="xs" />
            </div>
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}
