import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, PanelSkeleton, StatRowSkeleton } from "../_components/DeskSkeleton";

/** The wait on the search desk: the heading with its range, the figures, the word lists, then the aliases. */
export default function LoadingSearchDesk() {
  return (
    <LoadingShell label="Loading search" className="nf-admin-stack">
      <HeadSkeleton action />
      <StatRowSkeleton count={5} />
      <PanelSkeleton rows={6} />
      <PanelSkeleton rows={4} />
      <PanelSkeleton rows={3} />
    </LoadingShell>
  );
}
