import { QueueSkeleton } from "../_components/QueueSkeleton";

/** The wait on the support lead desk. */
export default function LoadingAdminSupportLead() {
  return <QueueSkeleton label="Loading the support lead desk" rows={4} />;
}
