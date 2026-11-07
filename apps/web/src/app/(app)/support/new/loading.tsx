import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { NewQuerySkeleton } from "@/components/support/SupportSkeletons";

/** The wait on a new support query: the fields in their places. */
export default function LoadingNewSupportQuery() {
  return (
    <LoadingShell label="Loading the form" className="mx-auto w-full max-w-xl">
      <NewQuerySkeleton />
    </LoadingShell>
  );
}
