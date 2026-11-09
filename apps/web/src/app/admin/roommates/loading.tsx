import { QueueSkeleton } from "../_components/QueueSkeleton";

/** The wait on the roommates desk. The console's shared queue shape, so the rows land where the real ones will. */
export default function LoadingAdminRoommates() {
  return <QueueSkeleton label="Loading the roommates desk" rows={4} />;
}
