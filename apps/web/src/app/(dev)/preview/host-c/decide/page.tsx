import { HostShell } from "@/components/host/HostShell";
import { DecideView, type DecideRowData } from "@/components/host/DecideView";
import { roomDeadline, sortByDeadline } from "@/lib/host/decide";
import { requestNow } from "@/lib/format/when";
import { roomRequest, tableRequest } from "../fixtures";

/** C3 on fixtures. `?empty=1` draws the caught-up state. */
export default async function PreviewHostDecide({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const now = requestNow();
  const rooms = [roomRequest("r1", 47.4), roomRequest("r2", 38, { room: "Executive suite", guestName: "Kelechi Eze", nights: 3 }), roomRequest("r3", 4, { guestName: "Bisi Adebayo" })];
  const rows: DecideRowData[] =
    p.empty === "1"
      ? []
      : [
          ...rooms.map<DecideRowData>((b) => ({ kind: "room", id: b.id, openedAt: b.createdAt, deadline: roomDeadline(b.createdAt), booking: b })),
          (() => {
            const t = tableRequest("t1", 5);
            return { kind: "table" as const, id: t.id, openedAt: new Date(now - 20 * 3_600_000).toISOString(), deadline: t.reservedFor, table: t };
          })(),
        ];
  return (
    <HostShell fallback="/preview/host-c" wide>
      <DecideView rows={sortByDeadline(rows, now)} now={now} locale="en" unreadable={false} />
    </HostShell>
  );
}
