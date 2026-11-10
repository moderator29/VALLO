import { QueueSkeleton } from "../_components/QueueSkeleton";

/** The wait on the social media desk. */
export default function LoadingAdminSocialMedia() {
  return <QueueSkeleton label="Loading the social media desk" rows={4} />;
}
