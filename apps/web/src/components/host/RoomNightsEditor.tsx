"use client";

import { useHostCopy, useHostPageCopy } from "@/components/host/host-copy";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { countOf, formatMoney, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { TYPE } from "@/components/app/Screen";
import { StatusPill, toneForStatus } from "@/components/ui/StatusPill";
import { setRoomNights } from "@/lib/host/actions";
import type { MyRoomType } from "@/lib/host/queries";
import { isoDate } from "@/lib/stays/inventory";

/**
 * HOW MANY ROOMS ARE ON SALE, AND FOR WHICH NIGHTS.
 *
 * WHAT THIS IS FOR. `stays_search` treats a night with no `room_inventory` row
 * as NOT OFFERED rather than as available, which is the right reading and the
 * reason a hotel with no rows cannot be found by anybody who types dates. The
 * table has existed since M5 and nothing in the application ever wrote to it,
 * so every hotel on the platform was in exactly that state and no host could
 * see it. This is where a host sees it and changes it.
 *
 * THE NUMBERS ON THE SCREEN ARE COUNTED, NEVER INFERRED. "Bookable for the
 * next 312 nights" is the count of rows from today onwards, read by
 * `getMyRoomTypes`. A room type with no rows says so in those words rather
 * than being drawn as a zero, because zero open rooms is a closure a host
 * chose and no rows at all is a hotel nobody can find, and the two must never
 * look the same.
 *
 * ZERO IS A CLOSURE AND IT IS OFFERED AS ONE. Setting none open across a run
 * of nights is how a host closes for a refurbishment, and the server writes
 * rows saying so rather than deleting them, so the closure is a recorded
 * decision the host can see and undo.
 */
export function RoomNightsEditor({
  rooms,
  locale,
}: {
  rooms: MyRoomType[];
  locale: Locale;
}) {
  const w = useHostPageCopy().roomNights;
  return (
    <div className="flex flex-col gap-block">
      <p className="nf-caption">{w.horizonNote}</p>
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} locale={locale} />
      ))}
    </div>
  );
}

function RoomCard({ room, locale }: { room: MyRoomType; locale: Locale }) {
  const hw = useHostCopy();
  const w = useHostPageCopy().roomNights;
  const router = useRouter();
  /* Today in Lagos (UTC+1 all year), not in UTC: between midnight and one in
     the morning the UTC date is still yesterday, and the editor offered it. */
  const [today] = useState(() => isoDate(new Date(Date.now() + 3_600_000)));
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [units, setUnits] = useState(String(room.unitsTotal));
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const unitsNumber = Number.parseInt(units, 10);
  const valid = Number.isFinite(unitsNumber) && unitsNumber >= 0 && to >= from;

  function apply() {
    setNotice(null);
    start(async () => {
      const result = await setRoomNights({
        roomTypeId: room.id,
        from,
        to,
        unitsOpen: unitsNumber,
      });
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      setNotice({
        tone: "ok",
        text:
          unitsNumber === 0
            ? w.closedDone.replace("{nights}", countOf(result.data.nights, "nights", locale))
            : w.onSaleDone.replace("{units}", String(unitsNumber)).replace("{nights}", countOf(result.data.nights, "nights", locale)),
      });
      router.refresh();
    });
  }

  return (
    <section className="nf-panel nf-panel--card block nf-host-group">
      {/* THE NAME AND THE STATE DO NOT SHARE A LINE ON A PHONE, for the reason
          written on the host's standing page: "Executive suite" beside "Not
          live yet" leaves about 120px for a room name. A grid, stacked at 390
          and a pair from sm up. */}
      <div className="grid gap-2xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-sm">
        <span className="min-w-0">
          <h2 className="nf-host-group__title">{room.name}</h2>
          <span className={`block ${TYPE.rowMeta}`}>
            {countOf(room.unitsTotal, "rooms", locale)} · {w.sleeps.replace("{n}", String(room.sleeps))}
            {room.lowestRateMinor !== null
              ? ` · ${w.fromANight.replace("{rate}", formatMoney(room.lowestRateMinor, locale))}`
              : ""}
          </span>
        </span>
        <StatusPill
          tone={toneForStatus(room.status)}
          className="justify-self-start sm:justify-self-end"
        >
          {room.status === "PUBLISHED" ? w.onShelf : w.notOnShelf}
        </StatusPill>
      </div>

      {/* THE SENTENCE THAT WAS IMPOSSIBLE TO WRITE BEFORE THE ROWS EXISTED.
          A room with no nights is not a room offering none: it is a room no
          dated search can return, and it is said in those words. */}
      <p className="nf-host-group__note mt-row">
        {room.lowestRateMinor === null
          ? w.noRate
          : room.nightsOnSale === 0
            ? w.noNights
            : (room.lastNightOnSale ? w.bookableTo.replace("{last}", room.lastNightOnSale) : w.bookable).replace(
                "{nights}",
                countOf(room.nightsOnSale, "nights", locale),
              )}
      </p>

      <div className="mt-md grid grid-cols-2 gap-sm">
        <TextField
          label={hw.nights.firstNight}
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <TextField
          label={hw.nights.lastNight}
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>
      <div className="mt-sm">
        <TextField
          label={hw.nights.roomsOnSale}
          type="number"
          min={0}
          max={room.unitsTotal}
          hint={w.unitsHint.replace("{total}", String(room.unitsTotal))}
          value={units}
          onChange={(event) => setUnits(event.target.value)}
        />
      </div>

      <Button
        variant="primary"
        size="lg"
        full
        className="mt-md"
        disabled={pending || !valid}
        loading={pending}
        onClick={apply}
      >
        {unitsNumber === 0 ? w.closeThese : w.putOnSale}
      </Button>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`nf-caption mt-row ${
            notice.tone === "error"
              ? "text-[var(--nf-state-error)]"
              : "text-[var(--nf-state-success)]"
          }`}
        >
          {notice.text}
        </p>
      )}
    </section>
  );
}
