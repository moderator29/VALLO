import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, StatRowSkeleton, PanelSkeleton } from "../_components/DeskSkeleton";

/** The wait on blocked terms: the heading, the figures, the add form, then the live list. */
export default function LoadingBlockedTerms() {
  return (
    <LoadingShell label="Loading blocked terms" className="nf-admin-stack">
      <HeadSkeleton />
      <StatRowSkeleton count={3} />
      <PanelSkeleton rows={2} rowHeight="2.75rem" />
      <PanelSkeleton rows={6} />
    </LoadingShell>
  );
}
