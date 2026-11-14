"use client";

import { plural } from "@vallo/i18n/core";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { CountTabs } from "@/components/ui/CountTabs";
import { Panel } from "@/components/ui/Panel";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { State } from "@/components/ui/State";
import { TextField } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { differenceOf, formatPct, proposedDate, waitingFor } from "@/lib/offers/format";
import { dealRoomHref } from "@/lib/offers/routes";
import { PAYMENT_LABEL, STATE_FILTER_LABEL, turnSentence } from "@/lib/offers/words";
import type { OfferRow, OfferState } from "@/lib/offers/types";
import type { OfferCounts } from "@/lib/offers/queries";
import { GapBar, Naira, OfferStateChip } from "./OfferParts";
import "./offers.css";

type Tab = "made" | "received";
/**
 * The founder's count tab row on the offers workspace (handoff 6.3, 14
 * November 2026): Waiting on you, Waiting on them, Agreed, Closed.
 *
 * `awaiting_you` and the per-state counts come from the server
 * (`OfferCounts`). The two NEW tabs are derived from the rows this screen
 * already holds, never from a new read: "waiting on them" is an open offer
 * whose turn is the other side, and "closed" is the four states that end an
 * offer, added up. The per-state tabs they fold up are still reachable: a
 * closed offer says which kind it is on its own row.
 */
type Filter = OfferState | "all" | "awaiting_you" | "waiting_them" | "closed";
type SortKey = "activity" | "amount" | "gap";
type Dir = "ascending" | "descending";

const FILTERS: readonly Filter[] = ["all", "awaiting_you", "waiting_them", "agreed", "closed"];
/** The states that end an offer, folded into one tab. */
const CLOSED_STATES: readonly OfferState[] = ["declined", "withdrawn", "expired", "cancelled"];

export type OffersWorkspaceProps = {
  made: { rows: OfferRow[]; counts: OfferCounts };
  received: { rows: OfferRow[]; counts: OfferCounts };
  initialTab: Tab;
  /** The render's clock, handed down so the server and the first client render agree. */
  nowMs: number;
};

function Direction({ row }: { row: OfferRow }) {
  const diff = differenceOf(row.amountMinor, row.askingMinor);
  return (
    <span className="nf-ofr-diff" data-dir={diff.direction}>
      {diff.direction !== "at" ? <UiIcon name={diff.direction === "above" ? "arrow-up" : "arrow-down"} size={12} /> : <UiIcon name="check" size={12} />}
      {diff.word}
      {diff.direction !== "at" ? <span className="nf-ofr-money"> {formatPct(diff.pct)}</span> : null}
    </span>
  );
}

function Thumb({ row }: { row: OfferRow }) {
  return (
    <span className="nf-ofr-thumb" aria-hidden="true">
      {row.listingThumb ? <RemoteImage src={row.listingThumb} alt="" width={96} height={96} sizes="48px" /> : <UiIcon name="house" size={20} />}
    </span>
  );
}

function OfferCard({ row, nowMs, index }: { row: OfferRow; nowMs: number; index: number }) {
  return (
    <li style={{ "--nf-i": Math.min(index, 8) } as CSSProperties}>
      <Panel as="div" variant="card" className="p-0">
        <Link href={dealRoomHref(row.id)} className="nf-ofr-card" data-testid="offer-card" data-offer={row.id}>
          <div className="nf-ofr-card__top">
            <div className="flex min-w-0 items-center gap-sm">
              <Thumb row={row} />
              <div className="min-w-0">
                <p className="nf-ofr-card__title">
                  {row.unread ? <span className="nf-ofr-unread" role="img" aria-label="Unread" /> : null}
                  {row.listingTitle}
                </p>
                <p className="nf-ofr-card__sub">
                  {row.viewerSide === "seller" ? "From" : "To"} {row.counterpartyName} · {row.reference}
                </p>
              </div>
            </div>
            <OfferStateChip row={row} />
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-sm">
            <Naira minor={row.amountMinor} className="nf-h3" />
            <Direction row={row} />
          </div>
          <div className="nf-ofr-card__bar">
            <GapBar amountMinor={row.amountMinor} askingMinor={row.askingMinor} />
          </div>
          <p className="nf-ofr-card__sub">
            Asking <Naira minor={row.askingMinor} /> · {PAYMENT_LABEL[row.paymentPreference]} · {proposedDate(row.targetClosing)}
          </p>
          <p className="nf-ofr-card__sub">
            {turnSentence(row)} {row.state === "open" ? `Waiting ${waitingFor(row.lastActivityAt, nowMs)}.` : ""}
          </p>
        </Link>
      </Panel>
    </li>
  );
}

