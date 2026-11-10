import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, PanelSkeleton } from "../_components/DeskSkeleton";

/** The wait on the staff desk: the heading, the form that gives access, then the roster and the console keys. */
export default function LoadingStaff() {
  return (
    <LoadingShell label="Loading staff" className="nf-console nf-admin-stack">
      <HeadSkeleton title="8rem" />
      <PanelSkeleton rows={3} rowHeight="2.75rem" />
      <PanelSkeleton rows={5} rowHeight="3.5rem" />
      <PanelSkeleton rows={3} rowHeight="3.5rem" />
    </LoadingShell>
  );
}
