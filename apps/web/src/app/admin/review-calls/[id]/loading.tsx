import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, PanelSkeleton } from "../../_components/DeskSkeleton";

/** The wait on one review call: the kind and status, then the desk with its record and its controls. It fell back to the list before. */
export default function LoadingReviewCall() {
  return (
    <LoadingShell label="Loading the review call" className="nf-console nf-admin-stack">
      <HeadSkeleton title="14rem" />
      <PanelSkeleton rows={3} rowHeight="2.75rem" />
      <PanelSkeleton rows={5} rowHeight="1.5rem" />
    </LoadingShell>
  );
}
