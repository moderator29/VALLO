import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, PanelSkeleton } from "../../_components/DeskSkeleton";

/** The wait on the reviewer guide: the heading, the checklist, then a panel per kind of document. It fell back to the verification queue before. */
export default function LoadingReviewerGuide() {
  return (
    <LoadingShell label="Loading the reviewer guide" className="nf-console nf-admin-stack">
      <HeadSkeleton title="11rem" />
      <PanelSkeleton rows={5} rowHeight="1rem" />
      <PanelSkeleton rows={4} rowHeight="1rem" />
      <PanelSkeleton rows={4} rowHeight="1rem" />
    </LoadingShell>
  );
}
