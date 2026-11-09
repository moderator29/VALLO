import { LoadingShell } from "@/components/app/ScreenSkeleton";
import { HeadSkeleton, PanelSkeleton } from "../_components/DeskSkeleton";

/** The wait on console settings: the heading, then one panel per setting. */
export default function LoadingConsoleSettings() {
  return (
    <LoadingShell label="Loading settings" className="nf-admin-stack">
      <HeadSkeleton title="9rem" />
      <PanelSkeleton title={false} rows={4} rowHeight="3.5rem" />
      <PanelSkeleton rows={2} rowHeight="2.75rem" />
    </LoadingShell>
  );
}
