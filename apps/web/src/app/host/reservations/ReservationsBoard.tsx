"use client";

import { dateTimeLabel, dayLabel as naturalDay } from "@/lib/format/when";
import { createContext, useActionState, useContext, useEffect, useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markReservationOutcome, respondToReservation } from "@/lib/reservations/actions";
import { confirmTableBill, enterTableBill, seatByCode } from "@/lib/reservations/seating-actions";
import { billOpen } from "@/lib/reservations/seating";
import { guestRecordLine } from "@/lib/reservations/guest-record";
import { NairaField } from "@/components/ui/NairaField";
import { formatMoney } from "@vallo/i18n/core";
import type { ActionResult } from "@/lib/actions/envelope";
import type { HostReservationView } from "@/lib/reservations/queries";
import type { HostTableBoard } from "./board";
import { buildDesk, filterDesk, type DeskTable } from "./desk";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmPanel } from "@/components/app/confirm/ConfirmPanel";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { KpiTile } from "@/components/ui/KpiTile";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { TYPE } from "@/components/app/Screen";
import { countOf, plural, type Dictionary, type Locale } from "@vallo/i18n/core";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import { useHostPageCopy } from "@/components/host/host-copy";
import { venueDepositLine } from "@/lib/reservations/deposits";

/**
 * The venue's table desk (`/host/reservations`).
 *
 * `private.notify_reservation` has been pointing a business host here since M7.
 * Since track/restaurant-desk it reads like a purpose-built restaurant desk
 * rather than a list of rows: TODAY at the top with four figures (covers
 * expected, requests to confirm, seated, done), a search across every table,
 * today's tables in time order, then the days ahead grouped by day, then what
 * has gone. Every request card carries the party, the time, the guest's note,
 * the guest record line (RESTAURANT-06) and Confirm or Decline.
 *
 * ## The decision goes through the path that already exists
 *
 * `respondToReservation` is the one action that answers a table, and it is the
 * same action `/agent/bookings` and `/host/decide` call. It writes through the
 * CALLER'S own client, so `reservations_update_business_host` decides whether
 * this person may answer, the guard `.eq("status", "PENDING")` means two taps
 * write once, and the answer is posted into the reservation's own thread in the
 * venue's voice. Nothing here is a second decision path.
 *
 * ## The time is pinned to Lagos, never the device
 *
 * A venue reading this on a phone still set to London must see the hour their
 * kitchen will actually serve the table. The instant the server rendered at is
 * handed in (`now`), so the server and the browser cut the same day.
 *
 * ## Confirm is not styled louder than decline
 *
 * Both are real answers and the venue is the one who knows which is true.
 */

const LAGOS = "Africa/Lagos";
const DIGITS = "en-NG";

export type TableDeskWords = Dictionary["tableDesk"];

/** D75: the deposit line on a table, `tableDeposits.desk.line`; absent while deposits are off. */
export type DeskDepositLines = Dictionary["tableDeposits"]["desk"]["line"];

type DeskContext = {
  words: TableDeskWords;
  locale: Locale;
  billsOn: boolean;
  multiVenue: boolean;
  now: Date;
  depositLines: DeskDepositLines | null;
};

const Desk = createContext<DeskContext | null>(null);

function useDesk(): DeskContext {
  const value = useContext(Desk);
  if (!value) throw new Error("A table card is drawn outside the table desk.");
  return value;
}

