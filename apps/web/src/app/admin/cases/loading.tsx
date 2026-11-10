import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, TabRowSkeleton, PanelSkeleton } from "../_components/DeskSkeleton";

/** The wait on the case desk: the heading, the status and module tabs, then the cases table. */
export default function LoadingCases() {
  return (
    <LoadingShell label="Loading cases" className="nf-console flex flex-col gap-xl">
      <HeadSkeleton title="8rem" />
      <TabRowSkeleton tabs={5} />
      <TabRowSkeleton tabs={4} />
      <PanelSkeleton title={false} rows={8} rowHeight="3rem" />
    </LoadingShell>
  );
}
