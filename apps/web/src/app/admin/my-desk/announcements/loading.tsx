import { QueueSkeleton } from "../../_components/QueueSkeleton";

/** The wait on My Desk. */
export default function LoadingMyDeskAnnouncements() {
  return <QueueSkeleton label="Loading the announcements" rows={4} />;
}
