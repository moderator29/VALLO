import { CardRowsSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The application status, while it loads.
 *
 * PERF-SWEEP 7: this route inherited `/profile`'s skeleton, a cover, a face
 * and a row of tiles, and then redrew itself as a titled page of panels.
 * This is the page's own shape: the header with its subtitle, then the
 * stage panels.
 */
export default function LoadingApplication() {
  return (
    <LoadingShell label="Loading your application" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <CardRowsSkeleton rows={3} />
    </LoadingShell>
  );
}
