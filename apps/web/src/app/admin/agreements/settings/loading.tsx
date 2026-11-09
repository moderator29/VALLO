import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";
import { HeadSkeleton, PanelSkeleton } from "../../_components/DeskSkeleton";

/** The wait on risk settings: the heading, the way back to the desk, then the settings form. It fell back to the agreements queue before. */
export default function LoadingRiskSettings() {
  return (
    <LoadingShell label="Loading risk settings" className="nf-console nf-admin-stack">
      <HeadSkeleton title="10rem" />
      <Skeleton width="16rem" height="0.875rem" radius="sm" />
      <PanelSkeleton rows={5} rowHeight="3rem" />
    </LoadingShell>
  );
}
