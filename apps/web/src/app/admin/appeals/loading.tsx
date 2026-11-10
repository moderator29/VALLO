import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, TabRowSkeleton, CardListSkeleton } from "../_components/DeskSkeleton";

/** The wait on appeals: the heading, the status tabs, then one card per appeal. */
export default function LoadingAppeals() {
  return (
    <LoadingShell label="Loading appeals" className="nf-console flex flex-col gap-xl">
      <HeadSkeleton />
      <TabRowSkeleton tabs={3} />
      <CardListSkeleton count={4} height="7rem" />
    </LoadingShell>
  );
}
