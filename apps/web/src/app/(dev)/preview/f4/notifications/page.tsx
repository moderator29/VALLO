import { LiveNotifications } from "@/app/(app)/notifications/LiveNotifications";
import { NOTIFICATIONS } from "../fixtures";
import { PERSON } from "../../_fixtures/people";

/**
 * The signed-in notifications inbox, from fixtures: the real client component
 * with New and Earlier both populated, so the lit list, the glyph rail, the
 * unread treatment and the mark-all control can be photographed. The realtime
 * subscription is inert in this sandbox, which is what it should be.
 */
export default function NotificationsPreview() {
  return (
    <main id="main" className="nf-shell mx-auto max-w-2xl pb-4xl pt-md">
      <LiveNotifications initial={NOTIFICATIONS} userId={PERSON.id} />
    </main>
  );
}
