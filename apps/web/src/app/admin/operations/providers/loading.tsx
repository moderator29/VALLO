import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, CardListSkeleton } from "../../_components/DeskSkeleton";

/** The wait on the provider checks, which call every outside provider on each visit: the heading, then one card per provider. It fell back to operations before. */
export default function LoadingProviderChecks() {
  return (
    <LoadingShell label="Running the provider checks" className="nf-console nf-admin-stack">
      <HeadSkeleton title="11rem" />
      <CardListSkeleton count={5} height="4.5rem" />
    </LoadingShell>
  );
}
