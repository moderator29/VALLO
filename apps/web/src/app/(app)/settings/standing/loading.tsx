import { LoadingShell, PageHeaderSkeleton, CardRowsSkeleton } from "@/components/app/ScreenSkeleton";

export default function LoadingStanding() {
  return (
    <LoadingShell label="Loading account standing" className="mx-auto w-full max-w-xl">
      <PageHeaderSkeleton layout="large" subtitle />
      <CardRowsSkeleton rows={3} />
    </LoadingShell>
  );
}