function SortHead({ label, k, sort, onSort, end }: { label: string; k: SortKey; sort: { key: SortKey; dir: Dir }; onSort: (k: SortKey) => void; end?: boolean }) {
  const active = sort.key === k;
  return (
    <th scope="col" aria-sort={active ? sort.dir : "none"} {...(end ? { "data-end": "" } : {})}>
      <button type="button" className="nf-dt__sort" data-dir={active ? sort.dir : "none"} onClick={() => onSort(k)}>
        {label}
        <span className="nf-dt__arrow" aria-hidden="true">
          <UiIcon name="arrow-down" size={12} />
        </span>
      </button>
    </th>
  );
}

function OfferTable({ rows, nowMs, side, sort, onSort }: { rows: OfferRow[]; nowMs: number; side: Tab; sort: { key: SortKey; dir: Dir }; onSort: (k: SortKey) => void }) {
  const router = useRouter();
  const [active, setActive] = useState(-1);
  const body = useRef<HTMLTableSectionElement | null>(null);

  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.min(rows.length - 1, Math.max(0, active + (event.key === "ArrowDown" ? 1 : -1)));
      setActive(next);
      body.current?.querySelectorAll<HTMLElement>("a[data-offer-link]")[next]?.focus();
    } else if (event.key === "Enter" && active >= 0 && rows[active] && (event.target as HTMLElement).tagName !== "A") {
      router.push(dealRoomHref(rows[active].id));
    }
  };

  return (
    <div className="nf-ofr-table-wrap" data-testid="offers-table" onKeyDown={onKey}>
      <Panel flush>
        <div className="overflow-x-auto">
          <table className="nf-dt">
            <caption className="sr-only">{side === "made" ? "Offers you made" : "Offers you received"}</caption>
            <thead>
              <tr>
                <th scope="col">Property</th>
                <th scope="col">{side === "made" ? "Seller" : "Buyer"}</th>
                <SortHead label="Offer" k="amount" sort={sort} onSort={onSort} end />
                <th scope="col" data-end="">
                  Asking
                </th>
                <SortHead label="Against asking" k="gap" sort={sort} onSort={onSort} />
                <th scope="col">Payment</th>
                <th scope="col">State</th>
                <SortHead label="Waiting" k="activity" sort={sort} onSort={onSort} end />
                <th scope="col">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody ref={body}>
              {rows.map((row, i) => (
                <tr key={row.id} data-active={active === i ? "" : undefined} onClick={() => router.push(dealRoomHref(row.id))} onFocus={() => setActive(i)} style={{ cursor: "pointer" }}>
                  <td>
                    <div className="nf-dt__cell-title">
                      <Thumb row={row} />
                      <div className="min-w-0">
                        <Link href={dealRoomHref(row.id)} className="nf-dt__title" data-offer-link>
                          {row.unread ? <span className="nf-ofr-unread" role="img" aria-label="Unread" /> : null}
                          {row.listingTitle}
                        </Link>
                        <div className="nf-dt__ref">{row.reference}</div>
                      </div>
                    </div>
                  </td>
                  <td>{row.counterpartyName}</td>
                  <td data-end="">
                    <Naira minor={row.amountMinor} className="font-semibold text-[var(--nf-content-primary)]" />
                  </td>
                  <td data-end="">
                    <Naira minor={row.askingMinor} />
                  </td>
                  <td>
                    <Direction row={row} />
                  </td>
                  <td>{PAYMENT_LABEL[row.paymentPreference]}</td>
                  <td>
                    <OfferStateChip row={row} />
                  </td>
                  <td data-end="">{row.state === "open" ? waitingFor(row.lastActivityAt, nowMs) : ""}</td>
                  <td>
                    <span className="nf-dt__open">
                      Open <UiIcon name="arrow-right" size={14} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function OffersWorkspace({ made, received, initialTab, nowMs }: OffersWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: "activity", dir: "descending" });
  const data = tab === "made" ? made : received;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (event.key === "/" && el && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !el.isContentEditable) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[data-testid="offers-search"]')?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let all = data.rows;
    if (filter === "awaiting_you") all = all.filter((r) => r.state === "open" && r.turn === r.viewerSide);
    else if (filter === "waiting_them") all = all.filter((r) => r.state === "open" && r.turn !== r.viewerSide);
    else if (filter === "closed") all = all.filter((r) => CLOSED_STATES.includes(r.state));
    else if (filter !== "all") all = all.filter((r) => r.state === filter);
    if (q) all = all.filter((r) => [r.listingTitle, r.reference, r.counterpartyName].some((x) => x.toLowerCase().includes(q)));
    const val = (r: OfferRow) => (sort.key === "amount" ? r.amountMinor : sort.key === "gap" ? r.differencePct : Date.parse(r.lastActivityAt));
    return [...all].sort((a, b) => (sort.dir === "ascending" ? val(a) - val(b) : val(b) - val(a)));
  }, [data.rows, filter, query, sort]);

  const changeTab = (next: Tab) => {
    setTab(next);
    setFilter("all");
    setQuery("");
    router.replace(next === "received" ? "/offers?tab=received" : "/offers", { scroll: false });
  };
  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "descending" ? "ascending" : "descending" } : { key, dir: "descending" }));

  /* Every tab's count, from what this screen already has in hand. */
  const countFor = (f: Filter): number => {
    if (f === "waiting_them") return data.rows.filter((r) => r.state === "open" && r.turn !== r.viewerSide).length;
    if (f === "closed") return CLOSED_STATES.reduce((sum, state) => sum + (data.counts[state] ?? 0), 0);
    return data.counts[f as keyof typeof data.counts] ?? 0;
  };
  /* A tab appears only when it has something in it; the tab you are on never
     vanishes under you. */
  const visibleFilters = FILTERS.filter((f) => f === "all" || countFor(f) > 0 || f === filter);

  return (
    <div className="nf-ofr-ws grid gap-md" data-testid="offers-workspace">
      <Segmented
        label="Offers"
        semantics="tabs"
        value={tab}
        onChange={changeTab}
        full
        options={[
          { value: "made", label: "Made", count: made.counts.all },
          { value: "received", label: "Received", count: received.counts.all },
        ]}
      />

      {data.counts.all > 0 ? (
        <div className="nf-dt-bar" data-testid="offers-filter-bar">
          <div className="hidden min-w-[16rem] flex-1 lg:block">
            <TextField label="Search" hideLabel placeholder="Search property, person or reference (press /)" leadingIcon="search" inputMode="search" enterKeyHint="search" value={query} onChange={(e) => setQuery(e.target.value)} clearable="Clear search" onClear={() => setQuery("")} data-testid="offers-search" />
          </div>
          <CountTabs
            label="Filter by state"
            active={filter}
            onChange={(key) => setFilter(key as Filter)}
            items={visibleFilters.map((f) => ({
              key: f,
              label: STATE_FILTER_LABEL[f],
              ...(countFor(f) > 0 ? { count: countFor(f) } : {}),
              "data-testid": `offers-filter-${f}`,
            }))}
          />
        </div>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {plural(rows.length, { one: "{count} offer", other: "{count} offers" })} shown
      </div>

      {data.counts.all === 0 ? (
        tab === "made" ? (
          <State
            kind="empty"
            icon="bungalow"
            art="buy"
            title="You have not made an offer yet"
            body="When you find a property for sale, check your requirements and send an offer. Nothing is charged, and the seller reviews it and responds."
            primary={{ href: "/search?market=buy", label: "Browse homes for sale" }}
            data-testid="offers-empty-made"
          />
        ) : (
          <State
            kind="empty"
            icon="contract-sign"
            art="list"
            title="No offers received yet"
            body="Offers on the properties you sell will arrive here, with the buyer's name, the figure and what is waiting on you."
            primary={{ href: "/agent/list", label: "List a property" }}
            data-testid="offers-empty-received"
          />
        )
      ) : rows.length === 0 ? (
        <State
          kind="empty"
          compact
          title={query ? "No offers match your search" : `No ${STATE_FILTER_LABEL[filter].toLowerCase()} offers`}
          body="Try another filter or clear the search to see the rest."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
            >
              Show all
            </Button>
          }
        />
      ) : (
        <>
          <ul className="nf-ofr-list" data-wide-hidden data-testid="offers-list">
            {rows.map((row, i) => (
              <OfferCard key={row.id} row={row} nowMs={nowMs} index={i} />
            ))}
          </ul>
          <OfferTable rows={rows} nowMs={nowMs} side={tab} sort={sort} onSort={onSort} />
        </>
      )}
    </div>
  );
}
