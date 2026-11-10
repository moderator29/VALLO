import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, PanelSkeleton } from "../../_components/DeskSkeleton";

/** The wait on one case: the way back, the case number and its badges, then the evidence column beside the case column. It fell back to the case list before. */
export default function LoadingCase() {
  return (
    <LoadingShell label="Loading the case" className="nf-console flex flex-col gap-xl">
      <HeadSkeleton back trail title="8rem" />
      <div className="grid gap-lg lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-lg">
          <PanelSkeleton block="8rem" />
          <PanelSkeleton rows={3} rowHeight="3.5rem" />
          <PanelSkeleton rows={4} />
        </div>
        <div className="flex min-w-0 flex-col gap-lg">
          <PanelSkeleton rows={5} rowHeight="1.25rem" />
          <PanelSkeleton rows={3} rowHeight="2.75rem" />
        </div>
      </div>
    </LoadingShell>
  );
}
