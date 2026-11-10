import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, TabRowSkeleton, StatRowSkeleton, CardListSkeleton } from "../_components/DeskSkeleton";

/** The wait on the crash log: the heading, the figures, the two tab rows, then one card per distinct crash. */
export default function LoadingCrashes() {
  return (
    <LoadingShell label="Loading the crash log" className="nf-admin-stack">
      <HeadSkeleton />
      <StatRowSkeleton count={3} />
      <TabRowSkeleton tabs={3} />
      <TabRowSkeleton tabs={5} />
      <CardListSkeleton count={4} height="7rem" />
    </LoadingShell>
  );
}
