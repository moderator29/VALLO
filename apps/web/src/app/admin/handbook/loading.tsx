import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, PanelSkeleton } from "../_components/DeskSkeleton";

/** The wait on the staff handbook: the heading, then its sections as panels of points. */
export default function LoadingHandbook() {
  return (
    <LoadingShell label="Loading the staff handbook" className="nf-console nf-admin-stack">
      <HeadSkeleton title="11rem" />
      <PanelSkeleton rows={4} rowHeight="1rem" />
      <PanelSkeleton rows={4} rowHeight="1rem" />
      <PanelSkeleton rows={3} rowHeight="1rem" />
    </LoadingShell>
  );
}
