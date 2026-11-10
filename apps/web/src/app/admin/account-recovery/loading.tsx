import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, PanelSkeleton, CardListSkeleton } from "../_components/DeskSkeleton";

/** The wait on account recovery: the heading, the card with the five steps, the form that opens a request, then the open requests. */
export default function LoadingAccountRecovery() {
  return (
    <LoadingShell label="Loading account recovery" className="nf-console nf-admin-stack">
      <HeadSkeleton title="13rem" />
      <PanelSkeleton rows={5} rowHeight="0.875rem" />
      <PanelSkeleton rows={4} rowHeight="2.75rem" />
      <CardListSkeleton count={3} height="6rem" />
    </LoadingShell>
  );
}
