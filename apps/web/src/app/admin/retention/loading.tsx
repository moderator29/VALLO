import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, StatRowSkeleton, PanelSkeleton } from "../_components/DeskSkeleton";

/** The wait on retention: the heading, the three figures, then the preview table. */
export default function LoadingRetention() {
  return (
    <LoadingShell label="Loading retention" className="nf-admin-stack">
      <HeadSkeleton />
      <StatRowSkeleton count={3} />
      <PanelSkeleton rows={6} />
    </LoadingShell>
  );
}
