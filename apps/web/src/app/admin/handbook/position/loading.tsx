import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, PanelSkeleton } from "../../_components/DeskSkeleton";

/** The wait on your role: the heading, then what the position is, what it covers, what is expected and when to escalate. It fell back to the handbook before. */
export default function LoadingPosition() {
  return (
    <LoadingShell label="Loading your role" className="nf-console nf-admin-stack">
      <HeadSkeleton title="10rem" />
      <PanelSkeleton rows={2} rowHeight="1rem" />
      <PanelSkeleton rows={4} rowHeight="1rem" />
      <PanelSkeleton rows={4} rowHeight="1rem" />
      <PanelSkeleton rows={3} rowHeight="1rem" />
    </LoadingShell>
  );
}
