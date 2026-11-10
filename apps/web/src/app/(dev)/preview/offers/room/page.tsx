import { PageFrame } from "@/components/app/PageFrame";
import { DealRoomView } from "@/components/app/deal-room/DealRoomView";
import { parseTab } from "@/components/app/deal-room/model";
import { OfferConfirmation } from "@/components/app/offers/OfferConfirmation";
import * as F from "@/lib/offers/fixtures";

const ROOMS = {
  buyer_waiting: F.ROOM_BUYER_WAITING,
  buyer_counter: F.ROOM_BUYER_COUNTER,
  seller_respond: F.ROOM_SELLER_RESPOND,
  agreed_buyer: F.ROOM_AGREED_BUYER,
  agreed_seller: F.ROOM_AGREED_SELLER,
  declined: F.ROOM_DECLINED,
  withdrawn: F.ROOM_WITHDRAWN,
  expired: F.ROOM_EXPIRED,
  cancelled: F.ROOM_CANCELLED,
} as const;

type Q = { room?: string; tab?: string; sent?: string };

/** The Deal Room, against fixtures. `?room=<key>&tab=<tab>&sent=1`. */
export default async function RoomPreview({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const room = ROOMS[(q.room ?? "buyer_waiting") as keyof typeof ROOMS] ?? F.ROOM_BUYER_WAITING;
  if (q.sent === "1") {
    return (
      <main className="nf-shell nf-page nf-md">
        <PageFrame title="Offer sent" back={false} width="narrow">
          <OfferConfirmation room={room} />
        </PageFrame>
      </main>
    );
  }
  return (
    <main className="nf-shell nf-page nf-md">
      <PageFrame title="Deal Room" fallback="/offers" width="wide">
        <DealRoomView room={room} nowMs={F.FIXTURE_NOW_MS} initialTab={parseTab(q.tab)} />
      </PageFrame>
    </main>
  );
}
