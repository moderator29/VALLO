import type { Metadata } from "next";
import { readControlRoom } from "@/lib/admin/control/read";
import { PageHead } from "../_components/panels";
import { ControlRoomView } from "./ControlRoomView";

export const metadata: Metadata = { title: "Control room", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * THE CONTROL ROOM (the founder, 15 November 2026). The super admin's own
 * page: what is waiting on him, which parts of the database are in place,
 * how the main switches stand and which outside services are set up, each
 * in plain words with where to go next. It only reads. A switch is changed
 * on the Switches desk; SQL is run in the Supabase SQL editor.
 */

export default async function ControlRoomPage() {
  const room = await readControlRoom();
  if (room.state === "forbidden") {
    return (
      <div className="nf-console">
        <PageHead title="Control room" lede="Only a super admin account can open this page." />
      </div>
    );
  }
  if (room.state === "unavailable") {
    return (
      <div className="nf-console">
        <PageHead title="Control room" lede="The database could not be reached just now. Nothing was changed. Try again in a moment." />
      </div>
    );
  }
  return <ControlRoomView room={room} />;
}
