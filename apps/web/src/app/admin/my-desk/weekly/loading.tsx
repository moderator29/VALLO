import { QueueSkeleton } from "../../_components/QueueSkeleton";

/** The wait on the weekly report. */
export default function LoadingWeeklyReport() {
  return <QueueSkeleton label="Loading your weekly report" rows={4} />;
}
