import { QueueSkeleton } from "../_components/QueueSkeleton";

/** The wait on the content desk. */
export default function LoadingAdminContent() {
  return <QueueSkeleton label="Loading the content desk" rows={4} />;
}
