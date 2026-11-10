import { QueueSkeleton } from "../_components/QueueSkeleton";

/** The wait on My Desk. */
export default function LoadingMyDeskTasks() {
  return <QueueSkeleton label="Loading your tasks" rows={4} />;
}
