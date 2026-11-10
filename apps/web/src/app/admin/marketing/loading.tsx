import { QueueSkeleton } from "../_components/QueueSkeleton";

/** The wait on the marketing desk. */
export default function LoadingAdminMarketing() {
  return <QueueSkeleton label="Loading the marketing desk" rows={4} />;
}
