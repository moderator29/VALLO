"use client";
import { banner } from "@/lib/ui/toast";
import "@/app/host/host-desk.css";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { countOf, formatMoney, type Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { BatchTray } from "@/components/ui/BatchTray";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { feedback } from "@/lib/ui/feedback";
import {
  addDays,
  addMonths,
  cellFor,
  describeSelection,
  heldWords,
  monthGrid,
  presetNights,
  primaryPlan,
  rangeInclusive,
  toneOf,
  type CalendarRoom,
  type CalendarRows,
  type NightCell,
  type Preset,
} from "@/lib/host/rate-calendar";
import type { SyncState } from "@/lib/host/rate-calendar-queries";
import { SelectionPanel } from "./SelectionPanel";
import { RatePlanSheet } from "./RatePlanSheet";
import { CalendarSync } from "./CalendarSync";
import { useHostPageCopy } from "../host-copy";
import type { Dictionary } from "@vallo/i18n/core";

type CalendarWords = Dictionary["experienceHost"]["calendarUi"];

/**
 * THE HOST'S RATE CALENDAR (C1, 30 September 2026). One month, one room type
 * at a time, every night showing what a guest would pay and how many rooms
 * are on sale. Select nights, then set a price, set the rooms, close or
 * reopen them, in one sheet (a phone) or the panel beside the month (a desk).
 *
 * HOW A SELECTION IS MADE, on every kind of pointer:
 *   tap              one night; tap a second night and the run between them
 *                    is selected; tap the only selected night to clear it
 *   press and drag   a mouse or pen drags at once; a finger holds for a
 *                    moment first (the grid would otherwise steal the page's
 *                    scroll), feels a tick, then drags
 *   shift and click  extends from the last night chosen; ctrl or cmd toggles
 *   keyboard         arrows move, Home and End go to the week's ends, shift
 *                    and a move extends, space or enter selects
 *   presets          Friday and Saturday nights, Sunday to Thursday, the
 *                    whole month
 * A night that has gone cannot be selected.
 *
 * WHAT A CELL SAYS IS COUNTED, NEVER INFERRED: the price is
 * `override ?? plan rate`, the same coalesce the database prices by, and the
 * rooms are `units_open - units_booked` from the row. A night with no row is
 * "not on sale", which is not the same as closed and never drawn like it.
 */

export type RateCalendarProps = {
  accommodationName: string;
  businessId: string;
  rooms: CalendarRoom[];
  rates: [string, { rateMinor: number | null; closed: boolean }][];
  inventory: [string, { unitsOpen: number; unitsBooked: number }][];
  imported: [string, string][];
  /** C2b: rooms other sites hold, by room and night. */
  held?: [string, number][];
  month: string;
  today: string;
  initialRoomId: string | null;
  maxMonth: string;
  sync: SyncState;
  feedBase: string;
  locale: Locale;
  /** The batch tray's clear control, from `experienceUi.clearSelection`. */
  clearSelectionLabel?: string;
};

const LONG_PRESS_MS = 260;
const MOVE_SLOP = 8;

type Drag =
  | { mode: "idle" }
  | { mode: "pending"; start: string; x: number; y: number; timer: number; base: Set<string> }
  | { mode: "drag"; start: string; last: string; moved: boolean; base: Set<string>; pointer: string };

function monthTitle(month: string, locale: Locale): string {
  const tag = locale === "en" ? "en-NG" : locale;
  return new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
}

/** "2 held by Airbnb", in the reader's words; null when no other site holds a room. */
function heldBy(cell: NightCell, w: CalendarWords): string | null {
  return heldWords(cell, w.heldBy);
}

function cellWords(cell: NightCell, locale: Locale, w: CalendarWords): string {
  const tag = locale === "en" ? "en-NG" : locale;
  const day = new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${cell.date}T12:00:00Z`),
  );
  const tone = toneOf(cell);
  const price = cell.priceMinor !== null ? formatMoney(cell.priceMinor, locale) : w.cellNoRate;
  const left = cell.unitsOpen !== null ? Math.max(cell.unitsOpen - cell.unitsBooked, 0) : 0;
  const state =
    tone === "past"
      ? w.cellGone
      : tone === "imported"
        ? w.cellNoRoomLeft.replace("{why}", heldBy(cell, w) ?? w.cellBookedOn.replace("{site}", cell.imported ?? ""))
        : tone === "closed"
          ? w.cellIsClosed
          : tone === "none"
            ? w.cellNotOnSale
            : tone === "full"
              ? w.cellFullyBooked
              : countOf(left, "roomsLeft", locale);
  const own = tone === "override" ? w.cellOwnPrice : "";
  const elsewhere = cell.imported && tone !== "imported" ? `, ${heldBy(cell, w)}` : "";
  return `${day}, ${price}${own}, ${state}${elsewhere}`;
}

export function RateCalendar(props: RateCalendarProps) {
  const { rooms, month, today, locale } = props;
  const w = useHostPageCopy().calendarUi;
  const rows: CalendarRows = useMemo(
    () => ({
      rates: new Map(props.rates),
      inventory: new Map(props.inventory),
      imported: new Map(props.imported),
      held: new Map(props.held ?? []),
    }),
    [props.rates, props.inventory, props.imported, props.held],
  );
  const [roomId, setRoomId] = useState(() => rooms.find((r) => r.id === props.initialRoomId)?.id ?? rooms[0]?.id ?? "");
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
  const [planId, setPlanId] = useState<string | null>(null);
  const plan = room ? primaryPlan(room, planId) : null;

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [planSheet, setPlanSheet] = useState(false);
  const drag = useRef<Drag>({ mode: "idle" });
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [focusDate, setFocusDate] = useState<string>(() => (today.slice(0, 7) === month ? today : `${month}-01`));

  const weeks = useMemo(() => monthGrid(month), [month]);
  const cells = useMemo(() => {
    const map = new Map<string, NightCell>();
    if (!room) return map;
    for (const week of weeks) for (const date of week) if (date) map.set(date, cellFor(room, plan, date, rows, today));
    return map;
  }, [room, plan, rows, weeks, today]);

  /* A new room starts a new selection (its click handler clears it), and a
     new month is a new mount (the page keys this component by month): nights
     chosen on one room are not a choice about another. */

  const selectable = useCallback((date: string) => date >= today && date.slice(0, 7) === month, [today, month]);
  const range = useCallback((a: string, b: string) => rangeInclusive(a, b).filter(selectable), [selectable]);

  const tapNight = useCallback(
    (date: string, base: Set<string>, keys: { shift?: boolean; toggle?: boolean } = {}) => {
      if (!selectable(date)) return;
      if (keys.toggle) {
        const next = new Set(base);
        if (next.has(date)) next.delete(date);
        else next.add(date);
        setSelected(next);
        setAnchor(date);
        return;
      }
      if (keys.shift && anchor) {
        setSelected(new Set(range(anchor, date)));
        return;
      }
      if (base.size === 1 && anchor && base.has(anchor)) {
        if (anchor === date) {
          setSelected(new Set());
          setAnchor(null);
        } else setSelected(new Set(range(anchor, date)));
        return;
      }
      setSelected(new Set([date]));
      setAnchor(date);
    },
    [anchor, range, selectable],
  );

  /* A finger in drag mode must not scroll the page. Only a non-passive
     touchmove listener can stop that, so it is added by hand. */
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const stop = (event: TouchEvent) => {
      if (drag.current.mode === "drag") event.preventDefault();
    };
    grid.addEventListener("touchmove", stop, { passive: false });
    return () => grid.removeEventListener("touchmove", stop);
  }, []);

  const dateAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-date]");
    return el?.dataset.date ?? null;
  };

  const startDrag = (start: string, base: Set<string>, pointer: string) => {
    drag.current = { mode: "drag", start, last: start, moved: false, base, pointer };
    setSelected(new Set(range(start, start)));
    setAnchor(start);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, date: string) => {
    if (!selectable(date) || event.button !== 0) return;
    const base = new Set(selected);
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      tapNight(date, base, { shift: event.shiftKey, toggle: event.metaKey || event.ctrlKey });
      event.preventDefault();
      return;
    }
    if (event.pointerType === "touch") {
      const timer = window.setTimeout(() => {
        if (drag.current.mode !== "pending") return;
        feedback("select");
        startDrag(drag.current.start, drag.current.base, "touch");
      }, LONG_PRESS_MS);
      drag.current = { mode: "pending", start: date, x: event.clientX, y: event.clientY, timer, base };
      return;
    }
    drag.current = { mode: "drag", start: date, last: date, moved: false, base, pointer: "mouse" };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d.mode === "pending") {
      if (Math.abs(event.clientX - d.x) > MOVE_SLOP || Math.abs(event.clientY - d.y) > MOVE_SLOP) {
        window.clearTimeout(d.timer);
        drag.current = { mode: "idle" };
      }
      return;
    }
    if (d.mode !== "drag") return;
    const date = dateAt(event.clientX, event.clientY);
    if (!date || date === d.last) return;
    if (!d.moved) {
      d.moved = true;
      setAnchor(d.start);
    }
    d.last = date;
    setSelected(new Set(range(d.start, date)));
  };

  const endPointer = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = { mode: "idle" };
    if (d.mode === "pending") {
      window.clearTimeout(d.timer);
      if (event.type === "pointerup") tapNight(d.start, d.base);
      return;
    }
    if (d.mode === "drag" && !d.moved && d.pointer === "mouse" && event.type === "pointerup") {
      tapNight(d.start, d.base);
    }
  };

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    /* Home and End go to the start and end of the week row (the grid
       pattern), held inside this month. */
    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      tapNight(date, new Set(selected), { shift: event.shiftKey, toggle: event.metaKey || event.ctrlKey });
      return;
    }
    const by = step[event.key];
    if (by === undefined) return;
    event.preventDefault();
    let next = addDays(date, by);
    if (next.slice(0, 7) !== month) {
      if (event.key !== "Home" && event.key !== "End") return;
      next = event.key === "Home" ? `${month}-01` : addDays(`${addMonths(month, 1)}-01`, -1);
    }
    setFocusDate(next);
    if (event.shiftKey && selectable(next)) setSelected(new Set(range(anchor ?? date, next)));
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus();
  };

  const applyPreset = (preset: Preset) => {
    const nights = presetNights(month, preset, today);
    setSelected(new Set(nights));
    setAnchor(nights[0] ?? null);
  };

  const selectedDates = useMemo(() => [...selected].sort(), [selected]);
  const selectedCells = useMemo(
    () => selectedDates.map((d) => cells.get(d)).filter((c): c is NightCell => Boolean(c)),
    [selectedDates, cells],
  );

  const done = (message: string) => {
    /* Said by the one banner at the top of the screen (Grade 1). */
    banner.success(message);
    setSelected(new Set());
    setAnchor(null);
    setSheetOpen(false);
  };

  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const href = (m: string) => `/host/calendar?business=${props.businessId}&month=${m}${room ? `&room=${room.id}` : ""}`;
  const canPrev = prevMonth >= today.slice(0, 7);
  const canNext = nextMonth <= props.maxMonth;

  if (!room) return null;

  const panel = (
    <SelectionPanel
      key={`${room.id}-${plan?.id ?? "none"}-${selectedDates.join(",")}`}
      room={room}
      plan={plan}
      dates={selectedDates}
      cells={selectedCells}
      locale={locale}
      onDone={done}
      onClear={() => {
        setSelected(new Set());
        setAnchor(null);
        setSheetOpen(false);
      }}
    />
  );

  return (
    <div className="nf-rcal" data-testid="rate-calendar">
      <div className="nf-rcal__main">
        {rooms.length > 1 ? (
          <nav className="nf-rcal__rooms" aria-label={w.roomTypes}>
            {rooms.map((r) => (
              /* The raw chip: `Chip`'s selected state blooms, and this rail sits
                 beside the primary and the presets, so it keeps the calm
                 `nf-chip--active` tint like the rail beside it. */
              <button
                key={r.id}
                type="button"
                className={`nf-chip${r.id === room.id ? " nf-chip--active" : ""}`}
                aria-pressed={r.id === room.id}
                onClick={() => {
                  setRoomId(r.id);
                  setPlanId(null);
                  setSelected(new Set());
                  setAnchor(null);
                }}
              >
                {r.name}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="nf-rcal__plan">
          <div className="min-w-0">
            <p className="nf-rcal__plan-name">
              {room.name}
              {room.status !== "PUBLISHED" ? (
                <StatusBadge tone="neutral" className="ml-xs align-middle">
                  {w.notOnShelf}
                </StatusBadge>
              ) : null}
            </p>
            <p className="nf-caption">
              {plan
                ? w.planLine.replace("{plan}", plan.name).replace("{rate}", formatMoney(plan.rateMinor, locale))
                : w.noRate}
            </p>
          </div>
          {plan ? (
            <Button variant="secondary" size="sm" leadingIcon="pencil" onClick={() => setPlanSheet(true)}>
              {w.editRate}
            </Button>
          ) : null}
        </div>

        {room.plans.length > 1 ? (
          <div className="nf-rcal__plans" role="group" aria-label={w.whichRate}>
            {room.plans.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`nf-chip${p.id === plan?.id ? " nf-chip--active" : ""}`}
                aria-pressed={p.id === plan?.id}
                onClick={() => setPlanId(p.id)}
              >
                {p.name}
                {p.active ? "" : w.offSaleSuffix}
              </button>
            ))}
          </div>
        ) : null}

        <div className="nf-rcal__monthbar">
          {canPrev ? (
            <Link href={href(prevMonth)} className="nf-btn nf-btn--surface nf-btn--icon nf-btn--round" aria-label={w.previousMonth} scroll={false}>
              <UiIcon name="arrow-left" size={20} />
            </Link>
          ) : (
            <span className="nf-rcal__monthbar-gap" aria-hidden="true" />
          )}
          <h2 className="nf-rcal__month" aria-live="polite">
            {monthTitle(month, locale)}
          </h2>
          {canNext ? (
            <Link href={href(nextMonth)} className="nf-btn nf-btn--surface nf-btn--icon nf-btn--round" aria-label={w.nextMonth} scroll={false}>
              <UiIcon name="arrow-right" size={20} />
            </Link>
          ) : (
            <span className="nf-rcal__monthbar-gap" aria-hidden="true" />
          )}
        </div>

        <div className="nf-rcal__presets" role="group" aria-label={w.presets}>
          <button type="button" className="nf-chip nf-chip--sm" onClick={() => applyPreset("weekends")}>
            {w.weekends}
          </button>
          <button type="button" className="nf-chip nf-chip--sm" onClick={() => applyPreset("weekdays")}>
            {w.weekdaysPreset}
          </button>
          <button type="button" className="nf-chip nf-chip--sm" onClick={() => applyPreset("month")}>
            {w.everyNight}
          </button>
        </div>

        <div
          ref={gridRef}
          className="nf-rcal__grid"
          role="grid"
          aria-label={`${room.name}, ${monthTitle(month, locale)}`}
          aria-multiselectable="true"
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onContextMenu={(event) => {
            if (drag.current.mode !== "idle") event.preventDefault();
          }}
          onPointerLeave={(event) => {
            if (drag.current.mode === "drag") return;
            endPointer(event);
          }}
        >
          <div className="nf-rcal__week nf-rcal__week--head" role="row">
            {w.weekdays.map((day, i) => (
              <span key={day} role="columnheader" className={`nf-rcal__wd${i >= 4 && i <= 5 ? " nf-rcal__wd--wknd" : ""}`}>
                {day}
              </span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={`w${wi}`} className="nf-rcal__week" role="row">
              {week.map((date, i) => {
                if (!date) return <span key={`gap-${i}`} className="nf-rcal__cell nf-rcal__cell--gap" role="gridcell" aria-hidden="true" />;
                const cell = cells.get(date);
                if (!cell) return null;
                const tone = toneOf(cell);
                const left = cell.unitsOpen !== null ? Math.max(cell.unitsOpen - cell.unitsBooked, 0) : null;
                const isSelected = selected.has(date);
                return (
                  <button
                    key={date}
                    type="button"
                    role="gridcell"
                    data-date={date}
                    data-tone={tone}
                    data-today={date === today ? "" : undefined}
                    aria-selected={isSelected}
                    aria-disabled={cell.past || undefined}
                    aria-label={cellWords(cell, locale, w)}
                    title={cell.imported && tone !== "past" ? heldBy(cell, w) ?? undefined : undefined}
                    tabIndex={date === focusDate ? 0 : -1}
                    className={`nf-rcal__cell${isSelected ? " is-selected" : ""}`}
                    onPointerDown={(event) => onPointerDown(event, date)}
                    onKeyDown={(event) => moveFocus(event, date)}
                    onFocus={() => setFocusDate(date)}
                  >
                    <span className="nf-rcal__day">{Number(date.slice(8))}</span>
                    {cell.imported && tone !== "imported" ? <span className="nf-rcal__elsewhere" aria-hidden="true" /> : null}
                    <span className="nf-rcal__price nf-numeric">
                      {cell.priceMinor !== null ? formatMoney(cell.priceMinor, locale, "NGN", { compact: true }) : "-"}
                    </span>
                    <span className="nf-rcal__meta">
                      {tone === "imported"
                        ? cell.imported
                        : cell.imported && tone !== "past"
                          ? w.cellHeld.replace("{count}", String(cell.held))
                        : tone === "closed"
                          ? w.cellClosed
                          : tone === "none"
                            ? w.cellOffSale
                            : tone === "full"
                              ? w.cellFull
                              : tone === "past"
                                ? ""
                                : w.cellLeft.replace("{count}", String(left))}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <ul className="nf-rcal__legend" aria-label={w.legendLabel}>
          <li><span className="nf-rcal__key" data-tone="open" aria-hidden="true" />{w.legendOpen}</li>
          <li><span className="nf-rcal__key" data-tone="override" aria-hidden="true" />{w.legendOwn}</li>
          <li><span className="nf-rcal__key" data-tone="full" aria-hidden="true" />{w.legendFull}</li>
          <li><span className="nf-rcal__key" data-tone="closed" aria-hidden="true" />{w.legendClosed}</li>
          <li><span className="nf-rcal__key" data-tone="imported" aria-hidden="true" />{w.legendImported}</li>
          <li><span className="nf-rcal__key" data-tone="elsewhere" aria-hidden="true" />{w.legendElsewhere}</li>
          <li><span className="nf-rcal__key" data-tone="none" aria-hidden="true" />{w.legendNone}</li>
        </ul>

        <p className="nf-caption nf-rcal__fine">
          {w.fine}
        </p>
      </div>

      <aside className="nf-rcal__side" aria-label={w.sideLabel}>
        {panel}
        <CalendarSync room={room} sync={props.sync} feedBase={props.feedBase} locale={locale} />
      </aside>

      <div className="nf-rcal__sync-phone">
        <CalendarSync room={room} sync={props.sync} feedBase={props.feedBase} locale={locale} />
      </div>

      {/* THE SELECTED NIGHTS AS A BATCH (D34, COMPONENT_LIBRARY "Batch gesture
          tray": "the bulk actions the host workspace already has"). The phone's
          hand-rolled bar became the one tray the platform uses for a
          multi-select: the count said politely, Change opening the same panel
          as before, and Clear as the circle. Drag it down to clear. Phone only;
          from 1024px the panel beside the month is the action. */}
      <BatchTray
        className="nf-rcal-tray"
        count={selected.size}
        countLabel={`${countOf(selected.size, "nights", locale)}, ${describeSelection(selectedDates, w.selection)}`}
        label={w.selectedNights}
        clearLabel={props.clearSelectionLabel ?? w.clearSelection}
        onClear={() => {
          setSelected(new Set());
          setAnchor(null);
        }}
        actions={[{ id: "change", label: w.change, icon: "pencil", onSelect: () => setSheetOpen(true) }]}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title={w.sideLabel} detents={[0.9]}>
        {panel}
      </Sheet>

      {plan ? (
        <RatePlanSheet key={plan.id} open={planSheet} onOpenChange={setPlanSheet} plan={plan} locale={locale} onDone={(m: string) => banner.success(m)} />
      ) : null}
    </div>
  );
}
