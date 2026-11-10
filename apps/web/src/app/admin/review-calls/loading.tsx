import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, CardListSkeleton } from "../_components/DeskSkeleton";

/** The wait on review calls: the heading, then one row per review. */
export default function LoadingReviewCalls() {
  return (
    <LoadingShell label="Loading review calls" className="nf-console nf-admin-stack">
      <HeadSkeleton />
      <CardListSkeleton count={4} height="4.5rem" />
    </LoadingShell>
  );
}
