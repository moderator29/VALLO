import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, TabRowSkeleton, PanelSkeleton } from "../_components/DeskSkeleton";

/** The wait on the Circle desk: the heading, the tabs, then the communities table. */
export default function LoadingCircle() {
  return (
    <LoadingShell label="Loading Circle" className="nf-console flex flex-col gap-xl">
      <HeadSkeleton title="8rem" />
      <TabRowSkeleton tabs={3} />
      <PanelSkeleton title={false} rows={7} />
    </LoadingShell>
  );
}
