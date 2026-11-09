import { LiveNotifications } from "@/app/(app)/notifications/LiveNotifications";
import { PERSON } from "../_fixtures/people";

/**
 * The founder's "Needs you" stack bug (refs/bug-notifications-stack.png),
 * reproduced from fixtures: two unread messages on one thread (a bundle), a
 * second message, a new follower and staff sign-ins, so the stack, its open
 * bundle and the family glyphs can be photographed in both themes.
 */
const THREAD = "/messages/00000000-0000-4000-8000-0000000000c1";
const at = (m: number) => new Date(Date.UTC(2026, 10, 7, 12, 33 - m)).toISOString();
const ROWS = [
  { id: "00000000-0000-4000-8000-00000000e001", kind: "message", title: "You have a new message", body: "Hello", href: THREAD, read: false, createdAt: at(0) },
  { id: "00000000-0000-4000-8000-00000000e002", kind: "message", title: "You have a new message", body: "Are you free on Saturday?", href: THREAD, read: false, createdAt: at(1) },
  { id: "00000000-0000-4000-8000-00000000e003", kind: "message", title: "New message from Tunde", body: "The terrace is open at nine.", href: "/messages/00000000-0000-4000-8000-0000000000c2", read: false, createdAt: at(3) },
  { id: "00000000-0000-4000-8000-00000000e004", kind: "social", title: "You have a new follower", body: "@zeezu_sketch started following you.", href: "/u/zeezu_sketch", read: false, createdAt: at(4) },
  { id: "00000000-0000-4000-8000-00000000e005", kind: "system", title: "New sign-in to your staff account", body: "Your staff account signed in from a new network or device. If this was not you, tell us.", href: null, read: false, createdAt: at(8) },
  { id: "00000000-0000-4000-8000-00000000e008", kind: "booking", title: "New booking request", body: "Ada wants Friday to Sunday at the Lekki flat.", href: "/host/reservations", read: false, createdAt: at(6) },
  { id: "00000000-0000-4000-8000-00000000e006", kind: "booking", title: "Your reservation at Grand Vista Hotel is confirmed", body: "Check in Friday from 15:00.", href: "/trips", read: false, createdAt: at(20) },
  { id: "00000000-0000-4000-8000-00000000e007", kind: "listing", title: "A place you saved dropped its price", body: "2 bedroom flat in Lekki Phase 1.", href: "/listing/00000000-0000-4000-8000-0000000000d1", read: true, createdAt: at(60) },
];

export default function FeNotificationsPreview() {
  return (
    <main id="main" className="nf-shell mx-auto max-w-2xl pb-4xl pt-md">
      <LiveNotifications
        initial={ROWS}
        userId={PERSON.id}
        openThreads={["00000000-0000-4000-8000-0000000000c1", "00000000-0000-4000-8000-0000000000c2"]}
      />
    </main>
  );
}
