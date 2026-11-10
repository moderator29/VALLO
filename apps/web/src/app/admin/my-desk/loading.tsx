import { QueueSkeleton } from "../_components/QueueSkeleton";

/** The wait on My Desk. */
export default function LoadingMyDesk() {
  return <QueueSkeleton label="Loading your desk" rows={4} />;
}
