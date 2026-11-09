import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";
import { HeadSkeleton, TabRowSkeleton, PanelSkeleton } from "../../_components/DeskSkeleton";

/** The wait on one listing under review: the heading and its status, the reference and summary, the decision, the section tabs, then the section. It fell back to the listings queue before. */
export default function LoadingListingReview() {
  return (
    <LoadingShell label="Loading the listing" className="grid min-w-0 gap-lg">
      <HeadSkeleton trail lede={false} title="14rem" />
      <div className="grid gap-2xs">
        <Skeleton width="9rem" height="0.875rem" radius="sm" />
        <Skeleton width="80%" height="1rem" radius="sm" />
        <Skeleton width="60%" height="0.875rem" radius="sm" />
      </div>
      <div className="flex flex-wrap gap-xs">
        <Skeleton width="8rem" height="2.75rem" radius="md" />
        <Skeleton width="8rem" height="2.75rem" radius="md" />
        <Skeleton width="8rem" height="2.75rem" radius="md" />
      </div>
      <TabRowSkeleton tabs={5} />
      <PanelSkeleton rows={6} rowHeight="1.5rem" />
    </LoadingShell>
  );
}
