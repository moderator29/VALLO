import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, StatRowSkeleton, PanelSkeleton } from "../_components/DeskSkeleton";

/** The wait on withheld weight: the heading, the three figures, then the list. */
export default function LoadingWeightWithheld() {
  return (
    <LoadingShell label="Loading withheld weight" className="nf-admin-stack">
      <HeadSkeleton />
      <StatRowSkeleton count={3} />
      <PanelSkeleton rows={6} />
    </LoadingShell>
  );
}
