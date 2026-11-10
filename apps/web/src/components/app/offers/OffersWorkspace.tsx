"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { State } from "@/components/ui/State";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { differenceOf, formatPct, nairaFull, nairaShort, waitingFor, proposedDate } from "@/lib/offers/format";
import { dealRoomHref } from "@/lib/offers/routes";
import { PAYMENT_LABEL, STATE_FILTER_LABEL, holderLine, turnSentence } from "@/lib/offers/words";
import type { OfferRow, OfferState } from "@/lib/offers/types";
import type { OfferCounts } from "@/lib/offers/queries";
import { Naira, OfferStateChip } from "./OfferParts";
import "./offers.css";

type Tab = "made" | "received";
type Filter = OfferState | "all" | "awaiting_you";

const FILTERS: readonly Filter[] = ["all", "awaiting_you", "open", "agreed", "declined", "withdrawn", "expired", "cancelled"];

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
      {diff.word}
      {diff.direction !== "at" ? <span className="nf-ofr-money"> {formatPct(diff.pct)}</span> : null}
    </span>
  );
}

function OfferCard({ row, nowMs }: { row: OfferRow; nowMs: number }) {
  return (
    <li>
      <Panel as="div" variant="card" className="p-0">
        <Link href={dealRoomHref(row.id)} className="nf-ofr-card" data-testid="offer-card" data-offer={row.id}>
          <div className="nf-ofr-card__top">
            <div className="min-w-0">
              <p className="nf-ofr-card__title">
                {row.unread ? <span className="nf-ofr-unread" role="img" aria-label="Unread" /> : null}
                {row.listingTitle}
              </p>
              <p className="nf-ofr-card__sub">
                {row.viewerSide === "seller" ? "From" : "To"} {row.counterpartyName} · {row.reference}
              </p>
            </div>
            <OfferStateChip row={row} />
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-sm">
            <Naira minor={row.amountMinor} className="nf-h3" />
            <Direction row={row} />
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

function OfferTable({ rows, nowMs, side }: { rows: OfferRow[]; nowMs: number; side: Tab }) {
  const router = useRouter();
  return (
    <div className="nf-ofr-table-wrap" data-testid="offers-table">
      <Panel flush>
        <Table caption={side === "made" ? "Offers you made" : "Offers you received"} density="comfortable">
          <THead>
            <TR>
              <TH>Property</TH>
              <TH>{side === "made" ? "Seller" : "Buyer"}</TH>
              <TH align="end">Offer</TH>
              <TH align="end">Asking</TH>
              <TH>Against asking</TH>
              <TH>Payment</TH>
              <TH>State</TH>
              <TH>With</TH>
              <TH align="end">Waiting</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id} onClick={() => router.push(dealRoomHref(row.id))}>
                <TD>
                  <Link href={dealRoomHref(row.id)} className="font-semibold" data-offer-link>
                    {row.unread ? <span className="nf-ofr-unread" role="img" aria-label="Unread" /> : null}
                    {row.listingTitle}
                  </Link>
                  <div className="nf-ofr-define">{row.reference}</div>
                </TD>
                <TD>{row.counterpartyName}</TD>
                <TD align="end">
                  <span className="nf-ofr-money font-semibold">{nairaShort(row.amountMinor)}</span>
                  <span className="sr-only">{nairaFull(row.amountMinor)}</span>
                </TD>
                <TD align="end">
                  <span className="nf-ofr-money">{nairaShort(row.askingMinor)}</span>
                </TD>
                <TD>
                  <Direction row={row} />
                </TD>
                <TD>{PAYMENT_LABEL[row.paymentPreference]}</TD>
                <TD>
                  <OfferStateChip row={row} />
                </TD>
                <TD>{holderLine(row)}</TD>
                <TD align="end">{row.state === "open" ? waitingFor(row.lastActivityAt, nowMs) : ""}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Panel>
    </div>
  );
}

export function OffersWorkspace({ made, received, initialTab, nowMs }: OffersWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filter, setFilter] = useState<Filter>("all");
  const data = tab === "made" ? made : received;

  const rows = useMemo(() => {
    const all = data.rows;
    if (filter === "all") return all;
    if (filter === "awaiting_you") return all.filter((r) => r.state === "open" && r.turn === r.viewerSide);
    return all.filter((r) => r.state === filter);
  }, [data.rows, filter]);

  const changeTab = (next: Tab) => {
    setTab(next);
    setFilter("all");
    router.replace(next === "received" ? "/offers?tab=received" : "/offers", { scroll: false });
  };

  const visibleFilters = FILTERS.filter((f) => f === "all" || data.counts[f] > 0 || f === filter);

  return (
    <div className="grid gap-md" data-testid="offers-workspace">
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
        <ChipRow label="Filter by state" radiogroup bleed={false} fadeEdges={false}>
          {visibleFilters.map((f) => (
            <Chip key={f} behaviour="choice" selected={filter === f} onSelectedChange={() => setFilter(f)} count={data.counts[f]} data-testid={`offers-filter-${f}`}>
              {STATE_FILTER_LABEL[f]}
            </Chip>
          ))}
        </ChipRow>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {rows.length} {rows.length === 1 ? "offer" : "offers"} shown
      </div>

      {data.counts.all === 0 ? (
        tab === "made" ? (
          <State
            kind="empty"
            icon="bungalow"
            title="You have not made an offer yet"
            body="When you find a property for sale, check your requirements and send an offer. Nothing is charged, and the seller reviews it and responds."
            primary={{ href: "/search?market=buy", label: "Browse homes for sale" }}
            data-testid="offers-empty-made"
          />
        ) : (
          <State
            kind="empty"
            icon="contract-sign"
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
          title={`No ${STATE_FILTER_LABEL[filter].toLowerCase()} offers`}
          body="Try another filter to see the rest."
          action={
            <Button variant="secondary" size="sm" onClick={() => setFilter("all")}>
              Show all
            </Button>
          }
        />
      ) : (
        <>
          <ul className="nf-ofr-list" data-wide-hidden data-testid="offers-list">
            {rows.map((row) => (
              <OfferCard key={row.id} row={row} nowMs={nowMs} />
            ))}
          </ul>
          <OfferTable rows={rows} nowMs={nowMs} side={tab} />
        </>
      )}
    </div>
  );
}
