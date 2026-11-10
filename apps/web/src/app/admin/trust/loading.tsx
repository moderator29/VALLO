import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, TabRowSkeleton, KpiGridSkeleton, PanelSkeleton } from "../_components/DeskSkeleton";

/** The wait on the trust overview: the heading, the period tabs, the work waiting, the pace, then the two panels side by side. */
export default function LoadingTrust() {
  return (
    <LoadingShell label="Loading the trust overview" className="nf-console flex flex-col gap-xl">
      <HeadSkeleton title="12rem" />
      <TabRowSkeleton tabs={3} />
      <KpiGridSkeleton count={4} />
      <KpiGridSkeleton count={4} />
      <div className="grid gap-lg lg:grid-cols-2">
        <PanelSkeleton rows={5} rowHeight="1.5rem" />
        <PanelSkeleton rows={5} rowHeight="1.5rem" />
      </div>
    </LoadingShell>
  );
}
