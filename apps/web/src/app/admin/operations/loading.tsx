import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, TabRowSkeleton, KpiGridSkeleton, PanelSkeleton } from "../_components/DeskSkeleton";

/** The wait on operations: the heading, the figures, the tabs, then the jobs table and the two half panels. It fell back to the overview before. */
export default function LoadingOperations() {
  return (
    <LoadingShell label="Loading operations" className="nf-admin-stack">
      <HeadSkeleton />
      <KpiGridSkeleton />
      <TabRowSkeleton tabs={5} />
      <PanelSkeleton title={false} rows={6} />
      <div className="nf-admin-grid nf-admin-grid--halves">
        <PanelSkeleton rows={4} rowHeight="3rem" />
        <PanelSkeleton rows={4} rowHeight="3rem" />
      </div>
    </LoadingShell>
  );
}
