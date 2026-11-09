"use client";

import { banner } from "@/lib/ui/toast";
import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { isPhoneGate } from "@/lib/actions/envelope";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { requestRoomStay } from "@/lib/stays/room-booking-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * ROOM BOOKINGS 1: "Request this room". Writes the PENDING booking (priced
 * and held by the database) and hands over to /checkout/[bookingId], which
 * shows the request waiting on the hotel and, once the stay agreement is
 * approved, takes the payment.
 */
export function RoomRequestForm({
  stayId,
  roomTypeId,
  ratePlanId,
  checkIn,
  checkOut,
  guests,
  maxRooms,
  copy,
}: {
  stayId: string;
  roomTypeId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  maxRooms: number;
  /** The dictionary's words, chosen on the server for the reader's locale. */
  copy: { roomsLabel: string; requestRoom: string; requestRoomBody: string; roomChoices: string[] };
}) {
  const [rooms, setRooms] = useState(1);
  const [phoneGate, setPhoneGate] = useState(false);
  const [pending, start] = useSafeTransition();
  const router = useRouter();
  const choices = Array.from({ length: Math.max(1, Math.min(10, maxRooms)) }, (_, i) => i + 1);

  return (
    <form
      className="nf-panel nf-panel--card mt-row grid gap-xs p-card"
      data-testid="room-request"
      onSubmit={(event) => {
        event.preventDefault();
        setPhoneGate(false);
        start(async () => {
          try {
            const result = await requestRoomStay({ stayId, roomTypeId, ratePlanId, checkIn, checkOut, guests, rooms });
            if (!result.ok) {
              /* Said by the one banner (Grade 1); the phone step stays as its link. */
              banner.error(result.error);
              setPhoneGate(isPhoneGate(result));
              return;
            }
            /* Replace, not push (navigation audit): the request is made, so
               browser, Android and iOS back never re-enter the submitted form
               and offer to ask for the same room twice. */
            router.replace(`/checkout/${result.data.bookingId}`);
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      {choices.length > 1 && (
        <label className="grid gap-2xs">
          <span className="nf-caption">{copy.roomsLabel}</span>
          <select
            className="nf-field"
            value={rooms}
            onChange={(event) => setRooms(Number(event.target.value))}
            disabled={pending}
            data-testid="room-count"
          >
            {choices.map((n) => (
              <option key={n} value={n}>
                {copy.roomChoices[n - 1] ?? String(n)}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="nf-body">{copy.requestRoomBody}</p>
      <Button type="submit" variant="primary" size="lg" loading={pending} disabled={pending}>
        {copy.requestRoom}
      </Button>
      <PhoneGateLink show={phoneGate} full />
    </form>
  );
}
