import { QueueSkeleton } from "../_components/QueueSkeleton";

/** The wait on the technical desk. */
export default function LoadingAdminTechnical() {
  return <QueueSkeleton label="Loading the technical desk" rows={4} />;
}
