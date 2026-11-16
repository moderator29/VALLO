import { QueueSkeleton } from "../_components/QueueSkeleton";

/** The wait on the unified queue: tabs, filters and rows, so the rows land where the real ones will (it fell back to the overview's strip and cards before). */
export default function LoadingAdminQueue() {
  return <QueueSkeleton label="Loading the queue" rows={8} table />;
}
