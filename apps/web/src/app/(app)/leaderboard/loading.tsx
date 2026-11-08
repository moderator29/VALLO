import { Skeleton } from "@/components/ui/Skeleton";
import { ListGroupSkeleton, LoadingShell, PageHeaderSkeleton } from "@/components/app/ScreenSkeleton";

/**
 * The leaderboard, while it loads (SW12, round 3): the large top with its
 * line, the board switch, the podium stage, then the ranked rows. It used to
 * fall to the app's generic header and three rows.
 */
export default function LoadingLeaderboard() {
  return (
    <LoadingShell label="Loading the leaderboard" className="mx-auto w-full max-w-[40rem] px-md">
      <PageHeaderSkeleton layout="large" subtitle />
      <Skeleton height="2.75rem" radius="md" />
      <Skeleton className="mt-md" height="14rem" radius="xl" />
      <ListGroupSkeleton rows={5} label={false} className="mt-md" />
    </LoadingShell>
  );
}
