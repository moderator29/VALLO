import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";
import { HeadSkeleton, KpiGridSkeleton, PanelSkeleton } from "../_components/DeskSkeleton";

/** The wait on analytics: the heading with its range, the read-only line, the figures, then the chart panels. It fell back to the overview before. */
export default function LoadingAnalytics() {
  return (
    <LoadingShell label="Loading analytics" className="nf-admin-stack">
      <HeadSkeleton action />
      <Skeleton width="20rem" height="0.875rem" radius="sm" />
      <KpiGridSkeleton />
      <PanelSkeleton block="14rem" />
      <PanelSkeleton rows={5} />
      <PanelSkeleton rows={5} />
    </LoadingShell>
  );
}
