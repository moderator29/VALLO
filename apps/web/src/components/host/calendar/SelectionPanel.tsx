"use client";

import { useState } from "react";
import { Quantity } from "@/components/ui/Quantity";
import { useRouter } from "next/navigation";
import { countOf, formatMoney, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { setNightPrice, setNightsClosed, setNightsRooms } from "@/lib/host/calendar-actions";
import {
  bookedFloor,
  describeSelection,
  nairaToMinor,
  type CalendarRoom,
  type NightCell,
  type RatePlanLite,
} from "@/lib/host/rate-calendar";
import { useHostPageCopy } from "../host-copy";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * WHAT A HOST CAN DO TO THE NIGHTS THEY SELECTED: price them, put a number
 * of rooms on sale, close them or open them again. The panel beside the
 * month on a desk, the sheet on a phone. Every button is one server action
 * (`lib/host/calendar-actions.ts`) that writes the host's input and prices
 * nothing.
 *
 * THE FLOOR IS SAID BEFORE ANYBODY TAPS: the fewest rooms a run may be left
 * with is what is already held on its busiest night, because the database
 * refuses less, and a refusal after the tap is a worse way to learn it.
 */
export function SelectionPanel({
  room,
  plan,
  dates,
  cells,
  locale,
  onDone,
  onClear,
}: {
  room: CalendarRoom;
  plan: RatePlanLite | null;
  dates: string[];
  cells: NightCell[];
  locale: Locale;
  onDone: (message: string) => void;
  onClear: () => void;
}) {
  const router = useRouter();
  const w = useHostPageCopy().calendarUi;
  const [pending, start] = useSafeTransition();
  const [price, setPrice] = useState("");
  const floor = bookedFloor(cells);
  const openNow = cells.map((c) => c.unitsOpen ?? 0);
  const [units, setUnits] = useState(() => (openNow.length ? Math.max(...openNow, floor) : room.unitsTotal));
  const [error, setError] = useState<string | null>(null);

  if (dates.length === 0) {
    return (
      <div className="nf-rcal-panel nf-rcal-panel--empty">
        <span className="nf-rcal-panel__icon" aria-hidden="true">
          <UiIcon name="calendar-check" size={20} />
        </span>
        <p className="nf-rcal-panel__title">{w.selectTitle}</p>
        <p className="nf-caption">{w.selectHow}</p>
      </div>
    );
  }

  const prices = cells.map((c) => c.priceMinor).filter((p): p is number => p !== null);
  const low = prices.length ? Math.min(...prices) : null;
  const high = prices.length ? Math.max(...prices) : null;
  const overrides = cells.some((c) => c.overrideMinor !== null);
  const closed = cells.some((c) => c.closed);
  const allClosed = cells.length > 0 && cells.every((c) => c.closed);
  const nights = countOf(dates.length, "nights", locale);
  const priceMinor = nairaToMinor(price);

  const run = (
    act: () => Promise<{ ok: true; data: { nights: number; heldBack?: number } } | { ok: false; error: string }>,
    word: (n: number, extra?: { heldBack?: number }) => string,
  ) =>
    start(async () => {
      try {
        setError(null);
        const result = await act();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onDone(word(result.data.nights, result.data));
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const count = (n: number) => countOf(n, "nights", locale);

  return (
    <div className="nf-rcal-panel" data-testid="rate-calendar-panel">
      <div className="nf-rcal-panel__head">
        <div className="min-w-0">
          <p className="nf-rcal-panel__title">{nights}</p>
          <p className="nf-caption">{describeSelection(dates, w.selection)}</p>
        </div>
        <Button variant="quiet" size="sm" onClick={onClear} disabled={pending}>
          {w.clear}
        </Button>
      </div>

      <dl className="nf-rcal-panel__facts">
        <div>
          <dt>{w.nightNow}</dt>
          <dd className="nf-numeric">
            {low === null
              ? w.noRateShort
              : low === high
                ? formatMoney(low, locale)
                : w.priceRange.replace("{low}", formatMoney(low, locale)).replace("{high}", formatMoney(high ?? low, locale))}
          </dd>
        </div>
        {cells.some((c) => c.held > 0) ? (
          <div>
            <dt>{w.heldByOthers}</dt>
            <dd className="nf-numeric">
              {(() => {
                const top = cells.reduce((best, c) => (c.held > best.held ? c : best), cells[0]!);
                return `${w.upToANight.replace("{count}", String(top.held))}${top.imported ? `, ${top.imported}` : ""}`;
              })()}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>{w.alreadyBooked}</dt>
          <dd className="nf-numeric">{floor === 0 ? w.none : w.upToANight.replace("{count}", String(floor))}</dd>
        </div>
      </dl>

      {plan ? (
        <section className="nf-rcal-panel__block" aria-label={w.priceLabel}>
          <h3 className="nf-section-label">{w.priceANight}</h3>
          <div className="nf-rcal-panel__row">
            <TextField
              label={w.priceFor.replace("{nights}", nights)}
              hideLabel
              inputMode="decimal"
              placeholder={formatMoney(plan.rateMinor, locale)}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              disabled={pending}
              leadingIcon="banknote"
            />
            <Button
              variant="primary"
              size="md"
              disabled={pending || priceMinor === null || priceMinor < 100}
              loading={pending}
              onClick={() =>
                run(
                  () => setNightPrice({ roomTypeId: room.id, ratePlanId: plan.id, dates, rateMinor: priceMinor }),
                  (n) =>
                    w.pricedDone
                      .replace("{nights}", count(n))
                      .replace("{price}", formatMoney(priceMinor ?? 0, locale))
                      .replace("{plan}", plan.name),
                )
              }
            >
              {w.setPrice}
            </Button>
          </div>
          {overrides ? (
            <Button
              variant="quiet"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () => setNightPrice({ roomTypeId: room.id, ratePlanId: plan.id, dates, rateMinor: null }),
                  (n) => w.backOnRateDone.replace("{nights}", count(n)).replace("{rate}", formatMoney(plan.rateMinor, locale)),
                )
              }
            >
              {w.backToRate.replace("{rate}", formatMoney(plan.rateMinor, locale))}
            </Button>
          ) : null}
        </section>
      ) : null}

      <section className="nf-rcal-panel__block" aria-label={w.roomsOnSale}>
        <h3 className="nf-section-label">{w.roomsOnSale}</h3>
        <div className="nf-rcal-panel__row">
          <span className="inline-flex items-center gap-2xs">
            <Quantity
              value={units}
              min={floor}
              max={room.unitsTotal}
              label={w.roomsEachNight}
              decreaseLabel={w.oneFewer}
              increaseLabel={w.oneMore}
              disabled={pending}
              onChange={setUnits}
            />
            <span className="nf-caption nf-numeric text-[var(--nf-content-muted)]">{w.ofTotal.replace("{total}", String(room.unitsTotal))}</span>
          </span>
          <Button
            variant="secondary"
            size="md"
            disabled={pending}
            onClick={() =>
              run(
                () => setNightsRooms({ roomTypeId: room.id, dates, unitsOpen: units }),
                (n, extra) =>
                  units === 0
                    ? w.noRoomsDone.replace("{nights}", count(n))
                    : `${w.roomsDone.replace("{units}", String(units)).replace("{nights}", count(n))}${extra?.heldBack ? w.heldBackDone.replace("{nights}", count(extra.heldBack)) : ""}`,
              )
            }
          >
            {w.setRooms}
          </Button>
        </div>
        {floor > 0 ? (
          <p className="nf-caption">{w.atLeast.replace("{floor}", String(floor))}</p>
        ) : null}
      </section>

      <section className="nf-rcal-panel__block" aria-label={w.openOrClose}>
        <h3 className="nf-section-label">{w.openOrClose}</h3>
        <div className="nf-rcal-panel__row nf-rcal-panel__row--split">
          {!allClosed ? (
            <Button
              variant="dangerQuiet"
              size="md"
              leadingIcon="lock"
              disabled={pending || !plan}
              onClick={() =>
                run(() => setNightsClosed({ roomTypeId: room.id, dates, closed: true }), (n) => w.closeDone.replace("{nights}", count(n)))
              }
            >
              {w.close}
            </Button>
          ) : null}
          {closed ? (
            <Button
              variant="secondary"
              size="md"
              disabled={pending}
              onClick={() =>
                run(() => setNightsClosed({ roomTypeId: room.id, dates, closed: false }), (n) => w.reopenDone.replace("{nights}", count(n)))
              }
            >
              {w.reopen}
            </Button>
          ) : null}
        </div>
        <p className="nf-caption">{w.closingKeeps}</p>
        {cells.some((c) => c.held > 0) ? (
          <p className="nf-caption">{w.heldStayOff}</p>
        ) : null}
      </section>

      {error ? (
        <p className="nf-rcal-panel__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
