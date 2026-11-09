import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, StatRowSkeleton, PanelSkeleton } from "../_components/DeskSkeleton";

/** The wait on call usage: the heading, the figures, then the table by state. */
export default function LoadingCallUsage() {
  return (
    <LoadingShell label="Loading call usage" className="nf-admin-stack">
      <HeadSkeleton />
      <StatRowSkeleton count={3} />
      <PanelSkeleton rows={6} />
    </LoadingShell>
  );
}