function timeLabel(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleTimeString(DIGITS, { timeZone: LAGOS, hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "Today", "Tomorrow", "Yesterday", then "Sat 25 Oct", on Lagos time (`lib/format/when`). */
function dayLabel(iso: string): string {
  return naturalDay(iso);
}

/** "Today, 19:30", "Tomorrow, 13:00", then "Sat 25 Oct, 19:30". */
function whenLabel(iso: string): string {
  return dateTimeLabel(iso);
}

function partyLabel(size: number, locale: Locale): string {
  return countOf(size, "guests", locale);
}

/**
 * The answer to a table request: Accept (Confirm on the desk) or Decline, each
 * through a confirm sheet. Also drawn by `/host/decide`, which keeps the
 * host pages' own words; the desk passes its own labels.
 */
export function Decision({
  table,
  labels,
  confirmBlocked = false,
}: {
  table: HostReservationView;
  /**
   * D75: the guest has not paid the deposit the restaurant's rule asks, so
   * the database would refuse a confirmation (`reservation_deposit_before_confirm`).
   * Confirm waits; Decline stays open. The card says why beside it.
   */
  confirmBlocked?: boolean;
  /** Words that replace the defaults, for a surface that says Confirm rather than Accept. */
  labels?: Partial<ReturnType<typeof useHostPageCopy>["tables"]>;
}) {
  const reservationId = table.id;
  const [state, formAction, pending] = useActionState<ActionResult<null> | null, FormData>(
    respondToReservation,
    null,
  );
  /* Which answer is being confirmed (plan item 22). The forms, their hidden
     fields and `respondToReservation` are exactly what they were; they sit in
     the confirm panel's foot instead of on the card. */
  const [asking, setAsking] = useState<"CONFIRMED" | "CANCELLED" | null>(null);
  const locale = useClientLocale();
  const w = { ...useHostPageCopy().tables, ...labels };

  if (state?.ok) {
    return (
      <p className={`mt-row ${TYPE.rowMeta}`} role="status">
        {w.answered}
      </p>
    );
  }

  const first = table.guestName.split(" ")[0] || table.guestName;
  const facts = [
    { label: w.guest, value: table.guestName },
    { label: w.when, value: whenLabel(table.reservedFor) },
    { label: w.party, value: partyLabel(table.partySize, locale) },
  ];
  const accept = asking === "CONFIRMED";

  return (
    <>
      <div className="mt-row flex flex-wrap gap-inline">
        <Button variant="primary" disabled={pending || confirmBlocked} onClick={() => setAsking("CONFIRMED")}>
          {w.accept}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => setAsking("CANCELLED")}>
          {w.decline}
        </Button>
      </div>
      <Sheet
        open={asking !== null}
        onOpenChange={(next) => {
          if (!next && !pending) setAsking(null);
        }}
        title={(accept ? w.acceptTitle : w.declineTitle).replace("{name}", first)}
        hideTitle
        card
        detents={[0.9]}
      >
        {asking ? (
          <ConfirmPanel
            icon={accept ? "utensils" : "circle-x"}
            tone={accept ? "brand" : "error"}
            title={(accept ? w.acceptTitle : w.declineTitle).replace("{name}", first)}
            context={table.listingTitle}
            summary={facts}
            next={
              accept
                ? [{ icon: "calendar-check", text: w.nextBooked }]
                : [{ icon: "calendar-check", text: w.nextClosed }]
            }
            told={w.told.replace("{name}", first)}
            error={state && !state.ok ? state.error : null}
            cancel={
              <Button variant="secondary" disabled={pending} onClick={() => setAsking(null)}>
                {w.cancel}
              </Button>
            }
            primary={
              /* One form per answer, so a decision cannot be changed by a
                 stray Enter key landing on the wrong button. */
              <form action={formAction}>
                <input type="hidden" name="reservationId" value={reservationId} />
                <input type="hidden" name="decision" value={asking} />
                <Button
                  type="submit"
                  variant={accept ? "primary" : "secondary"}
                  disabled={pending}
                  className={accept ? undefined : "text-[var(--nf-state-error)]"}
                >
                  {pending ? w.saving : accept ? w.acceptTable : w.declineTable}
                </Button>
              </form>
            }
          />
        ) : null}
      </Sheet>
      {state && !state.ok && asking === null && (
        <p role="alert" className={`mt-row ${TYPE.rowMeta} text-[var(--nf-state-error)]`}>
          {state.error}
        </p>
      )}
    </>
  );
}

/**
 * SEATED OR NOBODY CAME, recorded by the venue once a confirmed table's time
 * has passed. Nothing is charged here: a table is free to ask for. The mark is
 * what Vallo bills a restaurant on, so it is one deliberate tap each.
 */
function Outcome({ table }: { table: HostReservationView }) {
  const { words } = useDesk();
  const w = words.outcome;
  const [pending, start] = useTransition();
  const [done, setDone] = useState<"COMPLETED" | "NO_SHOW" | "DISPUTED" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const mark = (outcome: "COMPLETED" | "NO_SHOW") =>
    start(async () => {
      setError(null);
      const result = await markReservationOutcome({ reservationId: table.id, outcome });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result.data.disputed ? "DISPUTED" : outcome);
      router.refresh();
    });

  if (done) {
    return (
      <p className={`mt-row ${TYPE.rowMeta}`} role="status">
        {done === "DISPUTED" ? w.markedDisputed : done === "COMPLETED" ? w.markedSeated : w.markedNoShow}
      </p>
    );
  }
  return (
    <div className="mt-row" data-testid="table-outcome">
      <p className={TYPE.rowMeta}>{w.ask}</p>
      <div className="mt-inline flex flex-wrap gap-inline">
        <Button variant="primary" size="sm" disabled={pending} loading={pending} onClick={() => mark("COMPLETED")}>
          {w.seated}
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => mark("NO_SHOW")}>
          {w.noShow}
        </Button>
      </div>
      {error && (
        <p role="alert" className={`mt-row ${TYPE.rowMeta} text-[var(--nf-state-error)]`}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * THE GUEST ARRIVED (founder decision D). The guest shows a six-digit code;
 * typing it here marks their table as seated, which is what Vallo bills on
 * (1,000 naira per seated table, at the end of the month). Booking stays free
 * for the guest.
 */
function SeatByCode() {
  const { words } = useDesk();
  const w = words.seat;
  const id = useId();
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  return (
    <section className="nf-panel nf-panel--card block p-card" data-testid="seat-by-code" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="nf-h4 flex items-center gap-inline-tight">
        <UiIcon name="concierge-bell" size={20} aria-hidden />
        {w.title}
      </h3>
      <form
        className="mt-row flex flex-wrap items-end gap-inline"
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            setMessage(null);
            const result = await seatByCode(code);
            if (!result.ok) {
              setMessage({ ok: false, text: result.error });
              return;
            }
            setCode("");
            setMessage({ ok: true, text: w.done });
            router.refresh();
          });
        }}
      >
        {/* Six digits: a short field, not a full-width one, at every width. */}
        <label className="grid min-w-0 flex-1 gap-inline-tight sm:max-w-[16rem]" htmlFor={`${id}-code`}>
          <span className={TYPE.rowMeta}>{w.label}</span>
          <input
            id={`${id}-code`}
            className="nf-field nf-numeric w-full"
            inputMode="numeric"
            autoComplete="off"
            maxLength={7}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            data-testid="seat-code-input"
          />
        </label>
        <Button type="submit" variant="primary" disabled={pending || code.trim().length < 6} loading={pending}>
          {w.submit}
        </Button>
      </form>
      <p className={`mt-inline ${TYPE.caption}`}>{w.hint}</p>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`mt-row ${TYPE.rowMeta} ${message.ok ? "" : "text-[var(--nf-state-error)]"}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}

/**
 * THE BILL, entered by the restaurant or confirmed when the guest entered it.
 * A bill already on the table is always shown. The entry form is offered only
 * when paying through Vallo is switched on (`billsOn`): until then the guest
 * pays the restaurant directly, and a form promising otherwise would not be
 * true.
 */
function HostBill({ table }: { table: HostReservationView }) {
  const { words, locale, billsOn, now } = useDesk();
  const w = words.bill;
  const [amount, setAmount] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  if (!table.seating) return null;
  const bill = table.bill ?? null;
  const money = (minor: number) => formatMoney(minor, locale, "NGN");
  const act = (job: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const result = await job();
      if (!result.ok) {
        setError(result.error ?? w.failed);
        return;
      }
      setAmount("");
      router.refresh();
    });

  if (bill?.status === "paid") {
    return <p className={`mt-row ${TYPE.rowMeta}`}>{w.paid.replace("{amount}", money(bill.amountMinor))}</p>;
  }
  if (bill?.status === "pending") {
    return <p className={`mt-row ${TYPE.rowMeta}`}>{w.paying.replace("{amount}", money(bill.amountMinor))}</p>;
  }
  if (!billOpen(table, now)) return null;
  if (!billsOn) {
    return bill?.status === "awaiting_payment" ? (
      <p className={`mt-row ${TYPE.rowMeta}`}>{w.sent.replace("{amount}", money(bill.amountMinor))}</p>
    ) : null;
  }
  return (
    <div className="mt-row grid gap-inline" data-testid="host-bill">
      {bill?.status === "awaiting_restaurant" && (
        <div className="grid gap-inline">
          <p className={TYPE.rowMeta}>{w.check.replace("{amount}", money(bill.amountMinor))}</p>
          <span>
            <Button variant="primary" size="sm" disabled={pending} onClick={() => act(() => confirmTableBill(bill.id))}>
              {w.confirm}
            </Button>
          </span>
        </div>
      )}
      {bill?.status === "awaiting_payment" && (
        <p className={TYPE.rowMeta}>{w.sent.replace("{amount}", money(bill.amountMinor))}</p>
      )}
      <NairaField label={w.label} hint={w.hint} value={amount} onValueChange={setAmount} allowKobo />
      <span>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending || amount.length === 0}
          onClick={() => act(() => enterTableBill(table.id, amount))}
        >
          {bill ? w.sendInstead : w.send}
        </Button>
      </span>
      {error && (
        <p role="alert" className={`${TYPE.rowMeta} text-[var(--nf-state-error)]`}>
          {error}
        </p>
      )}
    </div>
  );
}

/** The status word and its tone, for one table. */
function statusOf(table: DeskTable, words: TableDeskWords): { tone: StatusTone; word: string } {
  const s = words.status;
  if (table.seating?.disputed) return { tone: "warning", word: s.disputed };
  switch (table.status) {
    case "PENDING":
      return table.decidable ? { tone: "warning", word: s.request } : { tone: "neutral", word: s.lapsed };
    case "CONFIRMED":
      return { tone: "success", word: s.confirmed };
    case "COMPLETED":
      return { tone: "info", word: s.seated };
    case "NO_SHOW":
      return { tone: "danger", word: s.noShow };
    default:
      return { tone: "neutral", word: s.closed };
  }
}

function TableCard({ table, showDay = false }: { table: DeskTable; showDay?: boolean }) {
  const { words, locale, multiVenue, depositLines } = useDesk();
  const host = useHostPageCopy().tables;
  const deposit = depositLines && table.deposit
    ? venueDepositLine(table.deposit, (minor) => formatMoney(minor, locale, "NGN"), depositLines)
    : null;
  const depositUnpaid = table.deposit?.status === "due" || table.deposit?.status === "pending";
  const { tone, word } = statusOf(table, words);
  const record = table.decidable ? guestRecordLine(table.guestRecord, words.record, locale) : null;
  const closed = table.status === "CANCELLED" || (table.status === "PENDING" && !table.decidable);
  /* A table the guest answered for (the restaurant never marked it) can still
     be marked; a different answer goes to Vallo as a dispute. */
  const markable =
    table.passed &&
    (table.status === "CONFIRMED" || (table.seating?.outcomeBy === "diner" && !table.seating.restaurantAnswer));

  return (
    <li
      className={`nf-panel nf-panel--card block p-card ${closed ? "opacity-75" : ""}`}
      data-testid="desk-table"
      data-status={table.status}
    >
      <div className="flex items-start justify-between gap-inline">
        <div className="min-w-0">
          <p className="nf-h4 nf-numeric text-[var(--nf-content-primary)]">{timeLabel(table.reservedFor)}</p>
          {showDay && <p className={TYPE.caption}>{dayLabel(table.reservedFor)}</p>}
        </div>
        <StatusPill tone={tone}>{word}</StatusPill>
      </div>

      <p className={`mt-inline-tight flex flex-wrap items-center gap-x-group gap-y-inline-tight ${TYPE.rowMeta}`}>
        <span className="inline-flex min-w-0 items-center gap-inline-tight font-semibold text-[var(--nf-content-primary)]">
          <UiIcon name="user" size={16} aria-hidden />
          {table.guestName}
        </span>
        <span className="nf-numeric inline-flex items-center gap-inline-tight">
          <UiIcon name="users" size={16} aria-hidden />
          {partyLabel(table.partySize, locale)}
        </span>
        {multiVenue && (
          <span className="inline-flex min-w-0 items-center gap-inline-tight">
            <UiIcon name="storefront" size={16} aria-hidden />
            {table.listingTitle}
          </span>
        )}
      </p>

      {record && (
        <p className={`mt-inline-tight flex items-center gap-inline-tight ${TYPE.caption}`} data-testid="guest-record">
          <UiIcon name="history" size={16} aria-hidden />
          {record}
        </p>
      )}

      {deposit && (
        <p
          className={`mt-inline-tight flex items-center gap-inline-tight ${TYPE.caption}`}
          data-testid="desk-deposit"
          data-deposit={table.deposit?.status}
        >
          <UiIcon name="credit-card" size={16} aria-hidden />
          {deposit}
        </p>
      )}

      {/* Never truncated. A note is where an allergy goes, and a shortened
          allergy is worse than no allergy at all. */}
      {table.note && (
        <p className={`mt-row rounded-[var(--nf-container-radius)] bg-[var(--nf-surface-raised)] px-row py-inline ${TYPE.rowMeta}`}>
          <span className="sr-only">{words.card.note}: </span>
          {table.note}
        </p>
      )}

      {table.conversationId && (
        <Link
          href={`/messages/${table.conversationId}`}
          /* The link ink is set last and on its own, not through `TYPE.rowMeta`:
             both are arbitrary-value utilities of equal specificity, and a link
             that does not look like a link is not a link. */
          className="nf-tap nf-body-sm mt-row inline-flex items-center gap-inline-tight font-semibold text-[var(--nf-content-link)] underline-offset-4 hover:underline"
        >
          {host.talkTo.replace("{name}", table.guestName)}
          <UiIcon name="arrow-right" size={16} />
        </Link>
      )}

      {table.decidable && (
        <Decision
          table={table}
          confirmBlocked={depositUnpaid}
          labels={{
            accept: words.card.confirm,
            decline: words.card.decline,
            acceptTitle: words.card.confirmTitle,
            acceptTable: words.card.confirmTable,
          }}
        />
      )}
      {markable && <Outcome table={table} />}
      {(table.status === "CONFIRMED" || table.status === "COMPLETED") && <HostBill table={table} />}
    </li>
  );
}

function Cards({ tables, showDay = false }: { tables: DeskTable[]; showDay?: boolean }) {
  return (
    <ul className="mt-row grid items-start gap-row lg:grid-cols-2">
      {tables.map((table) => (
        <TableCard key={table.id} table={table} showDay={showDay} />
      ))}
    </ul>
  );
}

function SectionHead({ id, title, count, aside }: { id: string; title: string; count?: number; aside?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-inline gap-y-inline-tight">
      <h2 id={id} className={TYPE.sectionTitle}>
        {title}
        {typeof count === "number" && count > 0 && (
          <span className="nf-numeric ml-inline-tight font-normal text-[var(--nf-content-muted)]">{count}</span>
        )}
      </h2>
      {aside && <p className={TYPE.rowMeta}>{aside}</p>}
    </div>
  );
}

export function HostReservationsBoard({
  board,
  words,
  now,
  locale,
  billsOn = false,
  title,
  depositLines = null,
}: {
  board: HostTableBoard;
  /** D75: the deposit line words, while `restaurant_deposits` is on; null draws no deposit line. */
  depositLines?: DeskDepositLines | null;
  /** `tableDesk`, in the reader's language. */
  words: TableDeskWords;
  /** The instant the server rendered at, as ISO, so both sides cut the same Lagos day. */
  now: string;
  locale: Locale;
  /** Whether a restaurant can take the bill through Vallo yet (Paystack configured). */
  billsOn?: boolean;
  /** The page title, its standing line and today's date, drawn beside the search. */
  title: { heading: string; line: string; date: string };
}) {
  const at = useMemo(() => new Date(now), [now]);
  const desk = useMemo(() => buildDesk(board, at), [board, at]);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterDesk(desk, query), [desk, query]);
  const searching = query.trim().length > 0;
  const searchId = useId();
  const multiVenue = useMemo(
    () => new Set([...board.requests, ...board.upcoming, ...board.past].map((t) => t.listingTitle)).size > 1,
    [board],
  );
  const context = useMemo(
    () => ({ words, locale, billsOn, multiVenue, now: at, depositLines }),
    [words, locale, billsOn, multiVenue, at, depositLines],
  );
  /* The code box is offered once seating is switched on (the reads carry a
     seating row) and a confirmed table exists to seat. */
  const seatable = [...board.upcoming, ...board.past].some(
    (table) => table.status === "CONFIRMED" && Boolean(table.seating),
  );
  /* Earlier opens by itself only when a table there still needs its mark. */
  const earlierNeedsMark = shown.earlier.some((t) => t.status === "CONFIRMED");
  const [earlierOpen, setEarlierOpen] = useState(earlierNeedsMark);
  useEffect(() => {
    if (searching && shown.earlier.length > 0) setEarlierOpen(true);
  }, [searching, shown.earlier.length]);

  const f = desk.figures;
  const tables = (n: number) => plural(n, words.tables, locale);

  return (
    <Desk.Provider value={context}>
      <div className="nf-agent-head">
        <div className="min-w-0">
          <h1 className="nf-agent-head__title">{title.heading}</h1>
          <p className={`mt-row ${TYPE.bodyLg}`}>{title.line}</p>
        </div>
        <form role="search" className="w-full lg:w-auto lg:min-w-[20rem]" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor={searchId} className="sr-only">
            {words.search.label}
          </label>
          <div className="flex items-center gap-inline">
            <input
              id={searchId}
              type="search"
              className="nf-field w-full"
              placeholder={words.search.placeholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              enterKeyHint="search"
              autoComplete="off"
              data-testid="desk-search"
            />
          </div>
        </form>
      </div>

      {searching && (
        <div className="flex flex-wrap items-center justify-between gap-inline" aria-live="polite">
          <p className={TYPE.rowMeta}>
            {shown.count === 0 ? words.search.none : plural(shown.count, words.search.results, locale)}
          </p>
          <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
            {words.search.clear}
          </Button>
        </div>
      )}

      {(!searching || shown.todayTables.length > 0) && (
      <section aria-labelledby="desk-today" className={searching ? "mt-block" : undefined}>
        <SectionHead id="desk-today" title={words.today} count={shown.todayTables.length} aside={title.date} />
        {!searching && (
          <div className="nf-figure-tiles mt-row" role="group" aria-label={words.figuresLabel}>
            <KpiTile
              icon="users"
              label={words.figures.covers}
              value={f.coversExpected}
              tag={DIGITS}
              sub={words.figures.coversSub.replace("{tables}", tables(f.coverTables))}
            />
            <KpiTile
              icon="hourglass"
              label={words.figures.toConfirm}
              value={f.toConfirm}
              tag={DIGITS}
              sub={
                f.toConfirmLater > 0
                  ? plural(f.toConfirmLater, words.figures.toConfirmLater, locale)
                  : words.figures.toConfirmNoneLater
              }
            />
            <KpiTile
              icon="utensils"
              label={words.figures.seated}
              value={f.seated}
              tag={DIGITS}
              sub={partyLabel(f.seatedGuests, locale)}
            />
            <KpiTile
              icon="circle-check"
              label={words.figures.done}
              value={f.done}
              tag={DIGITS}
              sub={words.figures.doneSub.replace("{tables}", tables(f.booked))}
            />
          </div>
        )}
        {seatable && !searching && (
          <div className="mt-row">
            <SeatByCode />
          </div>
        )}
        {shown.todayTables.length === 0 ? (
          searching ? null : <p className={`mt-row ${TYPE.rowMeta}`}>{words.todayEmpty}</p>
        ) : (
          <Cards tables={shown.todayTables} />
        )}
      </section>
      )}

      {/* While searching, a section with no match is left out rather than drawn as a bare heading. */}
      {(!searching || shown.upcoming.length > 0) && (
      <section aria-labelledby="desk-upcoming" className="mt-block">
        <SectionHead
          id="desk-upcoming"
          title={words.upcoming}
          count={shown.upcoming.reduce((n, g) => n + g.tables.length, 0)}
        />
        {shown.upcoming.length === 0 ? (
          searching ? null : <p className={`mt-row ${TYPE.rowMeta}`}>{words.upcomingEmpty}</p>
        ) : (
          shown.upcoming.map((group) => (
            <div key={group.day} className="mt-row">
              <div className="flex flex-wrap items-baseline justify-between gap-x-inline border-b border-[var(--nf-border-subtle)] pb-inline-tight">
                <h3 className="nf-h4 text-[var(--nf-content-primary)]">{dayLabel(group.tables[0]!.reservedFor)}</h3>
                {group.live > 0 && (
                  <p className={`nf-numeric ${TYPE.caption}`}>
                    {words.dayCovers
                      .replace("{tables}", tables(group.live))
                      .replace("{guests}", partyLabel(group.guests, locale))}
                  </p>
                )}
              </div>
              <Cards tables={group.tables} />
            </div>
          ))
        )}
      </section>
      )}

      {(shown.earlier.length > 0 || !searching) && (
        <section aria-labelledby="desk-earlier" className="mt-block">
          <details
            open={earlierOpen}
            onToggle={(event) => setEarlierOpen((event.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="nf-tap flex cursor-pointer list-none items-center justify-between gap-inline">
              <SectionHead id="desk-earlier" title={words.earlier} count={shown.earlier.length} />
              <UiIcon name="chevron-down" size={20} aria-hidden className={earlierOpen ? "rotate-180" : undefined} />
            </summary>
            {shown.earlier.length === 0 ? (
              <p className={`mt-row ${TYPE.rowMeta}`}>{words.earlierEmpty}</p>
            ) : (
              <Cards tables={shown.earlier} showDay />
            )}
          </details>
        </section>
      )}
    </Desk.Provider>
  );
}
