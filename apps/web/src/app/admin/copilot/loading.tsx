import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell } from "@/components/app/ScreenSkeleton";

/** The wait on the copilot page: a heading, then the conversation and the capabilities beside it. */
export default function LoadingCopilot() {
  return (
    <LoadingShell label="Loading the copilot" className="nf-admin-stack">
      <Skeleton width="10rem" height="1.75rem" radius="sm" />
      <Skeleton width="100%" height="16rem" radius="md" />
      <Skeleton width="100%" height="3rem" radius="md" />
    </LoadingShell>
  );
}
