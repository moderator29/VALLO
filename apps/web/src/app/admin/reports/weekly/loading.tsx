import { QueueSkeleton } from "../../_components/QueueSkeleton";

/** The wait on the weekly reports table. */
export default function LoadingWeeklyReports() {
  return <QueueSkeleton label="Loading the weekly reports" rows={5} />;
}
